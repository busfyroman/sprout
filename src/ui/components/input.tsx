import type { InputHTMLAttributes } from 'react'
import { cn } from '../cn'

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        'flex h-9 w-full rounded-lg border border-line bg-cream px-3 text-sm text-ink outline-none transition-colors placeholder:text-muted/80 focus-visible:border-clay focus-visible:ring-2 focus-visible:ring-clay/30 disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    />
  )
}
