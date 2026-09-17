import type { User } from '@supabase/supabase-js';
import { getSupabaseClient } from './supabase-client';

export interface AuthUser {
  id: string;
  email: string;
}

// Public interface is our own AuthUser shape, not the raw Supabase User --
// same "keep a self-hosted migration realistic" rationale as
// supabase-client.ts (docs/architecture/08).
export function toAuthUser(user: Pick<User, 'id' | 'email'>): AuthUser {
  return { id: user.id, email: user.email ?? '' };
}

export async function signUp(email: string, password: string): Promise<AuthUser> {
  const { data, error } = await getSupabaseClient().auth.signUp({ email, password });
  if (error) throw new Error(error.message);
  if (!data.user) throw new Error('Sign up succeeded but returned no user.');
  return toAuthUser(data.user);
}

export async function signIn(email: string, password: string): Promise<AuthUser> {
  const { data, error } = await getSupabaseClient().auth.signInWithPassword({ email, password });
  if (error) throw new Error(error.message);
  return toAuthUser(data.user);
}

export async function signOut(): Promise<void> {
  const { error } = await getSupabaseClient().auth.signOut();
  if (error) throw new Error(error.message);
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  const { data, error } = await getSupabaseClient().auth.getSession();
  if (error) throw new Error(error.message);
  return data.session ? toAuthUser(data.session.user) : null;
}

// Session persistence across restarts (docs/phases/phase-2-cloud-projects-sync.md)
// is handled by the Supabase client itself (localStorage-backed by default);
// this just relays state changes to the caller.
export function onAuthStateChange(callback: (user: AuthUser | null) => void): () => void {
  const {
    data: { subscription },
  } = getSupabaseClient().auth.onAuthStateChange((_event, session) => {
    callback(session ? toAuthUser(session.user) : null);
  });
  return () => subscription.unsubscribe();
}
