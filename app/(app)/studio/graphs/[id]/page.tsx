import { EditorClient } from './editor-client';

export default async function GraphEditorPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ run?: string }> }) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  // ?run=<id>: the graph with that run's own settings filled in (read-only)
  return <EditorClient id={id} runId={sp.run ?? null} />;
}
