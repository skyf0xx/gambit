import type { LinePath } from '../changes';

export type MarkKind = 'tick' | 'highlight' | 'arrow' | 'arrow-text' | 'cancel' | 'question' | 'loop';

export interface Mark {
  kind: MarkKind;
  sr: string;
  pencil?: boolean;
  note?: 'changed';
  to?: LinePath;
  /** Display name for the "→ Name" pencilled fallback (arrow-text only). */
  toName?: string;
}
