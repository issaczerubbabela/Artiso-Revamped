'use client';

import { useEffect, useState } from 'react';
import type { Project } from '@artiso/shared-types';
import { downloadAndCacheAsset, getAssetBlob, listProjects } from '@artiso/api-client';
import { AuthPanel } from '@/auth/AuthPanel';
import { PanelButton } from '@/workspace/PanelButton';
import { importReference } from '@/session/import-reference';
import { openProject } from '@/session/open-project';
import { deleteProjectAction, leaveProjectAction, renameProjectAction } from '@/session/project-actions';
import { refreshProjectsFromServer } from '@/session/auth-bootstrap';
import { useAuthStore } from '@/state/auth-store';
import { useDisplayStore } from '@/state/display-store';
import { ShareDialog } from './ShareDialog';

// Phase 2's Home/Projects screen (docs/phases/phase-2-cloud-projects-sync.md):
// list, create, rename, delete, thumbnail. Multi-reference-per-project
// browsing isn't needed yet (Phase 6), so this is really a flat list of
// reference photos rather than a folder structure.
export function ProjectsScreen() {
  const canvasSurface = useDisplayStore((s) => s.canvasSurface);
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sharing, setSharing] = useState<Project | null>(null);
  const isSignedIn = useAuthStore((s) => s.user !== null);

  // `silent` skips the loading flash for background refreshes (focus/timer).
  async function refresh(silent = false) {
    if (!silent) setIsLoading(true);
    try {
      const all = await listProjects();
      setProjects(all.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1)));
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  // Projects shared with the user appear (and lose access) without a
  // reload: pull on focus and on a timer, same cadence as the workspace.
  useEffect(() => {
    const pull = () => {
      if (document.visibilityState === 'hidden') return;
      void refreshProjectsFromServer().then(() => refresh(true));
    };
    pull();
    const interval = setInterval(pull, 30_000);
    window.addEventListener('focus', pull);
    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', pull);
    };
  }, []);

  async function handleOpen(project: Project) {
    setError(null);
    try {
      await openProject(project);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not open this project.');
    }
  }

  async function handleRename(project: Project) {
    const name = window.prompt('Rename reference', project.name);
    if (!name || name === project.name) return;
    await renameProjectAction(project.id, name);
    void refresh();
  }

  async function handleLeave(project: Project) {
    if (!window.confirm(`Leave "${project.name}"? You'll lose access until the owner shares it again.`)) return;
    setError(null);
    try {
      await leaveProjectAction(project);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not leave this project.');
    }
    void refresh();
  }

  async function handleDelete(project: Project) {
    if (!window.confirm(`Delete "${project.name}"? This can't be undone.`)) return;
    await deleteProjectAction(project.id);
    void refresh();
  }

  return (
    <div
      className="surface surface--page"
      data-surface={canvasSurface}
      style={{ display: 'flex', flexDirection: 'column', height: '100dvh' }}
    >
      <header
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          gap: 'var(--space-md)',
          padding: 'var(--space-lg)',
        }}
      >
        <div>
          <h1
            style={{
              fontFamily: 'var(--font-family-heading)',
              fontSize: 'var(--font-heading-size)',
              fontWeight: 'var(--font-heading-weight)',
              margin: 0,
            }}
          >
            Artiso
          </h1>
          <span
            style={{ fontFamily: 'var(--font-family-base)', fontSize: 'var(--font-body-size)', color: 'var(--color-ink-muted)' }}
          >
            Your reference photos
          </span>
        </div>
        <AuthPanel />
      </header>

      <div style={{ padding: '0 var(--space-lg) var(--space-lg)' }}>
        <PanelButton variant="primary" onClick={() => void importReference()}>
          New reference
        </PanelButton>
      </div>

      {error ? (
        <div
          style={{
            padding: '0 var(--space-lg) var(--space-md)',
            color: 'var(--color-danger)',
            fontFamily: 'var(--font-family-base)',
            fontSize: 'var(--font-label-size)',
          }}
        >
          {error}
        </div>
      ) : null}

      <div style={{ flex: 1, overflowY: 'auto', padding: '0 var(--space-lg) var(--space-lg)' }}>
        {isLoading ? null : projects.length === 0 ? (
          <p style={{ fontFamily: 'var(--font-family-base)', color: 'var(--color-ink-muted)' }}>
            No references yet — import a photo to get started.
          </p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: 'var(--space-md)' }}>
            {projects.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                onOpen={() => void handleOpen(project)}
                onRename={() => void handleRename(project)}
                onDelete={() => void handleDelete(project)}
                onLeave={() => void handleLeave(project)}
                onShare={isSignedIn ? () => setSharing(project) : undefined}
              />
            ))}
          </div>
        )}
      </div>
      {sharing ? <ShareDialog project={sharing} onClose={() => setSharing(null)} /> : null}
    </div>
  );
}

function ProjectCard({
  project,
  onOpen,
  onRename,
  onDelete,
  onLeave,
  onShare,
}: {
  project: Project;
  onOpen: () => void;
  onRename: () => void;
  onDelete: () => void;
  onLeave: () => void;
  // Undefined when signed out: sharing needs an account.
  onShare?: () => void;
}) {
  const isOwner = project.role === 'owner';
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let url: string | null = null;

    async function loadThumbnail() {
      const assetId = project.thumbnailAssetId;
      if (!assetId) return;
      // A project pulled from another device (mergeRemoteProjects on
      // sign-in) has metadata but no downloaded bytes yet -- the full
      // original is only fetched when the project is actually opened, so
      // the card falls back to downloading here rather than showing a
      // permanent "No preview" for anything not opened yet.
      let blob = await getAssetBlob(assetId, 'thumbnail');
      if (!blob) {
        await downloadAndCacheAsset(assetId).catch(() => {});
        blob = await getAssetBlob(assetId, 'thumbnail');
      }
      if (cancelled || !blob) return;
      url = URL.createObjectURL(blob);
      setThumbnailUrl(url);
    }

    void loadThumbnail();
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [project.thumbnailAssetId]);

  return (
    <div
      style={{
        background: 'var(--color-surface-raised)',
        borderRadius: 'var(--radius-md)',
        overflow: 'hidden',
        boxShadow: 'var(--shadow-dock)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <button
        data-testid="project-card-open"
        onClick={onOpen}
        style={{
          border: 'none',
          background: 'var(--color-surface)',
          cursor: 'pointer',
          padding: 0,
          aspectRatio: '4 / 3',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {thumbnailUrl ? (
          // Plain <img>, not next/image: this is a local blob: URL, and the
          // app is a static export with no image-optimization server anyway.
          <img src={thumbnailUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <span
            style={{ color: 'var(--color-ink-muted)', fontFamily: 'var(--font-family-base)', fontSize: 'var(--font-label-size)' }}
          >
            No preview
          </span>
        )}
      </button>
      <div style={{ padding: 'var(--space-sm)', display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
        <span
          style={{
            fontFamily: 'var(--font-family-base)',
            fontSize: 'var(--font-body-size)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {project.name}
        </span>
        {isOwner ? null : (
          <span
            data-testid="project-role"
            style={{ fontFamily: 'var(--font-family-base)', fontSize: 'var(--font-label-size)', color: 'var(--color-ink-muted)' }}
          >
            Shared with you · {project.role === 'editor' ? 'can edit' : 'view only'}
          </span>
        )}
        <div style={{ display: 'flex', gap: 'var(--space-xs)', flexWrap: 'wrap' }}>
          {isOwner ? (
            <>
              <PanelButton onClick={onRename}>Rename</PanelButton>
              {onShare ? <PanelButton onClick={onShare}>Share</PanelButton> : null}
              <PanelButton onClick={onDelete}>Delete</PanelButton>
            </>
          ) : (
            <PanelButton onClick={onLeave}>Leave</PanelButton>
          )}
        </div>
      </div>
    </div>
  );
}
