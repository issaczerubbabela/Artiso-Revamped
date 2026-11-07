import { GestureEngine, type GestureEngineOptions } from './gesture-engine';
import type { Point } from './viewport';

// WebKit's GestureEvent (not in the DOM typings): cumulative since gesturestart.
interface SafariGestureEvent extends UIEvent {
  clientX: number;
  clientY: number;
  scale: number;
  rotation: number;
}

export interface InputControllerOptions extends GestureEngineOptions {
  element: HTMLElement;
}

// The DOM side of canvas input, using the Pointer Events API only -- no
// separate touch/mouse code paths (see
// .agents/workflows/build-canvas-zoom-pan-gestures.md). It turns pointer and
// wheel events into container-local CSS px and hands them to the
// GestureEngine, which decides what they do to the view.
export class InputController {
  readonly engine: GestureEngine;

  private readonly handlePointerDown = (event: PointerEvent) => {
    // Capture keeps a drag tracking after the finger leaves the element, but it
    // is an enhancement: setPointerCapture throws (NotFoundError) for a pointer
    // that is already gone, e.g. a quick tap racing a pointercancel on touch,
    // and that must not stop the pointer from being tracked for pan/pinch.
    try {
      (event.target as Element | null)?.setPointerCapture?.(event.pointerId);
    } catch {
      // Not capturable; gestures still work while the pointer stays over the canvas.
    }
    this.engine.pointerDown(event.pointerId, this.localPoint(event.clientX, event.clientY), event.pointerType);
  };

  private readonly handlePointerMove = (event: PointerEvent) => {
    // A hovering mouse is not a gesture; skip measuring the element for it.
    if (!this.engine.isTracking(event.pointerId)) return;
    this.engine.pointerMove(event.pointerId, this.localPoint(event.clientX, event.clientY), { shiftKey: event.shiftKey });
  };

  private readonly handlePointerUp = (event: PointerEvent) => {
    this.engine.pointerUp(event.pointerId);
  };

  private readonly handleWheel = (event: WheelEvent) => {
    event.preventDefault();
    // Line/page deltas (Firefox, some mice) are scaled to roughly pixels.
    const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? 400 : 1;
    this.engine.wheel(this.localPoint(event.clientX, event.clientY), event.deltaY * unit, { ctrlKey: event.ctrlKey });
  };

  // Safari's trackpad pinch/rotate arrives as non-standard gesture events
  // carrying a cumulative scale and rotation. On iPad the same events also
  // accompany a two-finger touch; the engine ignores them while it is
  // tracking pointers, so a touch gesture is never handled twice.
  private readonly handleGestureStart = (event: Event) => {
    event.preventDefault();
    const g = event as SafariGestureEvent;
    this.engine.trackpadGestureStart(this.localPoint(g.clientX, g.clientY));
  };

  private readonly handleGestureChange = (event: Event) => {
    event.preventDefault();
    const g = event as SafariGestureEvent;
    this.engine.trackpadGestureChange(this.localPoint(g.clientX, g.clientY), g.scale, g.rotation);
  };

  private readonly handleGestureEnd = (event: Event) => {
    event.preventDefault();
    this.engine.trackpadGestureEnd();
  };

  constructor(private readonly options: InputControllerOptions) {
    this.engine = new GestureEngine(options);
    const { element } = options;
    element.addEventListener('pointerdown', this.handlePointerDown);
    element.addEventListener('pointermove', this.handlePointerMove);
    element.addEventListener('pointerup', this.handlePointerUp);
    element.addEventListener('pointercancel', this.handlePointerUp);
    element.addEventListener('wheel', this.handleWheel, { passive: false });
    element.addEventListener('gesturestart', this.handleGestureStart);
    element.addEventListener('gesturechange', this.handleGestureChange);
    element.addEventListener('gestureend', this.handleGestureEnd);
  }

  dispose(): void {
    const { element } = this.options;
    element.removeEventListener('pointerdown', this.handlePointerDown);
    element.removeEventListener('pointermove', this.handlePointerMove);
    element.removeEventListener('pointerup', this.handlePointerUp);
    element.removeEventListener('pointercancel', this.handlePointerUp);
    element.removeEventListener('wheel', this.handleWheel);
    element.removeEventListener('gesturestart', this.handleGestureStart);
    element.removeEventListener('gesturechange', this.handleGestureChange);
    element.removeEventListener('gestureend', this.handleGestureEnd);
    this.engine.dispose();
  }

  private localPoint(clientX: number, clientY: number): Point {
    const rect = this.options.element.getBoundingClientRect();
    return { x: clientX - rect.left, y: clientY - rect.top };
  }
}
