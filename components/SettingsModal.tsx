'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface Settings {
  groqApiKey: string;
  deepgramApiKey: string;
  inworldApiKey: string;
  inworldApiSecret: string;
  inworldWorkspace: string;
}

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (settings: Settings) => void;
}

export default function SettingsModal({ isOpen, onClose, onSave }: SettingsModalProps) {
  const [settings, setSettings] = useState<Settings>({
    groqApiKey: '',
    deepgramApiKey: '',
    inworldApiKey: '',
    inworldApiSecret: '',
    inworldWorkspace: ''
  });
  
  const [isLoading, setIsLoading] = useState(false);
  const [testResults, setTestResults] = useState<{[key: string]: 'success' | 'error' | 'testing'}>({});

  useEffect(() => {
    if (isOpen) {
      loadSettings();
    }
  }, [isOpen]);

  const loadSettings = async () => {
    try {
      if (window.electronAPI) {
        const savedSettings = await window.electronAPI.getSettings();
        setSettings(prev => ({ ...prev, ...savedSettings }));
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  };

  const handleSave = async () => {
    setIsLoading(true);
    try {
      if (window.electronAPI) {
        await window.electronAPI.saveSettings(settings);
        onSave(settings);
        onClose();
      }
    } catch (error) {
      console.error('Error saving settings:', error);
      alert('Failed to save settings');
    } finally {
      setIsLoading(false);
    }
  };

  const testApiKey = async (service: string, key: string) => {
    // Basic validation first
    if (!key || key.trim().length < 10) {
      setTestResults(prev => ({ ...prev, [service]: 'error' }));
      return;
    }
    
    setTestResults(prev => ({ ...prev, [service]: 'testing' }));
    
    try {
      let testUrl = '';
      let testHeaders: any = {};
      
      switch (service) {
        case 'groq':
          if (!key.startsWith('gsk_')) {
            setTestResults(prev => ({ ...prev, [service]: 'error' }));
            return;
          }
          testUrl = 'https://api.groq.com/openai/v1/models';
          testHeaders = { 'Authorization': `Bearer ${key}` };
          break;
        case 'deepgram':
          testUrl = 'https://api.deepgram.com/v1/projects';
          testHeaders = { 'Authorization': `Token ${key}` };
          break;
        case 'inworld':
          if (!settings.inworldApiKey || !settings.inworldApiSecret) {
            setTestResults(prev => ({ ...prev, [service]: 'error' }));
            return;
          }
          testUrl = 'https://api.inworld.ai/tts/v1/voices';
          testHeaders = { 'Authorization': `Basic ${btoa(`${settings.inworldApiKey}:${settings.inworldApiSecret}`)}` };
          break;
      }
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
      
      const response = await fetch(testUrl, { 
        headers: testHeaders,
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (response.ok || response.status === 401) {
        // 401 means key format is correct but might be invalid/expired
        setTestResults(prev => ({ ...prev, [service]: 'success' }));
      } else {
        setTestResults(prev => ({ ...prev, [service]: 'error' }));
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        console.error('API test timeout for', service);
      }
      setTestResults(prev => ({ ...prev, [service]: 'error' }));
    }
  };

  const getTestIcon = (service: string) => {
    const status = testResults[service];
    switch (status) {
      case 'testing': return '⏳';
      case 'success': return '✅';
      case 'error': return '❌';
      default: return '🔍';
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="bg-slate-950 rounded-3xl border-2 border-orange-600/30 p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 mb-8">
              <span className="text-3xl">⚙️</span>
              <h2 className="text-2xl font-bold text-orange-500 font-mono">API SETTINGS</h2>
            </div>

            <div className="space-y-6">
              {/* Groq API Key */}
              <div className="space-y-2">
                <label className="block text-orange-500 font-mono text-sm font-bold">
                  🤖 GROQ_API_KEY (Required for SQL Generation)
                </label>
                <div className="flex gap-2">
                  <input
                    type="password"
                    value={settings.groqApiKey}
                    onChange={(e) => setSettings(prev => ({ ...prev, groqApiKey: e.target.value }))}
                    placeholder="gsk_..."
                    className="flex-1 px-4 py-3 bg-slate-900 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-orange-500 font-mono text-sm"
                  />
                  <button
                    onClick={() => testApiKey('groq', settings.groqApiKey)}
                    disabled={!settings.groqApiKey}
                    className="px-4 py-3 bg-orange-700 hover:bg-orange-600 disabled:bg-slate-600 rounded-lg text-white font-mono text-sm transition-colors"
                  >
                    {getTestIcon('groq')} Test
                  </button>
                </div>
                <p className="text-slate-400 text-xs">
                  Get your free API key from{' '}
                  <button 
                    onClick={() => {
                      if (window.electronAPI) {
                        window.electronAPI.openExternal('https://console.groq.com');
                      }
                    }}
                    className="text-orange-500 hover:underline cursor-pointer"
                  >
                    console.groq.com
                  </button>
                </p>
              </div>

              {/* Deepgram API Key */}
              <div className="space-y-2">
                <label className="block text-orange-500 font-mono text-sm font-bold">
                  🎤 DEEPGRAM_API_KEY (Required for Voice Input Only)
                </label>
                <div className="flex gap-2">
                  <input
                    type="password"
                    value={settings.deepgramApiKey}
                    onChange={(e) => setSettings(prev => ({ ...prev, deepgramApiKey: e.target.value }))}
                    placeholder="Your Deepgram API key..."
                    className="flex-1 px-4 py-3 bg-slate-900 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-orange-500 font-mono text-sm"
                  />
                  <button
                    onClick={() => testApiKey('deepgram', settings.deepgramApiKey)}
                    disabled={!settings.deepgramApiKey}
                    className="px-4 py-3 bg-orange-700 hover:bg-orange-600 disabled:bg-slate-600 rounded-lg text-white font-mono text-sm transition-colors"
                  >
                    {getTestIcon('deepgram')} Test
                  </button>
                </div>
                <p className="text-slate-400 text-xs">
                  Get your API key from{' '}
                  <button 
                    onClick={() => {
                      if (window.electronAPI) {
                        window.electronAPI.openExternal('https://console.deepgram.com');
                      }
                    }}
                    className="text-orange-500 hover:underline cursor-pointer"
                  >
                    console.deepgram.com
                  </button>
                </p>
              </div>

              {/* Inworld API Keys */}
              <div className="space-y-4">
                <label className="block text-orange-500 font-mono text-sm font-bold">
                  🔊 INWORLD AI (Required for Voice Output Only)
                </label>
                
                <div>
                  <label className="block text-slate-300 text-xs mb-1">INWORLD_API_KEY</label>
                  <input
                    type="password"
                    value={settings.inworldApiKey}
                    onChange={(e) => setSettings(prev => ({ ...prev, inworldApiKey: e.target.value }))}
                    placeholder="t799urIX6amL..."
                    className="w-full px-4 py-3 bg-slate-900 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-orange-500 font-mono text-sm"
                  />
                </div>
                
                <div>
                  <label className="block text-slate-300 text-xs mb-1">INWORLD_API_SECRET</label>
                  <input
                    type="password"
                    value={settings.inworldApiSecret}
                    onChange={(e) => setSettings(prev => ({ ...prev, inworldApiSecret: e.target.value }))}
                    placeholder="PnV2Wj7qyJJj..."
                    className="w-full px-4 py-3 bg-slate-900 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-orange-500 font-mono text-sm"
                  />
                </div>
                
                <div className="flex gap-2">
                  <div className="flex-1">
                    <label className="block text-slate-300 text-xs mb-1">INWORLD_WORKSPACE</label>
                    <input
                      type="text"
                      value={settings.inworldWorkspace}
                      onChange={(e) => setSettings(prev => ({ ...prev, inworldWorkspace: e.target.value }))}
                      placeholder="dDc5OXVySVg2YW1M..."
                      className="w-full px-4 py-3 bg-slate-900 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-orange-500 font-mono text-sm"
                    />
                  </div>
                  <div className="flex items-end">
                    <button
                      onClick={() => testApiKey('inworld', settings.inworldApiKey)}
                      disabled={!settings.inworldApiKey || !settings.inworldApiSecret}
                      className="px-4 py-3 bg-orange-700 hover:bg-orange-600 disabled:bg-slate-600 rounded-lg text-white font-mono text-sm transition-colors"
                    >
                      {getTestIcon('inworld')} Test
                    </button>
                  </div>
                </div>
                
                <p className="text-slate-400 text-xs">
                  Get your credentials from{' '}
                  <button 
                    onClick={() => {
                      if (window.electronAPI) {
                        window.electronAPI.openExternal('https://studio.inworld.ai');
                      }
                    }}
                    className="text-orange-500 hover:underline cursor-pointer"
                  >
                    studio.inworld.ai
                  </button>
                </p>
              </div>

              {/* Warning */}
              <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-4">
                <div className="flex items-start gap-2">
                  <span className="text-orange-400 text-lg">⚠️</span>
                  <div>
                    <p className="text-orange-400 font-mono text-sm font-bold">IMPORTANT:</p>
                    <p className="text-orange-300 text-sm mt-1">
                      Only Groq API key is required. Voice input/output features are optional but enhance the experience.
                      Without Deepgram: No voice input. Without Inworld: Uses browser text-to-speech.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Buttons */}
            <div className="flex gap-4 mt-8">
              <button
                onClick={onClose}
                className="flex-1 px-6 py-3 bg-slate-800 hover:bg-slate-600 rounded-lg text-white font-mono transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={isLoading || !settings.groqApiKey}
                className="flex-1 px-6 py-3 bg-gradient-to-r from-orange-600 to-purple-600 hover:from-orange-700 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-white font-mono transition-all"
              >
                {isLoading ? 'Saving...' : 'Save Settings'}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}