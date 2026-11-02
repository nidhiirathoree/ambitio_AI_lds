import { cn } from '@/lib/utils';

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        'w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-md text-sm text-white',
        'placeholder:text-slate-500',
        'focus:outline-none focus:border-slate-600',
        'transition-colors',
        className
      )}
      {...props}
    />
  );
}

export function Textarea({ className, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        'w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-md text-sm text-white',
        'placeholder:text-slate-500',
        'focus:outline-none focus:border-slate-600',
        'resize-y transition-colors font-mono leading-relaxed',
        className
      )}
      {...props}
    />
  );
}
