import React, { useEffect, useRef, useState } from 'react';
import { useTheme } from '../../context/ThemeContext';
import { api } from '../../services/api';

interface GoogleSignInButtonProps {
  onSuccess: (credential: string) => Promise<void> | void;
  onError: (errorMsg: string) => void;
  isLoading?: boolean;
  text?: 'signin_with' | 'signup_with' | 'continue_with' | 'signin';
}

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string;
            callback: (response: { credential: string; select_by?: string }) => void;
            auto_select?: boolean;
            cancel_on_tap_outside?: boolean;
          }) => void;
          renderButton: (
            parent: HTMLElement,
            options: {
              type?: 'standard' | 'icon';
              theme?: 'outline' | 'filled_blue' | 'filled_black';
              size?: 'large' | 'medium' | 'small';
              text?: 'signin_with' | 'signup_with' | 'continue_with' | 'signin';
              shape?: 'rectangular' | 'pill' | 'circle' | 'square';
              logo_alignment?: 'left' | 'center';
              width?: number | string;
              locale?: string;
            }
          ) => void;
          prompt: (momentListener?: (notification: any) => void) => void;
        };
      };
    };
  }
}

export const GoogleSignInButton: React.FC<GoogleSignInButtonProps> = ({
  onSuccess,
  onError,
  isLoading = false,
  text = 'continue_with',
}) => {
  const { theme } = useTheme();
  const buttonContainerRef = useRef<HTMLDivElement>(null);
  const [clientId, setClientId] = useState<string>('');
  const [googleEnabled, setGoogleEnabled] = useState<boolean>(true);
  const [gisLoaded, setGisLoaded] = useState<boolean>(false);
  const [internalLoading, setInternalLoading] = useState<boolean>(false);

  // Fetch client ID from backend configuration to ensure sync (no hardcoded fallback)
  useEffect(() => {
    let isMounted = true;
    api
      .getAuthConfig()
      .then((cfg) => {
        if (isMounted) {
          if (cfg.google_client_id && cfg.google_enabled !== false) {
            setClientId(cfg.google_client_id);
            setGoogleEnabled(true);
          } else {
            setClientId('');
            setGoogleEnabled(false);
          }
        }
      })
      .catch(() => {
        if (isMounted) {
          setClientId('');
          setGoogleEnabled(false);
        }
      });
    return () => {
      isMounted = false;
    };
  }, []);

  // Monitor Google Identity Services script availability
  useEffect(() => {
    let checkInterval: any;

    const checkGis = () => {
      if (window.google?.accounts?.id) {
        setGisLoaded(true);
        clearInterval(checkInterval);
      }
    };

    if (window.google?.accounts?.id) {
      setGisLoaded(true);
    } else {
      checkInterval = setInterval(checkGis, 300);
    }

    return () => {
      if (checkInterval) clearInterval(checkInterval);
    };
  }, []);

  // Initialize and render Google button when script, container, and valid client ID are ready
  useEffect(() => {
    if (!gisLoaded || !clientId || !googleEnabled || !buttonContainerRef.current) return;

    try {
      window.google!.accounts.id.initialize({
        client_id: clientId,
        callback: async (response) => {
          if (!response || !response.credential) {
            onError('Google authentication was cancelled or returned empty credential.');
            return;
          }
          try {
            setInternalLoading(true);
            await onSuccess(response.credential);
          } catch (err: any) {
            onError(err.message || 'Google sign-in failed. Please try again.');
          } finally {
            setInternalLoading(false);
          }
        },
        auto_select: false,
        cancel_on_tap_outside: true,
      });

      // Clear container before rendering
      buttonContainerRef.current.innerHTML = '';

      window.google!.accounts.id.renderButton(buttonContainerRef.current, {
        type: 'standard',
        theme: theme === 'dark' ? 'filled_black' : 'outline',
        size: 'large',
        text: text,
        shape: 'pill',
        logo_alignment: 'left',
        width: 340,
      });
    } catch (err: any) {
      console.error('Error rendering Google button:', err);
    }
  }, [gisLoaded, clientId, googleEnabled, theme, text, onSuccess, onError]);

  const handleCustomClick = () => {
    if (!clientId || !googleEnabled) {
      onError('Google sign-in is not configured. Please use email and password.');
      return;
    }
    if (window.google?.accounts?.id) {
      window.google.accounts.id.prompt((notification: any) => {
        if (notification.isNotDisplayed()) {
          onError('Google prompt could not be displayed. Please click the Google button below.');
        } else if (notification.isSkippedMoment()) {
          // User closed or skipped prompt
        }
      });
    }
  };

  const isBusy = isLoading || internalLoading;

  if (!googleEnabled) {
    return (
      <div className="w-full text-center py-2.5 px-3 rounded-xl bg-stone-50 dark:bg-dark-card/50 border border-softBorder dark:border-dark-border text-mutedGrey dark:text-dark-muted text-[11px]">
        Google sign-in is not configured on this server. Please continue with email and password.
      </div>
    );
  }

  return (
    <div className="w-full flex flex-col items-center justify-center space-y-2">
      {/* Container where official GIS renders */}
      <div
        ref={buttonContainerRef}
        className={`w-full flex items-center justify-center min-h-[44px] transition-opacity duration-200 ${
          isBusy ? 'opacity-50 pointer-events-none' : 'opacity-100'
        }`}
      />

      {/* Fallback & Custom styled Google button if GIS iframe fails to render */}
      {!gisLoaded && (
        <button
          type="button"
          onClick={handleCustomClick}
          disabled={isBusy}
          className="w-full max-w-[340px] flex items-center justify-center gap-3 px-4 py-2.5 rounded-full border border-softBorder dark:border-dark-border bg-white dark:bg-dark-card hover:bg-stone-light/50 dark:hover:bg-dark-elevated text-espresso dark:text-porcelain font-medium text-xs shadow-luxury-sm transition-all select-none cursor-pointer"
        >
          {isBusy ? (
            <div className="w-4 h-4 border-2 border-bronze border-t-transparent rounded-full animate-spin" />
          ) : (
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
          )}
          <span>{isBusy ? 'Authenticating with Google...' : 'Continue with Google'}</span>
        </button>
      )}

      {isBusy && (
        <p className="text-[11px] text-bronze dark:text-bronze-gold animate-pulse">
          Verifying security signature with Google servers...
        </p>
      )}
    </div>
  );
};
