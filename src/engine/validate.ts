import type { AdSpec, SurfaceProfile } from './types';

export function validateAdSpec(spec: AdSpec): string[] {
  const errors: string[] = [];
  if (!spec.id) errors.push('Ad spec must have an id.');
  if (spec.padding < 0 || spec.spacing < 0) errors.push('Padding and spacing must be non-negative.');

  const ids = new Set<string>();
  for (const element of spec.elements) {
    if (ids.has(element.id)) errors.push(`Duplicate element id: ${element.id}`);
    ids.add(element.id);
    if (element.minWidth <= 0 || element.minHeight <= 0) {
      errors.push(`${element.id}: minimum dimensions must be positive.`);
    }
    if (element.priority < 0) errors.push(`${element.id}: priority cannot be negative.`);
    if (element.kind === 'button' && element.role !== 'cta') {
      errors.push(`${element.id}: buttons must use the cta role.`);
    }
  }
  return errors;
}

export function validateSurface(surface: SurfaceProfile): string[] {
  const errors: string[] = [];
  if (surface.width <= 0 || surface.height <= 0) errors.push('Surface dimensions must be positive.');
  const inset = surface.safeArea;
  if (inset.top < 0 || inset.right < 0 || inset.bottom < 0 || inset.left < 0) {
    errors.push('Safe-area insets cannot be negative.');
  }
  if (inset.left + inset.right >= surface.width || inset.top + inset.bottom >= surface.height) {
    errors.push('Safe area leaves no usable surface.');
  }
  if (surface.minTapTarget < 0 || surface.minTextSize <= 0) {
    errors.push('Surface minimums are invalid.');
  }
  return errors;
}
