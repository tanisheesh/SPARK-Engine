'use client';

import { useState, useEffect } from 'react';
import { supabase, SavedPrompt } from '../lib/supabase';

interface SavedPromptsProps {
  onSelectPrompt: (prompt: string) => void;
  userId: string;
}

export default function SavedPrompts({ onSelectPrompt, userId }: SavedPromptsProps) {
  const [prompts, setPrompts] = useState<SavedPrompt[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPrompts();
  }, [userId]);

  const fetchPrompts = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('saved_prompts')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (!error && data) setPrompts(data);
    setLoading(false);
  };

  const deletePrompt = async (id: string) => {
    await supabase.from('saved_prompts').delete().eq('id', id);
    setPrompts(prev => prev.filter(p => p.id !== id));
  };

  if (loading) return (
    <div className="flex items-center justify-center py-8">
      <div className="w-5 h-5 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: '#D97706', borderTopColor: 'transparent' }} />
    </div>
  );

  if (prompts.length === 0) return (
    <div className="text-center py-8" style={{ color: '#6B7280' }}>
      <p className="text-sm font-mono">No saved prompts yet</p>
      <p className="text-xs mt-1">Chat mein 💾 button se save karo</p>
    </div>
  );

  return (
    <div className="flex flex-col gap-2">
      {prompts.map(prompt => (
        <div key={prompt.id}
          className="group flex items-center justify-between p-3 rounded-lg border transition-all cursor-pointer"
          style={{ background: 'rgba(217,119,6,0.05)', borderColor: 'rgba(217,119,6,0.2)' }}
          onClick={() => onSelectPrompt(prompt.prompt_text)}>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-mono font-semibold truncate" style={{ color: '#F59E0B' }}>{prompt.title}</p>
            <p className="text-xs truncate mt-0.5" style={{ color: '#9CA3AF' }}>{prompt.prompt_text}</p>
          </div>
          <button
            onClick={e => { e.stopPropagation(); deletePrompt(prompt.id); }}
            className="ml-2 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded"
            style={{ color: '#EF4444' }}>
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}
