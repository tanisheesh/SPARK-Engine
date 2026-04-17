'use client';

import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

interface LoginScreenProps {
  onLogin: () => void;
}

export default function LoginScreen({ onLogin }: LoginScreenProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Listen for OAuth callback from Electron deep link
    if (window.electronAPI?.onOAuthCallback) {
      window.electronAPI.onOAuthCallback(async (_event: any, url: string) => {
        try {
          // Extract tokens from the deep link URL
          const hashOrQuery = url.includes('#') ? url.split('#')[1] : url.split('?')[1];
          const params = new URLSearchParams(hashOrQuery);
          const accessToken = params.get('access_token');
          const refreshToken = params.get('refresh_token');

          if (accessToken && refreshToken) {
            const { error } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken
            });
            if (!error) onLogin();
          }
        } catch (err) {
          console.error('OAuth callback error:', err);
        }
      });
    }
  }, [onLogin]);

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: 'spark-engine://auth/callback',
          skipBrowserRedirect: true,
        }
      });
      if (error) throw error;
      if (data?.url && window.electronAPI?.openExternal) {
        await window.electronAPI.openExternal(data.url);
        // Poll for session - works when deep link isn't available in dev mode
        let attempts = 0;
        const interval = setInterval(async () => {
          attempts++;
          const { data: sessionData } = await supabase.auth.getSession();
          if (sessionData?.session) {
            clearInterval(interval);
            onLogin();
          }
          if (attempts > 150) clearInterval(interval); // 5 min timeout
        }, 2000);
      }
    } catch (err: any) {
      setError(err.message || 'Login failed');
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50"
      style={{ background: '#0f0a1a' }}>
      {/* Background blobs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full opacity-10 blur-3xl"
          style={{ background: '#D97706' }} />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 rounded-full opacity-10 blur-3xl"
          style={{ background: '#8B5CF6' }} />
      </div>

      <div className="relative z-10 flex flex-col items-center gap-8 p-12 rounded-2xl border"
        style={{ background: 'rgba(26,18,33,0.9)', borderColor: '#D97706', boxShadow: '0 0 40px rgba(217,119,6,0.2)', minWidth: 380 }}>

        {/* Logo */}
        <div className="flex flex-col items-center gap-4">
          <div className="w-20 h-20 rounded-full overflow-hidden border-2 flex items-center justify-center"
            style={{ borderColor: '#D97706', boxShadow: '0 0 20px rgba(217,119,6,0.4)' }}>
            <img src="./icon.png" alt="SPARK Engine" className="w-full h-full object-cover" />
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-bold font-mono"
              style={{ background: 'linear-gradient(90deg, #D97706, #F59E0B)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              SPARK ENGINE
            </h1>
            <p className="text-sm mt-1" style={{ color: '#9CA3AF' }}>Your Data Intelligence Companion</p>
          </div>
        </div>

        {/* Login button */}
        <div className="flex flex-col items-center gap-4 w-full">
          <p className="text-sm font-mono" style={{ color: '#E9D5FF' }}>Sign in to continue</p>

          <button
            onClick={handleGoogleLogin}
            disabled={loading}
            className="flex items-center gap-3 w-full justify-center px-6 py-3 rounded-xl font-mono font-semibold transition-all duration-200"
            style={{
              background: loading ? 'rgba(217,119,6,0.3)' : 'rgba(217,119,6,0.15)',
              border: '1px solid #D97706',
              color: '#F59E0B',
              cursor: loading ? 'not-allowed' : 'pointer'
            }}
            onMouseEnter={e => { if (!loading) (e.currentTarget as HTMLButtonElement).style.background = 'rgba(217,119,6,0.25)'; }}
            onMouseLeave={e => { if (!loading) (e.currentTarget as HTMLButtonElement).style.background = 'rgba(217,119,6,0.15)'; }}
          >
            {loading ? (
              <>
                <div className="w-5 h-5 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: '#D97706', borderTopColor: 'transparent' }} />
                Opening browser...
              </>
            ) : (
              <>
                <svg width="20" height="20" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Continue with Google
              </>
            )}
          </button>

          {error && (
            <p className="text-xs text-center" style={{ color: '#EF4444' }}>{error}</p>
          )}


        </div>
      </div>
    </div>
  );
}
