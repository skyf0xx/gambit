import type { LinePath } from '../changes';

export type MarkKind = 'tick' | 'highlight' | 'star' | 'arrow' | 'squiggle' | 'eraser' | 'question' | 'loop';

export interface Mark {
  kind: MarkKind;
  sr: string;
  pencil?: boolean;
  note?: 'changed';
  to?: LinePath;
}
