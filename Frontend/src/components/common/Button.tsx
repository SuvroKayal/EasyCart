import React from 'react';
import { Loader2 } from 'lucide-react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  leftIcon,
  rightIcon,
  className = '',
  disabled,
  ...props
}) => {
  const baseStyles =
    'relative inline-flex items-center justify-center font-medium transition-all duration-200 select-none active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none rounded-xl cursor-pointer';

  const sizeStyles = {
    sm: 'text-xs px-3.5 py-1.5 gap-1.5',
    md: 'text-xs sm:text-sm px-4 py-2.5 gap-2',
    lg: 'text-sm sm:text-base px-6 py-3.5 gap-2.5 rounded-xl',
  };

  const variantStyles = {
    primary:
      'bg-espresso hover:bg-bronze text-white dark:bg-bronze dark:hover:bg-bronze-hover dark:text-espresso shadow-luxury-sm hover:shadow-luxury border border-transparent',
    secondary:
      'bg-ivory hover:bg-stone-light text-espresso dark:bg-dark-surface dark:hover:bg-dark-elevated dark:text-porcelain border border-softBorder dark:border-dark-border shadow-luxury-sm',
    outline:
      'bg-transparent hover:bg-stone-light/50 dark:hover:bg-dark-elevated text-espresso dark:text-porcelain border border-softBorder dark:border-dark-border',
    ghost:
      'bg-transparent hover:bg-stone-light/40 dark:hover:bg-dark-elevated text-espresso dark:text-porcelain',
    danger:
      'bg-rose-600 hover:bg-rose-700 text-white shadow-luxury-sm',
  };

  return (
    <button
      disabled={disabled || isLoading}
      className={`${baseStyles} ${sizeStyles[size]} ${variantStyles[variant]} ${className}`}
      {...props}
    >
      {isLoading ? (
        <Loader2 className="w-4 h-4 animate-spin shrink-0" />
      ) : (
        leftIcon && <span className="shrink-0">{leftIcon}</span>
      )}
      <span>{children}</span>
      {!isLoading && rightIcon && <span className="shrink-0">{rightIcon}</span>}
    </button>
  );
};
