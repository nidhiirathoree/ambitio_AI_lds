import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
}

const variants = {
  primary: 'bg-sky-400 text-slate-950 hover:bg-sky-300 border-transparent',
  secondary: 'bg-slate-800 text-white hover:bg-slate-700 border-transparent',
  ghost: 'bg-transparent text-slate-300 hover:bg-slate-800 hover:text-white border-transparent',
  outline: 'bg-transparent border-slate-700 text-slate-200 hover:bg-slate-800 hover:border-slate-600',
  danger: 'bg-rose-500/15 text-rose-300 border-rose-500/30 hover:bg-rose-500/25',
};

const sizes = {
  sm: 'px-3 py-1.5 text-xs gap-1.5 rounded-md',
  md: 'px-4 py-2 text-sm gap-2 rounded-md',
  lg: 'px-5 py-2.5 text-sm gap-2 rounded-md',
};

export function Button({
  variant = 'secondary',
  size = 'md',
  loading,
  className,
  children,
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center border font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed',
        variants[variant],
        sizes[size],
        className
      )}
      disabled={disabled || loading}
      {...props}
    >
      {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
      {children}
    </button>
  );
}
