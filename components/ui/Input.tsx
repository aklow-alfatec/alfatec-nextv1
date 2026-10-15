import { cn } from '@/lib/cn';
import type { InputHTMLAttributes, TextareaHTMLAttributes } from 'react';

export const fieldCls =
  'w-full rounded-control border border-line-2 bg-bg px-2 text-fg placeholder:text-fg-3 focus:border-accent focus:outline-none';

export function Input({ className, ...p }: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...p} className={cn(fieldCls, 'h-9 text-sm', className)} />;
}
export function Textarea({ className, ...p }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...p} className={cn(fieldCls, 'py-1 text-sm', className)} />;
}
