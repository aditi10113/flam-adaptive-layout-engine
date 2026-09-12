# Adaptive Layout Engine for Multi-Surface Ads

A TypeScript + React demonstration of a declarative, constraint-based adaptive ad layout engine.

## What this implements

- One surface-independent `AdSpec`.
- Typed `SurfaceProfile` objects for mobile portrait, mobile landscape, broadcast lower-third, square kiosk, and a deliberately constrained kiosk.
- A resolver that derives geometry from available width/height and constraints rather than using surface-specific CSS layout branches.
- Priority-aware degradation: optional lower-priority content can be dropped/truncated before headline and CTA.
- Safe-area and minimum-size validation.
- Collision and bounds checks.
- A clean `spec → resolver → resolved output → renderer` separation.

## Run

```bash
npm install
npm run dev
```

For a production build:

```bash
npm run build
npm run preview
```

## Algorithm

1. Validate the ad spec and surface profile.
2. Compute the usable rectangle from surface dimensions, safe-area insets, and ad padding.
3. Infer the composition from the usable aspect ratio.
4. Place preferred geometry while respecting minimum sizes and tap targets.
5. Check hard constraints: bounds, minimum dimensions, CTA target size, and collisions.
6. If infeasible, degrade optional content by ascending priority.
7. Truncate eligible body content before compromising headline/CTA.
8. Repair remaining collisions and return a typed `ResolvedLayout`.

The resolver does not inspect surface IDs and does not contain per-surface CSS breakpoints.

## Priority/degradation

Each element has a numeric priority and explicit degradation permissions.

- `headline`: priority 10, cannot drop or truncate.
- `cta`: priority 10, cannot drop or truncate.
- `price`: priority 7, optional.
- `body`: priority 4, can drop/truncate.
- `hero`: priority 3, can drop.
- `brand`: priority 1, required.

The numeric value is combined with explicit `canDrop`/`canTruncate` constraints so priority never silently overrides a hard requirement.

## TypeScript design

The core model lives in `src/engine/types.ts`.

`AdSpec` contains only content and layout constraints. `SurfaceProfile` contains environmental constraints. `ResolvedLayout` is the engine output and is the only data consumed by the renderer.

Runtime validation is in `src/engine/validate.ts`.

## Resolution flow

```text
AdSpec + SurfaceProfile
        ↓
    validation
        ↓
 usable safe-area rectangle
        ↓
 aspect-ratio-derived composition
        ↓
 preferred geometry + hard constraints
        ↓
 feasibility check
        ↓
 priority-based degradation
        ↓
 collision/bounds repair
        ↓
 ResolvedLayout
        ↓
 React renderer
```

## Deliberately constrained fifth surface

The `tiny-kiosk` profile is only 320×260 with touch minimums and `maxElements: 5`. It demonstrates graceful degradation under pressure.

## Limitations

- Text measurement is estimated using character-count heuristics rather than actual font metrics.
- Image content is represented by a renderer placeholder; the engine only reasons about its geometry.
- The demo renderer is React/CSS; the engine itself is renderer-independent.
- The current collision repair is intentionally lightweight and deterministic rather than a full mathematical optimizer.

## Bonus opportunities

- Canvas/SVG renderer using the same resolved output.
- Browser `measureText` integration.
- Animation between two `ResolvedLayout` states.
- Accessibility metadata generated from the resolved element tree.

## Time spent

Approximately 4–5 hours for the core engine, demo, validation, renderer, and documentation.


## Verification

The React entry point mounts `App` with `createRoot` into `#root`. Run `npm install`, then `npm run build` to verify the TypeScript and Vite production build, or `npm run dev` for the interactive demo.
