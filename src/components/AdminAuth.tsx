'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

interface AdminAuthProps {
  onAdminChange: (isAdmin: boolean) => void;
}

export function AdminAuth({ onAdminChange }: AdminAuthProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [supabase] = useState(() => createSupabaseBrowserClient());

  const refreshAuthorization = useCallback(async () => {
    try {
      const response = await fetch('/api/auth/admin', { cache: 'no-store' });
      if (!response.ok) {
        throw new Error('Could not verify administrator access.');
      }

      const authorization = await response.json();
      setError(null);
      setIsAuthenticated(Boolean(authorization.isAuthenticated));
      const admin = Boolean(authorization.isAdmin);
      setIsAdmin(admin);
      onAdminChange(admin);
    } catch {
      setIsAuthenticated(false);
      setIsAdmin(false);
      onAdminChange(false);
      setError('Could not verify administrator access. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [onAdminChange]);

  useEffect(() => {
    if (!supabase) {
      setIsLoading(false);
      onAdminChange(false);
      return;
    }

    void refreshAuthorization();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      void refreshAuthorization();
    });

    return () => subscription.unsubscribe();
  }, [onAdminChange, refreshAuthorization, supabase]);

  const handleSignIn = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (!supabase) {
      setError('Administrator sign-in is not configured.');
      return;
    }

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) {
      setError('Sign-in failed. Check your credentials and try again.');
      return;
    }

    setPassword('');
    await refreshAuthorization();
  };

  const handleSignOut = async () => {
    setError(null);
    if (!supabase) {
      onAdminChange(false);
      setIsAuthenticated(false);
      return;
    }

    const { error: signOutError } = await supabase.auth.signOut();
    if (signOutError) {
      setError('Sign-out failed. Please try again.');
      return;
    }

    setIsAuthenticated(false);
    onAdminChange(false);
  };

  if (isLoading) {
    return <p className="text-xs text-slate-500">Checking administrator access...</p>;
  }

  return (
    <div className="space-y-2">
      {isAuthenticated ? (
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs text-slate-600">
            {isAdmin ? 'Administrator access verified' : 'Signed in without upload access'}
          </p>
          <button
            type="button"
            onClick={handleSignOut}
            className="text-xs font-medium text-indigo-600 hover:text-indigo-700"
          >
            Sign out
          </button>
        </div>
      ) : (
        <form onSubmit={handleSignIn} className="space-y-2">
          <p className="text-xs font-semibold text-slate-700">Administrator sign-in</p>
          <input
            type="email"
            autoComplete="username"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="Admin email"
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs outline-none focus:border-indigo-400"
          />
          <input
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Password"
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs outline-none focus:border-indigo-400"
          />
          <button
            type="submit"
            className="w-full rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-700"
          >
            Sign in
          </button>
        </form>
      )}
      {error && <p className="text-xs text-red-600">{error}</p>}
      {!supabase && (
        <p className="text-xs text-amber-700">Administrator sign-in is not configured.</p>
      )}
    </div>
  );
}
