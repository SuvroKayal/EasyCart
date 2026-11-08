import React, { useState } from 'react';
import { Mail, Lock, User as UserIcon, AlertCircle } from 'lucide-react';
import { Modal } from '../common/Modal';
import { Input } from '../common/Input';
import { Button } from '../common/Button';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../common/Toast';
import { GoogleSignInButton } from './GoogleSignInButton';

export const AuthModal: React.FC = () => {
  const { authModalOpen, setAuthModalOpen, authModalTab, setAuthModalTab, login, register, googleLogin } = useAuth();
  const { showToast } = useToast();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email.trim() || !password.trim()) {
      setError('Please provide both email and password.');
      return;
    }

    try {
      setIsLoading(true);
      if (authModalTab === 'login') {
        await login(email.trim(), password);
        showToast('Successfully signed in to EasyCart!', 'success');
      } else {
        await register(name.trim(), email.trim(), password);
        showToast('Account created successfully! Welcome to EasyCart.', 'success');
      }
      setEmail('');
      setPassword('');
      setName('');
    } catch (err: any) {
      setError(err.message || 'Authentication failed. Please check your credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal
      isOpen={authModalOpen}
      onClose={() => setAuthModalOpen(false)}
      maxWidth="md"
    >
      <div className="space-y-6">
        {/* Header Tabs */}
        <div className="flex border-b border-softBorder dark:border-dark-border">
          <button
            type="button"
            onClick={() => {
              setAuthModalTab('login');
              setError(null);
            }}
            className={`flex-1 pb-3 text-xs uppercase tracking-widest font-semibold text-center border-b-2 transition-all cursor-pointer ${
              authModalTab === 'login'
                ? 'border-bronze text-espresso dark:text-porcelain'
                : 'border-transparent text-mutedGrey hover:text-espresso dark:hover:text-porcelain'
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => {
              setAuthModalTab('register');
              setError(null);
            }}
            className={`flex-1 pb-3 text-xs uppercase tracking-widest font-semibold text-center border-b-2 transition-all cursor-pointer ${
              authModalTab === 'register'
                ? 'border-bronze text-espresso dark:text-porcelain'
                : 'border-transparent text-mutedGrey hover:text-espresso dark:hover:text-porcelain'
            }`}
          >
            Create Account
          </button>
        </div>

        {/* Intro */}
        <div className="text-center">
          <h3 className="font-serif text-xl sm:text-2xl font-semibold text-espresso dark:text-porcelain">
            {authModalTab === 'login' ? 'Welcome Back' : 'Join EasyCart Luxury'}
          </h3>
          <p className="text-xs text-mutedGrey dark:text-dark-muted mt-1.5">
            {authModalTab === 'login'
              ? 'Access your orders, saved bag, and bespoke promotions.'
              : 'Create your personal profile for seamless checkout and express dispatch.'}
          </p>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/40 text-rose-600 dark:text-rose-400 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Google Authentication */}
        <div className="space-y-4 pt-1">
          <GoogleSignInButton
            onSuccess={async (credential) => {
              try {
                setIsLoading(true);
                setError(null);
                await googleLogin(credential);
                showToast('Signed in successfully with Google!', 'success');
              } catch (err: any) {
                setError(err.message || 'Google authentication failed.');
              } finally {
                setIsLoading(false);
              }
            }}
            onError={(errMsg) => setError(errMsg)}
            isLoading={isLoading}
            text={authModalTab === 'login' ? 'signin_with' : 'signup_with'}
          />

          <div className="relative flex items-center justify-center py-1">
            <div className="border-t border-softBorder dark:border-dark-border w-full" />
            <span className="bg-white dark:bg-dark-surface px-3 text-[10px] uppercase tracking-widest text-mutedGrey font-medium absolute">
              or continue with email
            </span>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {authModalTab === 'register' && (
            <Input
              label="Full Name"
              type="text"
              placeholder="e.g. Shraddha Singh"
              value={name}
              onChange={(e) => setName(e.target.value)}
              leftIcon={<UserIcon className="w-4 h-4" />}
              required
            />
          )}

          <Input
            label="Email Address"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            leftIcon={<Mail className="w-4 h-4" />}
            required
          />

          <Input
            label="Password"
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            leftIcon={<Lock className="w-4 h-4" />}
            required
          />

          <Button
            type="submit"
            variant="primary"
            size="lg"
            isLoading={isLoading}
            className="w-full mt-2"
          >
            {authModalTab === 'login' ? 'Sign In & Continue' : 'Create Customer Account'}
          </Button>
        </form>

        {/* Credentials Assurance Note */}
        <div className="p-3 rounded-xl bg-ivory dark:bg-dark-card border border-softBorder dark:border-dark-border text-[11px] text-mutedGrey dark:text-dark-muted text-center">
          <span>Demo Account: </span>
          <span className="font-mono text-espresso dark:text-porcelain font-semibold">shraddha@gmail.com</span>
          <span> or create any new account instantly.</span>
        </div>
      </div>
    </Modal>
  );
};
