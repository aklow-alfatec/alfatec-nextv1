'use client';
import { openChannel } from '@/lib/channel-link';

/** A component's name that opens its channel chart window (admin / superadmin; the caller decides). */
export function ChannelButton({ symbol, node, label, pipeline, className = '' }: { symbol: string; node: string; label: string; pipeline?: string | null; className?: string }) {
  return (
    <button
      type="button"
      onClick={() => openChannel(symbol, node, pipeline)}
      title={`Open the ${label} channel chart`}
      className={`text-left underline decoration-dotted underline-offset-2 hover:text-accent ${className}`}
    >
      {label}
    </button>
  );
}
