import { DevDiagnostics } from './dev-diagnostics';

// Deliberately near-blank in Phase 0 — no product features exist yet. This
// is only a proof that the app boots and the design tokens resolve; the
// canvas-first workspace shell (see docs/architecture/06) is Phase 1 work.
export default function HomePage() {
  return (
    <main
      style={{
        minHeight: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 'var(--space-sm)',
      }}
    >
      <h1
        style={{
          fontFamily: 'var(--font-family-base)',
          fontSize: 'var(--font-heading-size)',
          fontWeight: 'var(--font-heading-weight)',
          margin: 0,
        }}
      >
        Drawing Grid
      </h1>
      {process.env.NODE_ENV === 'development' ? <DevDiagnostics /> : null}
    </main>
  );
}
