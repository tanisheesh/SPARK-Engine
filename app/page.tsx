'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import SettingsModal from '../components/SettingsModal';
import FileUpload from '../components/FileUpload';
import VisualizationView from '../components/VisualizationView';

export default function Home() {
  const [question, setQuestion] = useState('');
  const [status, setStatus] = useState<'idle' | 'processing' | 'speaking'>('idle');
  const [response, setResponse] = useState('');
  const [displayedText, setDisplayedText] = useState('');
  const [lastResponse, setLastResponse] = useState(''); // Store last response for replay
  const [isProcessing, setIsProcessing] = useState(false);
  const [particles, setParticles] = useState<Array<{x: number[], y: number[]}>>([]);
  const [mounted, setMounted] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [deepgramSocket, setDeepgramSocket] = useState<WebSocket | null>(null);
  const [mediaStream, setMediaStream] = useState<MediaStream | null>(null);
  const [silenceTimer, setSilenceTimer] = useState<NodeJS.Timeout | null>(null);
  
  // Developer Mode States
  const [isDeveloperMode, setIsDeveloperMode] = useState(false);
  const [debugData, setDebugData] = useState<{
    originalQuestion: string;
    sqlQuery: string;
    queryResults: any[];
    totalRows: number;
    groqResponse: string;
    processingSteps: string[];
  } | null>(null);
  
  // Audio management states
  const [currentAudio, setCurrentAudio] = useState<HTMLAudioElement | null>(null);
  const [currentUtterance, setCurrentUtterance] = useState<SpeechSynthesisUtterance | null>(null);
  
  // UI States
  const [showSettings, setShowSettings] = useState(false);
  const [showFileUpload, setShowFileUpload] = useState(false);
  const [currentView, setCurrentView] = useState<'chat' | 'visualization'>('chat');
  const [currentDataset, setCurrentDataset] = useState<string>('');
  const [datasetType, setDatasetType] = useState<'csv' | 'mysql' | 'sqlite' | 'postgresql' | null>(null);
  const [connectionConfig, setConnectionConfig] = useState<any>(null);
  const [apiSettings, setApiSettings] = useState<any>({});
  const [isMuted, setIsMuted] = useState(false);

  // Cleanup function for audio resources
  const cleanupAudio = () => {
    // Stop current audio
    if (currentAudio) {
      currentAudio.pause();
      currentAudio.src = '';
      setCurrentAudio(null);
    }
    
    // Stop current speech synthesis
    if (currentUtterance) {
      window.speechSynthesis.cancel();
      setCurrentUtterance(null);
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanupAudio();
    };
  }, [currentAudio, currentUtterance]);

  useEffect(() => {
    setMounted(true);
    
    // Load settings
    loadSettings();
    
    // Listen for settings open event
    if (window.electronAPI) {
      window.electronAPI.onOpenSettings(() => {
        setShowSettings(true);
      });
    }
    
    // Check if we need to show initial setup
    checkInitialSetup();
  }, []);

  useEffect(() => {
    if (!mounted) return;
    const newParticles = [...Array(30)].map(() => ({
      x: [Math.random() * window.innerWidth, Math.random() * window.innerWidth],
      y: [Math.random() * window.innerHeight, Math.random() * window.innerHeight],
    }));
    setParticles(newParticles);
  }, [mounted]);

  useEffect(() => {
    if (status === 'speaking' && response) {
      // Directly show full response without typing animation
      setDisplayedText(response);
      
      // Set status to idle after a short delay
      setTimeout(() => {
        setStatus('idle');
        setIsProcessing(false);
      }, 500);
    }
  }, [status, response]);

  const stopRecording = () => {
    if (deepgramSocket) deepgramSocket.close();
    if (mediaStream) mediaStream.getTracks().forEach(track => track.stop());
    if (silenceTimer) clearTimeout(silenceTimer);
    setDeepgramSocket(null);
    setMediaStream(null);
    setSilenceTimer(null);
    setIsListening(false);
  };

  const loadSettings = async () => {
    try {
      if (window.electronAPI) {
        const settings = await window.electronAPI.getSettings();
        setApiSettings(settings);
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  };

  const checkInitialSetup = async () => {
    try {
      if (window.electronAPI) {
        const settings = await window.electronAPI.getSettings();
        if (!settings.groqApiKey) {
          // Show settings modal if no API key is configured
          setTimeout(() => setShowSettings(true), 1000);
        }
      }
    } catch (error) {
      console.error('Error checking initial setup:', error);
    }
  };

  const handleSettingsSave = (settings: any) => {
    setApiSettings(settings);
  };

  const handleFileSelected = (file: any, type: 'csv' | 'mysql' | 'sqlite' | 'postgresql', config?: any) => {
    if (file.name) {
      setCurrentDataset(file.name);
      setDatasetType(type);
      setConnectionConfig(config || null);
    } else {
      // Clear dataset when disconnecting
      setCurrentDataset('');
      setDatasetType(null);
      setConnectionConfig(null);
    }
  };

  const handleMuteToggle = () => {
    const newMutedState = !isMuted;
    setIsMuted(newMutedState);
    
    // Simply mute/unmute the current audio volume, don't stop it
    if (currentAudio) {
      currentAudio.muted = newMutedState;
    }
    
    // Also mute/unmute any speech synthesis if it's playing
    if (currentUtterance) {
      if (newMutedState) {
        window.speechSynthesis.pause();
      } else {
        window.speechSynthesis.resume();
      }
    }
  };

  const handleSpeakResponse = async () => {
    if (!lastResponse) return;
    
    // Check if Inworld API keys are configured
    if (!apiSettings.inworldApiKey || !apiSettings.inworldApiSecret) {
      alert('Inworld AI API keys are required for voice output. Please configure them in Settings.');
      setShowSettings(true);
      return;
    }
    
    try {
      setIsProcessing(true);
      setStatus('speaking');
      
      // Call TTS API directly
      if (window.electronAPI) {
        const result = await window.electronAPI.generateTTS({
          text: lastResponse,
          settings: apiSettings
        });
        
        if (result.success && result.audioData) {
          const audioBlob = new Blob(
            [Uint8Array.from(atob(result.audioData), c => c.charCodeAt(0))],
            { type: result.mimeType || 'audio/wav' }
          );
          const audioUrl = URL.createObjectURL(audioBlob);
          const audio = new Audio(audioUrl);
          
          audio.onended = () => {
            URL.revokeObjectURL(audioUrl);
            setCurrentAudio(null);
            setStatus('idle');
            setIsProcessing(false);
          };
          
          audio.onerror = () => {
            URL.revokeObjectURL(audioUrl);
            setCurrentAudio(null);
            setStatus('idle');
            setIsProcessing(false);
          };
          
          setCurrentAudio(audio);
          audio.play().catch(error => {
            console.error('Audio play failed:', error);
            URL.revokeObjectURL(audioUrl);
            setCurrentAudio(null);
            setStatus('idle');
            setIsProcessing(false);
          });
        } else {
          throw new Error(result.error || 'TTS generation failed');
        }
      }
    } catch (error) {
      console.error('TTS Error:', error);
      alert('Failed to generate voice output: ' + (error as Error).message);
      setStatus('idle');
      setIsProcessing(false);
    }
  };

  const handleVoiceInput = async () => {
    if (isListening) {
      stopRecording();
      return;
    }

    try {
      // Get API key from settings
      const deepgramKey = apiSettings.deepgramApiKey;

      if (!deepgramKey) {
        alert('Deepgram API key not configured. Please add it in Settings for voice input.');
        setShowSettings(true);
        return;
      }

      // Get microphone access
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 16000,
        } 
      });
      setMediaStream(stream);

      // Create WebSocket connection to Deepgram
      const ws = new WebSocket('wss://api.deepgram.com/v1/listen?model=nova-2&smart_format=true&language=en&endpointing=true', [
        'token',
        deepgramKey
      ]);

      let currentSilenceTimer: NodeJS.Timeout | null = null;

      ws.onopen = () => {
        console.log('Deepgram WebSocket connected');
        setIsListening(true);

        // Create MediaRecorder to capture audio
        const mediaRecorder = new MediaRecorder(stream, {
          mimeType: 'audio/webm',
        });

        mediaRecorder.addEventListener('dataavailable', (event) => {
          if (event.data.size > 0 && ws.readyState === WebSocket.OPEN) {
            ws.send(event.data);
          }
        });

        mediaRecorder.start(250); // Send data every 250ms
      };

      ws.onmessage = (message) => {
        const data = JSON.parse(message.data);
        const transcript = data.channel?.alternatives?.[0]?.transcript;
        const isFinal = data.is_final;
        const speechFinal = data.speech_final;
        
        if (transcript && transcript.trim()) {
          // Clear existing silence timer
          if (currentSilenceTimer) {
            clearTimeout(currentSilenceTimer);
            currentSilenceTimer = null;
          }
          
          // Append to existing question text
          setQuestion(prev => {
            const newText = prev ? prev + ' ' + transcript : transcript;
            return newText;
          });
          
          // Start silence detection timer after speech
          if (isFinal || speechFinal) {
            currentSilenceTimer = setTimeout(() => {
              console.log('Silence detected, stopping recording...');
              stopRecording();
            }, 2000); // 2 seconds of silence
            setSilenceTimer(currentSilenceTimer);
          }
        }
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        alert('Failed to connect to Deepgram. Please check your API key.');
        stopRecording();
      };

      ws.onclose = () => {
        console.log('Deepgram WebSocket closed');
        stopRecording();
      };

      setDeepgramSocket(ws);
    } catch (error) {
      console.error('Microphone error:', error);
      alert('Could not access microphone. Please allow microphone permission.');
      stopRecording();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim() || isProcessing) return;

    // Check if we have required settings
    if (!apiSettings.groqApiKey) {
      alert('Please configure your Groq API key in Settings first!');
      setShowSettings(true);
      return;
    }

    // Check if we have a dataset selected
    if (!currentDataset && !datasetType) {
      alert('Please select a data source first! Upload a CSV or connect to a database.');
      setShowFileUpload(true);
      return;
    }

    setIsProcessing(true);
    setStatus('processing');
    setResponse('');
    setDisplayedText('');

    try {
      let data;
      
      // Use Electron API
      if (!window.electronAPI) {
        throw new Error('Electron API not available');
      }
      
      const csvFiles = await window.electronAPI.listCSVFiles();
      
      let selectedFile;
      
      // For database connections, we don't need CSV files anymore
      // Data is directly in DuckDB, just pass a dummy file object
      if (datasetType && datasetType !== 'csv') {
        // Database data is already in DuckDB, no file needed
        selectedFile = { 
          name: currentDataset, 
          path: 'duckdb://direct',
          size: 0,
          modified: new Date()
        };
      } else {
        // For CSV, find the specific file
        selectedFile = csvFiles.find((f: any) => f.name === currentDataset);
        
        if (!selectedFile) {
          throw new Error('Selected dataset not found');
        }
      }

      const result = await window.electronAPI.processQuery({
        question,
        csvFile: selectedFile.path,
        settings: apiSettings
      });

      if (!result.success) {
        throw new Error(result.error);
      }

      data = result;

      setResponse(data.textResponse);
      setLastResponse(data.textResponse); // Store for replay
      
      // Store debug data for developer mode
      setDebugData({
        originalQuestion: question,
        sqlQuery: data.sqlQuery || 'No SQL generated',
        queryResults: data.results || [],
        totalRows: data.totalRows || 0,
        groqResponse: data.textResponse,
        processingSteps: [
          '1. Voice/Text input received',
          '2. Groq AI generated SQL query',
          '3. DuckDB executed query',
          '4. Groq AI formatted response',
          data.tts.hasAudio ? '5. TTS audio generated' : '5. No TTS API configured'
        ]
      });
      
      // Always set to speaking to show the text animation
      setStatus('speaking');
      
      // Cleanup any existing audio before starting new one
      if (currentAudio) {
        currentAudio.pause();
        currentAudio.src = '';
        setCurrentAudio(null);
      }
      
      if (currentUtterance) {
        window.speechSynthesis.cancel();
        setCurrentUtterance(null);
      }
      
      // Play audio automatically if TTS API is configured and audio is available
      if (data.tts.hasAudio && data.tts.audioData) {
        const audioBlob = new Blob(
          [Uint8Array.from(atob(data.tts.audioData), c => c.charCodeAt(0))],
          { type: data.tts.mimeType }
        );
        const audioUrl = URL.createObjectURL(audioBlob);
        const audio = new Audio(audioUrl);
        
        // Set initial mute state
        audio.muted = isMuted;
        
        audio.onended = () => {
          URL.revokeObjectURL(audioUrl);
          setCurrentAudio(null);
          setStatus('idle');
          setIsProcessing(false);
        };
        
        audio.onerror = () => {
          URL.revokeObjectURL(audioUrl);
          setCurrentAudio(null);
          setStatus('idle');
          setIsProcessing(false);
        };
        
        setCurrentAudio(audio);
        audio.play().catch(error => {
          console.error('Audio play failed:', error);
          URL.revokeObjectURL(audioUrl);
          setCurrentAudio(null);
          setStatus('idle');
          setIsProcessing(false);
        });
      } else {
        // No TTS API configured - just show text and finish
        const animationDuration = data.textResponse.length * 50;
        setTimeout(() => {
          setStatus('idle');
          setIsProcessing(false);
        }, animationDuration + 1000);
      }
    } catch (error) {
      setStatus('idle');
      setIsProcessing(false);
      alert('Error: ' + (error as Error).message);
    }
  };

  return (
    <div className="min-h-screen bg-[#0f0a1a] flex overflow-hidden relative">
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#1a1221_1px,transparent_1px),linear-gradient(to_bottom,#1a1221_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_80%_50%_at_50%_50%,#000_70%,transparent_110%)]" />
      
      {mounted && (
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {particles.map((particle, i) => (
            <motion.div
              key={i}
              className="absolute w-1 h-1 bg-orange-500/40 rounded-full"
              animate={{ x: particle.x, y: particle.y }}
              transition={{ duration: Math.random() * 15 + 10, repeat: Infinity, ease: 'linear' }}
            />
          ))}
        </div>
      )}

      <motion.div className="absolute top-10 left-20 sm:top-20 sm:left-32 w-48 h-48 sm:w-96 sm:h-96 bg-orange-600/20 rounded-full blur-3xl pointer-events-none" animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.5, 0.3] }} transition={{ duration: 8, repeat: Infinity }} />
      <motion.div className="absolute bottom-10 right-10 sm:bottom-20 sm:right-20 w-48 h-48 sm:w-96 sm:h-96 bg-purple-500/20 rounded-full blur-3xl pointer-events-none" animate={{ scale: [1.2, 1, 1.2], opacity: [0.5, 0.3, 0.5] }} transition={{ duration: 8, repeat: Infinity }} />

      {/* Professional Sidebar */}
      <motion.div 
        initial={{ opacity: 0, x: -20 }} 
        animate={{ opacity: 1, x: 0 }}
        className="fixed left-0 top-0 h-full w-16 bg-slate-950/95 backdrop-blur-xl border-r border-orange-600/20 z-30 flex flex-col items-center py-6"
      >
        {/* Navigation Items */}
        <div className="flex flex-col gap-4 flex-1 mt-4">
          {/* Dataset Tab */}
          <button
            onClick={() => setShowFileUpload(true)}
            className={`group relative w-12 h-12 rounded-xl transition-all duration-200 flex items-center justify-center ${
              currentDataset 
                ? 'bg-orange-600/20 text-orange-500 border border-orange-600/30' 
                : 'bg-slate-900/50 text-slate-400 hover:bg-slate-800/50 hover:text-orange-500'
            }`}
            title="Manage Datasets"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            
            {/* Active indicator */}
            {currentDataset && (
              <div className="absolute -right-1 -top-1 w-3 h-3 bg-green-500 rounded-full border-2 border-slate-950"></div>
            )}
            
            {/* Tooltip */}
            <div className="absolute left-full ml-3 px-3 py-2 bg-slate-900 border border-orange-600/30 rounded-lg text-sm font-medium opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap">
              {currentDataset ? `Dataset: ${currentDataset}` : 'Upload Dataset'}
            </div>
          </button>

          {/* Settings Tab */}
          <button
            onClick={() => setShowSettings(true)}
            className={`group relative w-12 h-12 rounded-xl transition-all duration-200 flex items-center justify-center ${
              apiSettings.groqApiKey 
                ? 'bg-orange-600/20 text-orange-500 border border-orange-600/30' 
                : 'bg-slate-900/50 text-slate-400 hover:bg-slate-800/50 hover:text-orange-500'
            }`}
            title="API Settings"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            
            {/* Active indicator */}
            {apiSettings.groqApiKey && (
              <div className="absolute -right-1 -top-1 w-3 h-3 bg-green-500 rounded-full border-2 border-slate-950"></div>
            )}
            
            {/* Tooltip */}
            <div className="absolute left-full ml-3 px-3 py-2 bg-slate-900 border border-orange-600/30 rounded-lg text-sm font-medium opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap">
              API Configuration
            </div>
          </button>

          {/* Developer Mode Tab */}
          <button
            onClick={() => setIsDeveloperMode(!isDeveloperMode)}
            className={`group relative w-12 h-12 rounded-xl transition-all duration-200 flex items-center justify-center ${
              isDeveloperMode 
                ? 'bg-orange-600 text-white shadow-lg shadow-orange-600/25' 
                : 'bg-slate-900/50 text-slate-400 hover:bg-slate-800/50 hover:text-orange-500'
            }`}
            title="Developer Mode"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
            </svg>
            
            {/* Tooltip */}
            <div className="absolute left-full ml-3 px-3 py-2 bg-slate-900 border border-orange-600/30 rounded-lg text-sm font-medium opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap">
              {isDeveloperMode ? 'Debug Mode ON' : 'Debug Mode OFF'}
            </div>
          </button>

          {/* Audio Control Tab */}
          <button
            onClick={handleMuteToggle}
            className={`group relative w-12 h-12 rounded-xl transition-all duration-200 flex items-center justify-center ${
              isMuted 
                ? 'bg-red-500 text-white shadow-lg shadow-red-500/25' 
                : 'bg-slate-900/50 text-slate-400 hover:bg-slate-800/50 hover:text-orange-500'
            }`}
            title={isMuted ? 'Audio is muted' : 'Audio is enabled'}
          >
            {isMuted ? (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
              </svg>
            ) : (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
              </svg>
            )}
            
            {/* Tooltip */}
            <div className="absolute left-full ml-3 px-3 py-2 bg-slate-900 border border-orange-600/30 rounded-lg text-sm font-medium opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap">
              {isMuted ? 'Audio Muted' : 'Audio Enabled'}
            </div>
          </button>

          {/* Visualization Tab */}
          <button
            onClick={() => setCurrentView(currentView === 'visualization' ? 'chat' : 'visualization')}
            className={`group relative w-12 h-12 rounded-xl transition-all duration-200 flex items-center justify-center ${
              currentView === 'visualization'
                ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30' 
                : 'bg-slate-900/50 text-slate-400 hover:bg-slate-800/50 hover:text-purple-400'
            }`}
            title="ER Diagrams"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            
            {/* Tooltip */}
            <div className="absolute left-full ml-3 px-3 py-2 bg-slate-900 border border-orange-600/30 rounded-lg text-sm font-medium opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap">
              {currentView === 'visualization' ? 'Back to Chat' : 'ER Diagrams'}
            </div>
          </button>
        </div>
      </motion.div>

      {/* Main Content Area */}
      <div className="flex-1 ml-16 flex items-center justify-center p-2 sm:p-4 md:p-6 overflow-hidden relative">
        {currentView === 'visualization' ? (
          <div className="w-full h-full">
            <VisualizationView 
              isConnected={!!currentDataset || !!datasetType}
              connectionType={datasetType || 'csv'}
              connectionConfig={connectionConfig}
            />
          </div>
        ) : (
        <div className="relative z-10 w-full max-w-6xl px-2 sm:px-4">
          <motion.div initial={{ opacity: 0, y: -50 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-8 sm:mb-16">
            <motion.div className="relative w-32 h-32 sm:w-48 sm:h-48 mx-auto mb-4 sm:mb-8" animate={{ y: status === 'speaking' ? [0, -10, 0] : 0 }} transition={{ duration: 2, repeat: status === 'speaking' ? Infinity : 0 }}>
              <motion.div className="absolute inset-0 rounded-full pointer-events-none" animate={{ boxShadow: status === 'speaking' ? ['0 0 20px rgba(217, 119, 6, 0.5)', '0 0 60px rgba(217, 119, 6, 0.8)', '0 0 20px rgba(217, 119, 6, 0.5)'] : '0 0 20px rgba(217, 119, 6, 0.3)' }} transition={{ duration: 1.5, repeat: status === 'speaking' ? Infinity : 0 }} />
              
              <div className="relative w-full h-full bg-gradient-to-br from-slate-950 to-slate-900 rounded-full border-4 border-orange-500/50 overflow-hidden flex items-center justify-center">
                <img 
                  src="./icon.png" 
                  alt="SPARK Engine Logo" 
                  className="w-full h-full object-cover"
                />
              </div>

              <AnimatePresence>
                {status === 'speaking' && [...Array(3)].map((_, i) => (
                  <motion.div key={i} className="absolute inset-0 border-2 border-orange-500/30 rounded-full pointer-events-none" initial={{ scale: 1, opacity: 0.5 }} animate={{ scale: [1, 1.5, 1.5], opacity: [0.5, 0, 0] }} exit={{ opacity: 0 }} transition={{ duration: 2, repeat: Infinity, delay: i * 0.6 }} />
                ))}
              </AnimatePresence>
            </motion.div>

            <h1 className="text-4xl sm:text-5xl md:text-7xl font-black text-transparent bg-clip-text bg-gradient-to-r from-orange-500 via-orange-600 to-orange-700 mb-2 sm:mb-3">SPARK ENGINE</h1>
            <p className="text-orange-400/70 text-sm sm:text-lg md:text-xl tracking-wider">&gt; Your Data Intelligence Companion</p>
          </motion.div>

        <motion.form onSubmit={handleSubmit} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="mb-8 sm:mb-12 relative">
          <div className="relative group">
            <div className="absolute -inset-1 bg-gradient-to-r from-orange-600 via-purple-500 to-orange-600 rounded-3xl blur opacity-25 group-hover:opacity-50 transition duration-1000 animate-pulse pointer-events-none" />
            <div className="relative flex flex-col sm:flex-row gap-2">
              <div className="flex-1 relative">
                <input 
                  type="text" 
                  value={question} 
                  onChange={(e) => setQuestion(e.target.value)} 
                  placeholder={isListening ? "🎤 Recording..." : "◉ Type or speak your query..."} 
                  disabled={isProcessing || isListening} 
                  className="w-full pl-4 pr-14 sm:pl-8 py-4 sm:py-6 bg-slate-950/90 border-2 border-orange-600/30 rounded-3xl text-white text-base sm:text-lg placeholder-orange-400/20 focus:outline-none focus:border-orange-500 backdrop-blur-xl transition-all disabled:opacity-50 font-mono" 
                />
                <button
                  type="button"
                  onClick={handleVoiceInput}
                  disabled={isProcessing}
                  className="absolute right-14 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-gradient-to-br from-orange-600 to-purple-600 flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed z-10 transition-all"
                  style={{
                    boxShadow: isListening 
                      ? '0 0 0 0 rgba(217, 119, 6, 0.7)'
                      : '0 0 0 0 rgba(217, 119, 6, 0)',
                    animation: isListening ? 'pulse-ring 1.5s infinite' : 'none',
                  }}
                  title="Voice Input (Requires Deepgram API)"
                >
                  <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/>
                    <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={handleSpeakResponse}
                  disabled={!lastResponse || isProcessing}
                  className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-gradient-to-br from-green-500 to-purple-600 flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed z-10 transition-all"
                  title="Speak Last Response (Requires Inworld API)"
                >
                  <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
                  </svg>
                </button>
              </div>
              <motion.button 
                type="submit" 
                disabled={isProcessing || !question.trim() || isListening} 
                whileHover={{ scale: 1.05 }} 
                whileTap={{ scale: 0.95 }} 
                className="w-full sm:w-auto px-6 sm:px-8 py-3 bg-gradient-to-r from-orange-600 to-purple-600 rounded-2xl text-white font-bold disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-orange-600/50 whitespace-nowrap"
              >
                {isProcessing ? '◉ PROCESSING' : '▶ EXECUTE'}
              </motion.button>
            </div>
          </div>
        </motion.form>

        <AnimatePresence mode="wait">
          {status === 'processing' && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="text-center mb-8">
              <div className="flex items-center justify-center gap-2 sm:gap-3 mb-4">
                {[...Array(5)].map((_, i) => (
                  <motion.div key={i} className="w-1.5 sm:w-2 h-8 sm:h-12 bg-gradient-to-t from-orange-600 to-purple-500 rounded-full" animate={{ scaleY: [0.3, 1, 0.3], opacity: [0.3, 1, 0.3] }} transition={{ duration: 1, repeat: Infinity, delay: i * 0.1 }} />
                ))}
              </div>
              <motion.p className="text-orange-400/70 text-sm sm:text-lg font-mono px-4" animate={{ opacity: [0.5, 1, 0.5] }} transition={{ duration: 1.5, repeat: Infinity }}>&gt; Analyzing quantum data streams...</motion.p>
            </motion.div>
          )}

          {(status === 'speaking' || (status === 'idle' && response)) && (
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="relative">
              <div className="absolute -inset-1 bg-gradient-to-r from-orange-600 via-purple-500 to-orange-600 rounded-3xl blur opacity-20 animate-pulse pointer-events-none" />
              <div className="relative bg-slate-950/90 backdrop-blur-xl border-2 border-orange-600/30 rounded-3xl p-6 sm:p-10">
                {status === 'speaking' && (
                  <div className="flex justify-center mb-6 sm:mb-8">
                    <div className="relative">
                      <motion.div className="w-16 h-16 sm:w-20 sm:h-20 bg-gradient-to-br from-orange-500 to-purple-600 rounded-full flex items-center justify-center relative z-10" animate={{ boxShadow: ['0 0 20px rgba(217, 119, 6, 0.5)', '0 0 60px rgba(217, 119, 6, 0.8)', '0 0 20px rgba(217, 119, 6, 0.5)'] }} transition={{ duration: 1, repeat: Infinity }}>
                        <svg className="w-8 h-8 sm:w-10 sm:h-10 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/><path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/></svg>
                      </motion.div>
                      {[...Array(4)].map((_, i) => (
                        <motion.div key={i} className="absolute inset-0 border-2 border-orange-500/40 rounded-full pointer-events-none" animate={{ scale: [1, 2.5], opacity: [0.6, 0] }} transition={{ duration: 2, repeat: Infinity, delay: i * 0.5 }} />
                      ))}
                    </div>
                  </div>
                )}
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-white text-base sm:text-xl leading-relaxed font-light">
                  <span className="text-orange-500 font-mono">&gt; </span>{displayedText}
                  {status === 'speaking' && (
                    <motion.span animate={{ opacity: [1, 0] }} transition={{ duration: 0.5, repeat: Infinity }} className="inline-block w-1.5 sm:w-2 h-5 sm:h-6 bg-orange-500 ml-1 align-middle" />
                  )}
                </motion.div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Developer Debug Panel */}
        <AnimatePresence>
          {isDeveloperMode && debugData && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="mt-8 relative"
            >
              <div className="absolute -inset-1 bg-gradient-to-r from-orange-500 via-red-500 to-orange-500 rounded-3xl blur opacity-20 animate-pulse pointer-events-none" />
              <div className="relative bg-slate-950/95 backdrop-blur-xl border-2 border-orange-500/30 rounded-3xl p-6">
                <div className="flex items-center gap-2 mb-6">
                  <span className="text-2xl">🔧</span>
                  <h3 className="text-xl font-bold text-orange-400 font-mono">DEVELOPER DEBUG PANEL</h3>
                </div>
                
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Processing Steps */}
                  <div className="space-y-4">
                    <h4 className="text-orange-500 font-mono text-sm font-bold">📋 PROCESSING PIPELINE:</h4>
                    <div className="space-y-2">
                      {debugData.processingSteps.map((step, index) => (
                        <motion.div
                          key={index}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: index * 0.1 }}
                          className="flex items-center gap-2 text-sm"
                        >
                          <span className="text-green-400">✓</span>
                          <span className="text-gray-300 font-mono">{step}</span>
                        </motion.div>
                      ))}
                    </div>
                  </div>

                  {/* Query Info */}
                  <div className="space-y-4">
                    <h4 className="text-orange-500 font-mono text-sm font-bold">📊 QUERY STATS:</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-400">Total Rows:</span>
                        <span className="text-white font-mono">{debugData.totalRows.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Results Shown:</span>
                        <span className="text-white font-mono">{debugData.queryResults.length}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Query Type:</span>
                        <span className="text-white font-mono">
                          {debugData.sqlQuery.toUpperCase().includes('SELECT') ? 'SELECT' : 'OTHER'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Original Question */}
                <div className="mt-6 space-y-2">
                  <h4 className="text-orange-500 font-mono text-sm font-bold">🎤 USER INPUT:</h4>
                  <div className="bg-slate-900/50 rounded-lg p-3 border border-slate-800">
                    <code className="text-white text-sm">{debugData.originalQuestion}</code>
                  </div>
                </div>

                {/* Generated SQL */}
                <div className="mt-6 space-y-2">
                  <h4 className="text-orange-500 font-mono text-sm font-bold">🔍 GENERATED SQL:</h4>
                  <div className="bg-slate-900/50 rounded-lg p-3 border border-slate-800 overflow-x-auto">
                    <code className="text-green-400 text-sm whitespace-pre-wrap">{debugData.sqlQuery}</code>
                  </div>
                </div>

                {/* Raw SQL Results */}
                <div className="mt-6 space-y-2">
                  <h4 className="text-orange-500 font-mono text-sm font-bold">
                    📋 RAW SQL OUTPUT ({debugData.totalRows} rows returned):
                  </h4>
                  <div className="bg-slate-900/50 rounded-lg p-3 border border-slate-800 overflow-x-auto">
                    {debugData.queryResults.length > 0 ? (
                      <pre className="text-yellow-400 text-xs">
                        {JSON.stringify(debugData.queryResults.slice(0, 5), null, 2)}
                      </pre>
                    ) : (
                      <div className="text-gray-500 text-sm font-mono">
                        [] {/* Empty array - no results returned from DuckDB */}
                        <div className="text-xs text-gray-600 mt-1">
                          ↳ Query executed successfully but returned no matching rows
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* AI Response */}
                <div className="mt-6 space-y-2">
                  <h4 className="text-orange-500 font-mono text-sm font-bold">🤖 AI FORMATTED RESPONSE:</h4>
                  <div className="bg-slate-900/50 rounded-lg p-3 border border-slate-800">
                    <code className="text-purple-400 text-sm">{debugData.groqResponse}</code>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Footer */}
        <motion.footer 
          initial={{ opacity: 0 }} 
          animate={{ opacity: 1 }} 
          transition={{ delay: 1 }}
          className="relative z-10 mt-12 text-center"
        >
          <div className="relative inline-block">
            <div className="absolute -inset-2 bg-gradient-to-r from-orange-600/20 via-purple-500/20 to-orange-600/20 rounded-2xl blur-xl" />
            <div className="relative bg-slate-950/50 backdrop-blur-xl border border-orange-600/20 rounded-2xl px-6 py-4">
              <p className="text-orange-400/70 text-xs sm:text-sm font-mono">
                © {new Date().getFullYear()} All Rights Reserved. Made with{' '}
                <span className="text-red-500 animate-pulse">❤</span> by{' '}
                <span className="text-orange-500 font-semibold">
                  Team Binary Beast
                </span>
              </p>
            </div>
          </div>
        </motion.footer>
        </div>
        )}
      </div>
        
        {/* Modals */}
        <SettingsModal
          isOpen={showSettings}
          onClose={() => setShowSettings(false)}
          onSave={handleSettingsSave}
        />
        
        <FileUpload
          isOpen={showFileUpload}
          onClose={() => setShowFileUpload(false)}
          onFileSelected={handleFileSelected}
          currentDatasetType={datasetType}
        />
    </div>
  );
}
