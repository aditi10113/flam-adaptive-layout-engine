export type ElementRole =
  | 'brand'
  | 'image'
  | 'headline'
  | 'body'
  | 'price'
  | 'cta';

export type ElementKind = 'text' | 'image' | 'button' | 'logo';

export type InputMode = 'touch' | 'remote' | 'pointer';

export interface Insets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface AdElement {
  id: string;
  role: ElementRole;
  kind: ElementKind;
  content: string;
  minWidth: number;
  minHeight: number;
  preferredWidth?: number;
  preferredHeight?: number;
  aspectRatio?: number;
  priority: number;
  canDrop: boolean;
  canTruncate: boolean;
}

export interface AdSpec {
  id: string;
  background: string;
  padding: number;
  spacing: number;
  elements: AdElement[];
}

export interface SurfaceProfile {
  id: string;
  name: string;
  width: number;
  height: number;
  safeArea: Insets;
  minTapTarget: number;
  minTextSize: number;
  input: InputMode;
  maxElements?: number;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ResolvedElement extends AdElement {
  rect: Rect;
  fontSize: number;
  visible: boolean;
  truncated: boolean;
  reason?: string;
}

export interface ResolutionDecision {
  elementId: string;
  action: 'dropped' | 'truncated';
  priority: number;
  reason: string;
}

export interface ResolutionReport {
  surfaceId: string;
  feasible: boolean;
  dropped: string[];
  truncated: string[];
  decisions: ResolutionDecision[];
  warnings: string[];
}

export interface ResolvedLayout {
  surface: SurfaceProfile;
  elements: ResolvedElement[];
  report: ResolutionReport;
}
