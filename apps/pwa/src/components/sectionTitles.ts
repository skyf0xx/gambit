// Plain-language section headings, with the underlying method pencilled
// beside each one (brand/identity.md §08 "Plain labels, methods
// underneath", §10 "Card headings via `titleForKey`"). One entry per goal
// key that can render as a section on the page.

import { hasKey, t } from '../lib/i18n';

export interface SectionTitle {
  /** Plain-language heading (Inter 20/28, weight 600). */
  title: string;
  /** The method name, pencilled beside the heading in Caveat. Omitted when a plain heading needs no gloss. */
  method?: string;
  /** One-line plain explanation of the method, shown as a pencilled tooltip
   * (data-note) on the method word so it never reads as unexplained jargon
   * (brand/voice.md §08 "unexplained jargon in UI labels"). */
  methodNote?: string;
}

const KEYS = ['successCriteria', 'log', 'memory', 'plan', 'people', 'stakeholders', 'systemsNotes', 'riskNotes', 'decisions', 'exposure', 'capacity', 'forecasts', 'experiments', 'intel', 'courses', 'prep', 'criteriaStatus'];

// The words live in locales/<locale>/sections.json: "<key>" is the heading,
// "<key>.method" and "<key>.methodNote" the pencilled gloss, when it has one.
export const hasSectionTitle = (key: string) => KEYS.includes(key);

export function sectionTitleFor(key: string): SectionTitle {
  if (!hasSectionTitle(key)) return { title: key };
  const method = hasKey(`sections.${key}.method`) ? t(`sections.${key}.method`) : undefined;
  return { title: t(`sections.${key}`), ...(method ? { method, methodNote: t(`sections.${key}.methodNote`) } : {}) };
}
