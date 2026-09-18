'use client';

import { useEffect, useState } from 'react';
import type { Project } from '@artiso/shared-types';
import { getAssetBlob, listProjects } from '@artiso/api-client';
import { AuthPanel } from '@/auth/AuthPanel';
import { PanelButton } from '@/workspace/PanelButton';
import { importReference } from '@/session/import-reference';
import { openProject } from '@/session/open-project';
import { deleteProjectAction, renameProjectAction } from '@/session/project-actions';

// Phase 2's Home/Projects screen (docs/phases/phase-2-cloud-projects-sync.md):
// list, create, rename, delete, thumbnail. Multi-reference-per-project
// browsing isn't needed yet (Phase 6), so this is really a flat list of
// reference photos rather than a folder structure.
export function ProjectsScreen() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    setIsLoading(true);
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

  async function handleDelete(project: Project) {
    if (!window.confirm(`Delete "${project.name}"? This can't be undone.`)) return;
    await deleteProjectAction(project.id);
    void refresh();
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh', background: 'var(--color-surface)' }}>
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
              fontFamily: 'var(--font-family-base)',
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
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ProjectCard({
  project,
  onOpen,
  onRename,
  onDelete,
}: {
  project: Project;
  onOpen: () => void;
  onRename: () => void;
  onDelete: () => void;
}) {
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let url: string | null = null;
    if (project.thumbnailAssetId) {
      void getAssetBlob(project.thumbnailAssetId, 'thumbnail').then((blob) => {
        if (cancelled || !blob) return;
        url = URL.createObjectURL(blob);
        setThumbnailUrl(url);
      });
    }
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
        <div style={{ display: 'flex', gap: 'var(--space-xs)' }}>
          <PanelButton onClick={onRename}>Rename</PanelButton>
          <PanelButton onClick={onDelete}>Delete</PanelButton>
        </div>
      </div>
    </div>
  );
}
