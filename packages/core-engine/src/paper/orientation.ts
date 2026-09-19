import type { Operation } from '@artiso/shared-types';
import { computeGeometryDimensions, type Dimensions } from '../geometry';

type OrientationOperation = Extract<Operation, { type: 'rotate' | 'flip' }>;

/**
 * The rotate/flip operations of an EditStack, in order. Since the drawing-grid
 * overhaul, crop is no longer an EditStack operation: rotate/flip alone define
 * the "oriented original" that `Reference.crop` is measured in.
 */
export function orientationOps(ops: readonly Operation[]): OrientationOperation[] {
  return ops.filter((op): op is OrientationOperation => op.type === 'rotate' || op.type === 'flip');
}

/** The size of the original after rotate/flip (any legacy crop ops are ignored). */
export function orientedDimensions(source: Dimensions, ops: readonly Operation[]): Dimensions {
  return computeGeometryDimensions(source, orientationOps(ops));
}
