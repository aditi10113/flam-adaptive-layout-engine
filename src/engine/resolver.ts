import type {
  AdElement,
  AdSpec,
  Rect,
  ResolvedElement,
  ResolvedLayout,
  ResolutionDecision,
  SurfaceProfile,
} from './types';
import { validateAdSpec, validateSurface } from './validate';

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function priority(element: AdElement): number {
  return element.priority;
}

function overlaps(a: Rect, b: Rect): boolean {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}

function fitTextHeight(element: AdElement, width: number, fontSize: number): number {
  const text = element.content;
  const charsPerLine = Math.max(8, Math.floor(width / Math.max(fontSize * 0.55, 1)));
  const lines = Math.ceil(text.length / charsPerLine);
  return Math.max(element.minHeight, Math.min(element.preferredHeight ?? fontSize * 1.35 * lines, fontSize * 1.35 * lines));
}

function makeBaseElement(
  element: AdElement,
  surface: SurfaceProfile,
  x: number,
  y: number,
  width: number,
  height: number,
): ResolvedElement {
  const minText = element.kind === 'text' || element.kind === 'button'
    ? Math.max(surface.minTextSize, 12)
    : 12;

  return {
    ...element,
    rect: { x, y, width, height },
    fontSize: element.kind === 'text' || element.kind === 'button'
      ? Math.max(minText, Math.min(48, height * 0.48))
      : minText,
    visible: true,
    truncated: false,
  };
}

/**
 * Surface-agnostic constraint resolver.
 *
 * It first builds a preferred composition using the surface aspect ratio,
 * then validates hard constraints. If the composition is infeasible it
 * degrades lower-priority optional content before touching headline/CTA.
 */
export function resolveLayout(spec: AdSpec, surface: SurfaceProfile): ResolvedLayout {
  const specErrors = validateAdSpec(spec);
  const surfaceErrors = validateSurface(surface);

  const warnings = [...specErrors, ...surfaceErrors];
  const left = surface.safeArea.left + spec.padding;
  const top = surface.safeArea.top + spec.padding;
  const right = surface.width - surface.safeArea.right - spec.padding;
  const bottom = surface.height - surface.safeArea.bottom - spec.padding;
  const usableWidth = Math.max(1, right - left);
  const usableHeight = Math.max(1, bottom - top);
  const ratio = usableWidth / usableHeight;

  const active: ResolvedElement[] = [];
  const dropped: string[] = [];
  const truncated: string[] = [];
  const decisions: ResolutionDecision[] = [];

  // Start with all elements; constraints decide what must be degraded.
  for (const e of spec.elements) {
    active.push(makeBaseElement(e, surface, 0, 0, e.minWidth, e.minHeight));
  }

  const dropByPriority = () => {
    const candidates = active
      .filter(e => e.canDrop && e.role !== 'cta' && e.role !== 'headline')
      .sort((a, b) => priority(a) - priority(b));
    const candidate = candidates[0];
    if (!candidate) return false;
    const index = active.findIndex(e => e.id === candidate.id);
    if (index >= 0) active.splice(index, 1);
    dropped.push(candidate.id);
    decisions.push({
      elementId: candidate.id,
      action: 'dropped',
      priority: candidate.priority,
      reason: surface.maxElements && active.length >= surface.maxElements
        ? `Surface allows at most ${surface.maxElements} elements; priority ${candidate.priority} content is optional and was removed to preserve higher-priority content.`
        : 'The preferred geometry could not fit the safe area, so the lowest-priority optional element was removed first.',
    });
    return true;
  };

  // A low-height surface benefits from a horizontal composition.
  const horizontal = ratio >= 1.65;
  const wide = ratio >= 2.4;

  const brand = active.find(e => e.role === 'brand');
  const hero = active.find(e => e.role === 'image');
  const headline = active.find(e => e.role === 'headline');
  const body = active.find(e => e.role === 'body');
  const price = active.find(e => e.role === 'price');
  const cta = active.find(e => e.role === 'cta');

  if (horizontal) {
    // Horizontal surfaces use a left text rail and right visual rail.
    const visualWidth = hero ? clamp(usableWidth * (wide ? 0.32 : 0.38), hero.minWidth, usableWidth * 0.48) : 0;
    const textWidth = Math.max(1, usableWidth - visualWidth - (hero ? spec.spacing : 0));

    if (brand) Object.assign(brand.rect, { x: left, y: top, width: Math.min(120, textWidth), height: Math.max(24, brand.minHeight) });
    if (hero) Object.assign(hero.rect, {
      x: right - visualWidth,
      y: top,
      width: visualWidth,
      height: Math.min(usableHeight, Math.max(hero.minHeight, usableHeight * 0.78)),
    });

    let y = top + (brand ? 34 : 0);
    if (headline) {
      const h = clamp(horizontal ? usableHeight * 0.28 : 72, headline.minHeight, 100);
      Object.assign(headline.rect, { x: left, y, width: textWidth, height: h });
      headline.fontSize = Math.max(surface.minTextSize, Math.min(44, h * 0.55));
      y += h + spec.spacing;
    }
    if (body) {
      const h = clamp(fitTextHeight(body, textWidth, Math.max(surface.minTextSize, 18)), body.minHeight, usableHeight * 0.25);
      Object.assign(body.rect, { x: left, y, width: textWidth, height: h });
      body.fontSize = Math.max(surface.minTextSize, Math.min(26, h * 0.42));
      y += h + spec.spacing;
    }
    if (price) {
      const h = clamp(40, price.minHeight, 60);
      Object.assign(price.rect, { x: left, y, width: Math.min(textWidth, 220), height: h });
      price.fontSize = Math.max(surface.minTextSize, 20);
    }
    if (cta) {
      const w = Math.max(cta.preferredWidth ?? 180, surface.minTapTarget);
      const h = Math.max(cta.preferredHeight ?? 52, surface.minTapTarget);
      Object.assign(cta.rect, {
        x: Math.min(right - w, left + Math.max(0, textWidth - w)),
        y: bottom - h,
        width: Math.min(w, usableWidth),
        height: Math.min(h, usableHeight),
      });
      cta.fontSize = Math.max(surface.minTextSize, 18);
    }
  } else {
    // Portrait/square surfaces use a vertical flow.
    let y = top;
    if (brand) {
      const h = Math.max(brand.minHeight, 28);
      Object.assign(brand.rect, { x: left, y, width: Math.min(140, usableWidth), height: h });
      y += h + spec.spacing;
    }
    if (hero) {
      const h = clamp(hero.preferredHeight ?? usableHeight * 0.30, hero.minHeight, usableHeight * 0.40);
      const w = clamp(hero.preferredWidth ?? usableWidth * 0.75, hero.minWidth, usableWidth);
      Object.assign(hero.rect, { x: left + (usableWidth - w) / 2, y, width: w, height: h });
      y += h + spec.spacing;
    }
    if (headline) {
      const h = clamp(headline.preferredHeight ?? 72, headline.minHeight, usableHeight * 0.18);
      Object.assign(headline.rect, { x: left, y, width: usableWidth, height: h });
      headline.fontSize = Math.max(surface.minTextSize, Math.min(40, h * 0.52));
      y += h + spec.spacing;
    }
    if (body) {
      const h = clamp(fitTextHeight(body, usableWidth, surface.minTextSize + 2), body.minHeight, usableHeight * 0.16);
      Object.assign(body.rect, { x: left, y, width: usableWidth, height: h });
      body.fontSize = Math.max(surface.minTextSize, Math.min(24, h * 0.4));
      y += h + spec.spacing;
    }
    if (price) {
      const h = Math.max(price.minHeight, 38);
      Object.assign(price.rect, { x: left, y, width: usableWidth, height: h });
      price.fontSize = Math.max(surface.minTextSize, 20);
      y += h + spec.spacing;
    }
    if (cta) {
      const h = Math.max(cta.preferredHeight ?? 52, surface.minTapTarget);
      const w = Math.min(Math.max(cta.preferredWidth ?? usableWidth, surface.minTapTarget), usableWidth);
      Object.assign(cta.rect, { x: left + (usableWidth - w) / 2, y: bottom - h, width: w, height: h });
      cta.fontSize = Math.max(surface.minTextSize, 18);
    }
  }

  const outOfBounds = () => active.some(e =>
    e.rect.x < left ||
    e.rect.y < top ||
    e.rect.x + e.rect.width > right ||
    e.rect.y + e.rect.height > bottom ||
    e.rect.width < e.minWidth ||
    e.rect.height < e.minHeight ||
    (e.role === 'cta' && (e.rect.width < surface.minTapTarget || e.rect.height < surface.minTapTarget))
  );

  // Drop optional content until the hard geometry constraints become feasible.
  while (outOfBounds() && active.some(e => e.canDrop && e.role !== 'cta' && e.role !== 'headline')) {
    if (!dropByPriority()) break;

    // Re-run a compact vertical/horizontal packing after a degradation.
    // This is deliberately role-independent: remaining constraints determine packing.
    const remaining = [...active].sort((a, b) => a.rect.y - b.rect.y);
    let cursor = top;
    for (const e of remaining) {
      const h = Math.min(e.rect.height, bottom - cursor);
      e.rect.y = cursor;
      e.rect.height = Math.max(e.minHeight, h);
      e.rect.x = clamp(e.rect.x, left, right - e.rect.width);
      cursor += e.rect.height + spec.spacing;
    }
  }

  // If optional text still causes pressure, truncate before dropping higher-priority content.
  if (outOfBounds()) {
    const truncCandidate = active
      .filter(e => e.canTruncate && e.role !== 'headline' && e.role !== 'cta')
      .sort((a, b) => priority(a) - priority(b))[0];

    if (truncCandidate) {
      truncCandidate.truncated = true;
      truncCandidate.reason = 'Truncated to preserve higher-priority constraints.';
      truncCandidate.rect.height = Math.max(truncCandidate.minHeight, Math.min(truncCandidate.rect.height, bottom - truncCandidate.rect.y));
      truncated.push(truncCandidate.id);
      decisions.push({
        elementId: truncCandidate.id,
        action: 'truncated',
        priority: truncCandidate.priority,
        reason: 'Available space was insufficient, so this lower-priority text was truncated before compromising the headline or CTA.',
      });
    }
  }

  // Final collision repair: only move lower-priority elements downward where possible.
  const sorted = [...active].sort((a, b) => a.rect.y - b.rect.y);
  for (let i = 0; i < sorted.length; i++) {
    for (let j = i + 1; j < sorted.length; j++) {
      const a = sorted[i];
      const b = sorted[j];
      if (overlaps(a.rect, b.rect)) {
        const desired = a.rect.y + a.rect.height + spec.spacing;
        if (priority(b) <= priority(a) && b.canDrop) {
          b.rect.y = desired;
        } else {
          a.rect.y = Math.max(top, b.rect.y - a.rect.height - spec.spacing);
        }
      }
    }
  }

  const max = surface.maxElements;
  if (max && active.length > max) {
    while (active.length > max) {
      if (!dropByPriority()) break;
    }
  }

  const feasible = !outOfBounds() && active.length <= (max ?? Number.POSITIVE_INFINITY) && active.every((e, i) =>
    active.every((other, j) => i === j || !overlaps(e.rect, other.rect))
  );

  if (!feasible) warnings.push('Surface remains constrained after allowed degradation; hard-priority elements were preserved.');

  return {
    surface,
    elements: active,
    report: {
      surfaceId: surface.id,
      feasible,
      dropped,
      truncated,
      decisions,
      warnings,
    },
  };
}
