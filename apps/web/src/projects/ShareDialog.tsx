'use client';

import { useCallback, useEffect, useState } from 'react';
import type { Project, ProjectMember } from '@artiso/shared-types';
import { inviteProjectMember, listProjectMembers, removeProjectMember } from '@artiso/api-client';
import { PanelButton } from '@/workspace/PanelButton';
import { useAuthStore } from '@/state/auth-store';
import { ensureProjectOnServer } from '@/session/project-actions';

type InviteRole = 'editor' | 'viewer';

// Owner-only sharing (docs/phases/phase-8-collaboration-split-view.md):
// invite an existing Artiso account by email as an editor (can change the
// reference) or a viewer (read-only), and see or remove who has access. The
// server decides what's allowed; this only surfaces its answers.
export function ShareDialog({ project, onClose }: { project: Project; onClose: () => void }) {
  const currentUserId = useAuthStore((s) => s.user?.id);
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<InviteRole>('viewer');
  const [error, setError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setMembers(await listProjectMembers(project.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load who has access.');
    }
  }, [project.id]);

  useEffect(() => {
    // Listing members needs the project on the server too; a never-synced
    // project just shows no one yet, so a failure here isn't worth surfacing.
    void ensureProjectOnServer(project)
      .then(load)
      .catch(() => {});
  }, [project, load]);

  async function handleInvite() {
    if (!email.trim()) return;
    setIsBusy(true);
    setError(null);
    try {
      await ensureProjectOnServer(project);
      await inviteProjectMember(project.id, email, role);
      setEmail('');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not share this project.');
    } finally {
      setIsBusy(false);
    }
  }

  async function handleRemove(member: ProjectMember) {
    setIsBusy(true);
    setError(null);
    try {
      await removeProjectMember(project.id, member.userId);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not remove that person.');
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-label={`Share ${project.name}`}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.45)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'var(--space-md)',
        zIndex: 10,
      }}
      onClick={onClose}
    >
      <div
        onClick={(event) => event.stopPropagation()}
        style={{
          background: 'var(--color-surface-raised)',
          borderRadius: 'var(--radius-md)',
          boxShadow: 'var(--shadow-dock)',
          padding: 'var(--space-lg)',
          width: '100%',
          maxWidth: 420,
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-md)',
          fontFamily: 'var(--font-family-base)',
          color: 'var(--color-ink)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 'var(--space-sm)' }}>
          <span style={{ fontSize: 'var(--font-heading-size)', fontWeight: 'var(--font-heading-weight)' }}>
            Share “{project.name}”
          </span>
          <PanelButton onClick={onClose}>Done</PanelButton>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-xs)' }}>
          <span style={{ fontSize: 'var(--font-label-size)', color: 'var(--color-ink-muted)' }}>Who has access</span>
          {members.map((member) => (
            <div
              key={member.userId}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-sm)' }}
            >
              <span style={{ fontSize: 'var(--font-body-size)', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {member.email}
                {member.userId === currentUserId ? ' (you)' : ''}
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-xs)', flexShrink: 0 }}>
                <span style={{ fontSize: 'var(--font-label-size)', color: 'var(--color-ink-muted)' }}>{member.role}</span>
                {member.role !== 'owner' ? (
                  <PanelButton
                    aria-label={`Remove ${member.email}`}
                    disabled={isBusy}
                    onClick={() => void handleRemove(member)}
                  >
                    Remove
                  </PanelButton>
                ) : null}
              </span>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
          <span style={{ fontSize: 'var(--font-label-size)', color: 'var(--color-ink-muted)' }}>
            Invite someone with an Artiso account
          </span>
          <input
            type="email"
            value={email}
            placeholder="name@example.com"
            aria-label="Email to invite"
            onChange={(event) => setEmail(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') void handleInvite();
            }}
            style={{
              minHeight: 'var(--touch-target-min)',
              padding: '0 var(--space-sm)',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--color-border)',
              background: 'var(--color-surface)',
              color: 'var(--color-ink)',
              fontFamily: 'var(--font-family-base)',
              fontSize: 'var(--font-body-size)',
            }}
          />
          <div style={{ display: 'flex', gap: 'var(--space-sm)', flexWrap: 'wrap' }}>
            <PanelButton active={role === 'viewer'} onClick={() => setRole('viewer')}>
              Can view
            </PanelButton>
            <PanelButton active={role === 'editor'} onClick={() => setRole('editor')}>
              Can edit
            </PanelButton>
            <PanelButton variant="primary" disabled={isBusy || !email.trim()} onClick={() => void handleInvite()}>
              Invite
            </PanelButton>
          </div>
        </div>

        {error ? (
          <span role="alert" style={{ fontSize: 'var(--font-label-size)', color: 'var(--color-danger)' }}>
            {error}
          </span>
        ) : null}
      </div>
    </div>
  );
}
