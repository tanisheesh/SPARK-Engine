'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { SparkMark } from './ui/Icons';
import { Spinner } from './ui/Primitives';

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
              refresh_token: refreshToken,
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
        },
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
    <div className="flex h-screen w-screen items-center justify-center bg-bg px-6">
      <div className="w-full max-w-[340px]">
        <SparkMark size={22} className="text-accent" />

        <h1 className="mt-5 text-2xl font-semibold text-ink">Talk to your data.</h1>
        <p className="mt-2 text-prose text-muted">
          Ask questions in plain English. SPARK writes the SQL and runs it on your machine.
        </p>

        <button
          onClick={handleGoogleLogin}
          disabled={loading}
          className="mt-7 flex h-9 w-full items-center justify-center gap-2.5 rounded-lg border border-line bg-surface2 text-base font-medium text-ink transition-colors duration-1 ease-out hover:bg-surface3 disabled:opacity-50 disabled:pointer-events-none"
        >
          {loading ? (
            <>
              <Spinner size={14} className="text-muted" />
              Waiting for your browser…
            </>
          ) : (
            <>
              <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              Continue with Google
            </>
          )}
        </button>

        {loading && (
          <p className="mt-2.5 text-sm text-faint">
            Finish signing in there, then come back — SPARK is watching for it.
          </p>
        )}

        {error && (
          <p role="alert" className="mt-2.5 text-sm text-negative">
            {error}
          </p>
        )}

        <p className="mt-7 border-t border-line-subtle pt-3.5 text-xs leading-relaxed text-faint">
          Your data stays on this machine. Only the question is sent for interpretation.
        </p>
      </div>
    </div>
  );
}
