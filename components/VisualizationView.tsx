'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { Button, EmptyState, Skeleton, cx } from './ui/Primitives';
import { IconRefresh } from './ui/Icons';

// Dynamically import diagram components to avoid SSR issues
const ChenDiagram = dynamic(() => import('./ChenDiagram'), { ssr: false });
const CrowDiagram = dynamic(() => import('./CrowDiagram'), { ssr: false });

interface VisualizationViewProps {
  isConnected: boolean;
  connectionType: string;
  connectionConfig: any;
}

export default function VisualizationView({ isConnected, connectionType, connectionConfig }: VisualizationViewProps) {
  const [diagramType, setDiagramType] = useState<'chen' | 'crow'>('crow');
  const [schema, setSchema] = useState<any>(null);
  const [graph, setGraph] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isConnected) {
      loadSchema();
    }
  }, [isConnected]);

  const loadSchema = async () => {
    if (!window.electronAPI) {
      setError('Electron API not available');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await window.electronAPI.getDatabaseSchema({
        connectionType,
        connectionConfig
      });
      
      if (result.success) {
        setSchema(result.schema);
        setGraph(result.graph);
      } else {
        setError(result.error || 'Failed to load schema');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load schema');
    } finally {
      setLoading(false);
    }
  };

  const tableCount = schema ? Object.keys(schema).length : 0;

  return (
    <div className="flex h-full w-full flex-col">
      {/* Notation switch + refresh. One quiet row, no page header —
          the shell already says which screen this is. */}
      {isConnected && !loading && !error && schema && (
        <div className="flex items-center gap-3 border-b border-line-subtle px-6 py-2">
          <div role="group" aria-label="Notation" className="flex items-center gap-0.5">
            {([['crow', "Crow's foot"], ['chen', 'Chen']] as const).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setDiagramType(id)}
                aria-pressed={diagramType === id}
                className={cx(
                  'rounded-md px-2 py-1 text-sm transition-colors duration-1 ease-out',
                  diagramType === id
                    ? 'bg-surface2 text-ink'
                    : 'text-faint hover:bg-surface2 hover:text-muted'
                )}
              >
                {label}
              </button>
            ))}
          </div>

          <span className="tnum font-mono text-2xs text-faint">
            {tableCount} {tableCount === 1 ? 'table' : 'tables'}
          </span>

          <span className="flex-1" />

          <Button size="sm" onClick={loadSchema}>
            <IconRefresh size={12} />
            Refresh
          </Button>
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-hidden">
        {!isConnected ? (
          <EmptyState
            title="No source connected."
            body="Connect a database or a CSV and its tables and relationships appear here."
          />
        ) : loading ? (
          /* The canvas has a known shape, so show it filling in rather
             than a spinner over an empty screen. */
          <div className="h-full px-6 py-6">
            <p className="text-base text-muted">Mapping your tables…</p>
            <div className="mt-4 grid grid-cols-2 gap-4 lg:grid-cols-3">
              {[0, 1, 2, 3, 4, 5].map((n) => (
                <Skeleton key={n} className="h-28 rounded-lg" />
              ))}
            </div>
          </div>
        ) : error ? (
          <EmptyState
            title="Couldn't read the schema."
            body={error}
            action={
              <Button variant="primary" onClick={loadSchema}>
                <IconRefresh size={12} />
                Try again
              </Button>
            }
          />
        ) : schema && graph ? (
          <div className="h-full">
            {diagramType === 'chen' ? (
              <ChenDiagram schema={schema} graph={graph} />
            ) : (
              <CrowDiagram schema={schema} graph={graph} />
            )}
          </div>
        ) : (
          <EmptyState
            title="No schema available."
            body="SPARK could not read table structure from this source."
          />
        )}
      </div>
    </div>
  );
}
