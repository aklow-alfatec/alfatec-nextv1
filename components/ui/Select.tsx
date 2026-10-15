import { cn } from '@/lib/cn';
import type { SelectHTMLAttributes } from 'react';
import { fieldCls } from './Input';

export function Select({ className, ...p }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...p} className={cn(fieldCls, 'h-9 text-sm', className)} />;
}
