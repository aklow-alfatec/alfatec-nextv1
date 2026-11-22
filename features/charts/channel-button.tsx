'use client';
import { openChannel } from '@/lib/channel-link';

/** A component's name that opens its channel chart window (admin / superadmin; the caller decides). */
export function ChannelButton({ symbol, node, label, className = '' }: { symbol: string; node: string; label: string; className?: string }) {
  return (
    <button
      type="button"
      onClick={() => openChannel(symbol, node)}
      title={`Open the ${label} channel chart`}
      className={`text-left underline decoration-dotted underline-offset-2 hover:text-accent ${className}`}
    >
      {label}
    </button>
  );
}
