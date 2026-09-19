'use client';

import { NAMED_PAPER_PRESETS, customPaper, formatLength, paperFor, swapOrientation, toMm } from '@artiso/core-engine';
import type { PaperPreset, Unit } from '@artiso/shared-types';
import { NumberField, Segmented, Select, labelStyle, readoutStyle } from '@/components/controls';
import { PanelButton } from '@/workspace/PanelButton';
import { useDisplayStore } from '@/state/display-store';
import { useWorkspaceStore } from '@/state/workspace-store';

const PRESET_OPTIONS: readonly { value: PaperPreset; label: string }[] = [
  ...NAMED_PAPER_PRESETS.map((preset) => ({ value: preset, label: preset })),
  { value: 'custom', label: 'Custom' },
];

const UNIT_OPTIONS: readonly { value: Unit; label: string }[] = [
  { value: 'mm', label: 'Millimetres (mm)' },
  { value: 'cm', label: 'Centimetres (cm)' },
  { value: 'in', label: 'Inches (in)' },
  { value: 'px', label: 'Pixels (px)' },
];

const ORIENTATION_OPTIONS = [
  { value: 'portrait', label: 'Portrait' },
  { value: 'landscape', label: 'Landscape' },
] as const;

// Spec §4, verbatim: shown next to the DPI field whenever the unit is pixels.
export const DPI_EXPLANATION =
  "Pixels aren't a physical size. DPI (dots per inch) tells the app how many pixels equal one inch of paper. At 300 DPI, 300 px = 1 inch. A higher DPI gives a smaller physical size for the same pixels. If unsure, leave it at 300.";

const DPI_HELP_ID = 'dpi-explanation';

// Step 2-3 of the workflow (Grid-Feature-Spec.md §2): choose the paper, then
// frame the photo on it. The paper controls are here; the framing itself is on
// the canvas -- a fixed paper-shaped window with the image panned and zoomed
// beneath it. Everything is edited as a draft and written back when the tool
// is left, so a paper and a crop of a different shape are never saved together.
export function PaperCropPanel() {
  const draft = useWorkspaceStore((s) => s.framingDraft);
  const setDraftPaper = useWorkspaceStore((s) => s.setDraftPaper);
  const resetDraftCrop = useWorkspaceStore((s) => s.resetDraftCrop);
  const setToolMode = useWorkspaceStore((s) => s.setToolMode);
  const unit = useDisplayStore((s) => s.unit);
  const dpi = useDisplayStore((s) => s.dpi);
  const setUnit = useDisplayStore((s) => s.setUnit);
  const setDpi = useDisplayStore((s) => s.setDpi);

  if (!draft) return null;
  const { paper } = draft;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
      <Select
        label="Paper size"
        value={paper.preset}
        options={PRESET_OPTIONS}
        onChange={(preset) =>
          setDraftPaper(
            preset === 'custom' ? customPaper(paper.widthMm, paper.heightMm) : paperFor(preset, paper.orientation),
          )
        }
      />

      <Segmented
        label="Orientation"
        value={paper.orientation}
        options={ORIENTATION_OPTIONS}
        onChange={(orientation) => {
          if (orientation !== paper.orientation) setDraftPaper(swapOrientation(paper));
        }}
      />

      <Select label="Units" value={unit} options={UNIT_OPTIONS} onChange={setUnit} />

      {unit === 'px' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-xs)' }}>
          <NumberField label="DPI" value={dpi} onCommit={setDpi} format={(v) => String(Math.round(v * 100) / 100)} describedBy={DPI_HELP_ID} />
          <p id={DPI_HELP_ID} style={{ ...labelStyle, textTransform: 'none', letterSpacing: 0, margin: 0, lineHeight: 1.4 }}>
            {DPI_EXPLANATION}
          </p>
        </div>
      ) : null}

      {paper.preset === 'custom' ? (
        <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <NumberField
              label="Width"
              value={paper.widthMm}
              format={(mm) => formatLength(mm, unit, dpi)}
              suffix={unit}
              onCommit={(v) => setDraftPaper(customPaper(toMm(v, unit, dpi), paper.heightMm))}
            />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <NumberField
              label="Height"
              value={paper.heightMm}
              format={(mm) => formatLength(mm, unit, dpi)}
              suffix={unit}
              onCommit={(v) => setDraftPaper(customPaper(paper.widthMm, toMm(v, unit, dpi)))}
            />
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <span style={labelStyle}>Size</span>
          <span style={readoutStyle}>
            {formatLength(paper.widthMm, unit, dpi)} × {formatLength(paper.heightMm, unit, dpi)} {unit}
          </span>
        </div>
      )}

      <p style={{ ...labelStyle, textTransform: 'none', letterSpacing: 0, margin: 0, lineHeight: 1.4 }}>
        Drag and zoom the photo to frame it. The window stays the shape of the paper.
      </p>

      <div style={{ display: 'flex', gap: 'var(--space-sm)', flexWrap: 'wrap' }}>
        <PanelButton variant="primary" onClick={() => setToolMode('idle')}>
          Done
        </PanelButton>
        <PanelButton onClick={resetDraftCrop}>Reset framing</PanelButton>
      </div>
    </div>
  );
}
