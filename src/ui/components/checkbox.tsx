import * as CheckboxPrimitive from '@radix-ui/react-checkbox'
import { Check } from 'lucide-react'
import type { ComponentProps } from 'react'
import { cn } from '../cn'

export function Checkbox({ className, ...props }: ComponentProps<typeof CheckboxPrimitive.Root>) {
  return (
    <CheckboxPrimitive.Root
      className={cn(
        'peer grid h-4 w-4 shrink-0 place-items-center rounded-[4px] border border-ink/30 bg-cream outline-none focus-visible:ring-2 focus-visible:ring-clay/40 data-[state=checked]:border-clay data-[state=checked]:bg-clay data-[state=indeterminate]:border-clay data-[state=indeterminate]:bg-clay',
        className,
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator className="grid place-items-center text-cream">
        <Check className="h-3 w-3" strokeWidth={3} />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  )
}
