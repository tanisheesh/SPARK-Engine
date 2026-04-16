'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';

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

  return (
    <div className="w-full h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-6 border-b border-orange-600/20 bg-slate-950/50 backdrop-blur-sm">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-3">
            <svg className="w-8 h-8 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            ER Diagram Visualization
          </h2>
          <p className="text-slate-400 text-sm mt-1">
            {isConnected ? 'Visualize your database schema' : 'Connect to a data source first'}
          </p>
        </div>
        
        {isConnected && !loading && !error && (
          <button
            onClick={loadSchema}
            className="px-4 py-2 rounded-lg font-medium bg-slate-900 text-slate-400 hover:bg-slate-800 hover:text-orange-500 transition-all flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh
          </button>
        )}
      </div>

      {/* Diagram Type Selector */}
      {isConnected && !loading && !error && schema && (
        <div className="flex gap-2 px-6 py-4 border-b border-orange-600/10 bg-slate-950/30">
          <button
            onClick={() => setDiagramType('chen')}
            className={`px-4 py-2 rounded-lg font-medium transition-all ${
              diagramType === 'chen'
                ? 'bg-purple-500 text-white shadow-lg shadow-purple-500/25'
                : 'bg-slate-900 text-slate-400 hover:bg-slate-800 hover:text-purple-400'
            }`}
          >
            Chen Notation
          </button>
          <button
            onClick={() => setDiagramType('crow')}
            className={`px-4 py-2 rounded-lg font-medium transition-all ${
              diagramType === 'crow'
                ? 'bg-purple-500 text-white shadow-lg shadow-purple-500/25'
                : 'bg-slate-900 text-slate-400 hover:bg-slate-800 hover:text-purple-400'
            }`}
          >
            Crow's Foot Notation
          </button>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {!isConnected ? (
          <div className="h-full flex items-center justify-center">
            <div className="text-center">
              <svg className="w-24 h-24 text-slate-800 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <h3 className="text-xl font-bold text-slate-400 mb-2">No Data Source Connected</h3>
              <p className="text-slate-500">Please connect to a database or upload a CSV file first</p>
            </div>
          </div>
        ) : loading ? (
          <div className="h-full flex items-center justify-center">
            <div className="text-center">
              <div className="w-16 h-16 border-4 border-purple-500/30 border-t-purple-500 rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-slate-400">Loading schema...</p>
            </div>
          </div>
        ) : error ? (
          <div className="h-full flex items-center justify-center">
            <div className="text-center">
              <svg className="w-24 h-24 text-red-500 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <h3 className="text-xl font-bold text-red-400 mb-2">Error Loading Schema</h3>
              <p className="text-slate-500 mb-4">{error}</p>
              <button
                onClick={loadSchema}
                className="px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors"
              >
                Try Again
              </button>
            </div>
          </div>
        ) : schema && graph ? (
          <div className="h-full">
            {diagramType === 'chen' ? (
              <ChenDiagram schema={schema} graph={graph} />
            ) : (
              <CrowDiagram schema={schema} graph={graph} />
            )}
          </div>
        ) : (
          <div className="h-full flex items-center justify-center">
            <div className="text-center">
              <svg className="w-24 h-24 text-slate-800 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
              </svg>
              <h3 className="text-xl font-bold text-slate-400 mb-2">No Schema Available</h3>
              <p className="text-slate-500">Unable to extract schema from the current data source</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
