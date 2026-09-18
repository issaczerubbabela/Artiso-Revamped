'use client';

import { useState, type CSSProperties } from 'react';
import { signIn, signOut, signUp } from '@artiso/api-client';
import { useAuthStore } from '@/state/auth-store';
import { PanelButton } from '@/workspace/PanelButton';

const INPUT_STYLE: CSSProperties = {
  minHeight: 'var(--touch-target-min)',
  padding: '0 var(--space-sm)',
  borderRadius: 'var(--radius-sm)',
  border: '1px solid var(--color-border)',
  background: 'var(--color-surface)',
  color: 'var(--color-ink)',
  fontFamily: 'var(--font-family-base)',
  fontSize: 'var(--font-body-size)',
};

// "Sign in to sync" is additive, never a wall (docs/architecture/08 /
// ki-cross-device-continuity): the app is fully usable signed-out, this
// panel is just how a device opts into sync.
export function AuthPanel() {
  const user = useAuthStore((s) => s.user);
  const [mode, setMode] = useState<'signIn' | 'signUp'>('signIn');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (user) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', flexWrap: 'wrap' }}>
        <span
          style={{ fontFamily: 'var(--font-family-base)', fontSize: 'var(--font-label-size)', color: 'var(--color-ink-muted)' }}
        >
          Signed in as {user.email}
        </span>
        <PanelButton onClick={() => void signOut()}>Sign out</PanelButton>
      </div>
    );
  }

  async function submit() {
    setError(null);
    setIsSubmitting(true);
    try {
      if (mode === 'signIn') await signIn(email, password);
      else await signUp(email, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)', maxWidth: 280 }}>
      <span
        style={{ fontFamily: 'var(--font-family-base)', fontSize: 'var(--font-label-size)', color: 'var(--color-ink-muted)' }}
      >
        Sign in to sync across devices
      </span>
      <input
        type="email"
        placeholder="Email"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        style={INPUT_STYLE}
      />
      <input
        type="password"
        placeholder="Password"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        style={INPUT_STYLE}
      />
      <div style={{ display: 'flex', gap: 'var(--space-sm)', flexWrap: 'wrap' }}>
        <PanelButton variant="primary" onClick={() => void submit()} disabled={isSubmitting || !email || !password}>
          {mode === 'signIn' ? 'Sign in' : 'Create account'}
        </PanelButton>
        <PanelButton onClick={() => setMode(mode === 'signIn' ? 'signUp' : 'signIn')}>
          {mode === 'signIn' ? 'Need an account?' : 'Have an account?'}
        </PanelButton>
      </div>
      {error ? (
        <span style={{ fontFamily: 'var(--font-family-base)', fontSize: 'var(--font-label-size)', color: 'var(--color-danger)' }}>
          {error}
        </span>
      ) : null}
    </div>
  );
}
