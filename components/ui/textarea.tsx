import * as React from 'react'
import { cn } from '@/lib/utils'
export const Textarea=React.forwardRef<HTMLTextAreaElement,React.TextareaHTMLAttributes<HTMLTextAreaElement>>(({className,...props},ref)=><textarea ref={ref} className={cn('min-h-28 w-full rounded-[22px] border border-[#DCE8F7] bg-white/95 px-4 py-3 text-sm text-[#172033] outline-none shadow-[0_6px_18px_rgba(21,96,189,.035)] placeholder:text-slate-400 focus:border-[#77A9E8] focus:ring-4 focus:ring-[#1560BD]/8',className)} {...props}/>)
Textarea.displayName='Textarea'