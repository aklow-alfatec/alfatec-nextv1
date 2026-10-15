import { Card } from '@/components/ui';

export function Placeholder({ title }: { title: string }) {
  return (
    <div className="p-4 md:p-6">
      <h1 className="mb-4 text-xl font-semibold">{title}</h1>
      <Card>
        <p className="text-fg-2">Coming in P14.</p>
      </Card>
    </div>
  );
}
