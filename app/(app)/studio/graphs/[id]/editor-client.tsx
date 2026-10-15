'use client';
import dynamic from 'next/dynamic';

const StudioEditor = dynamic(() => import('@/features/studio/studio-editor'), {
  ssr: false,
  loading: () => <p className="p-6 text-sm text-fg-3">Loading editor...</p>,
});

export function EditorClient({ id }: { id: string }) {
  const isNew = id === 'new';
  return (
    <div className="h-[calc(100vh-3.5rem)] overflow-x-auto">
      <div className="h-full min-w-[1024px]">
        <StudioEditor
          initialGraphId={isNew ? null : id}
          onSaved={(savedId, created) => {
            // keep the URL in sync without remounting the editor
            if (created) window.history.replaceState(null, '', `/studio/graphs/${savedId}`);
          }}
        />
      </div>
    </div>
  );
}
