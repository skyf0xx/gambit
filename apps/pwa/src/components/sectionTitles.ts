// Plain-language section headings, with the underlying method pencilled
// beside each one (brand/identity.md §08 "Plain labels, methods
// underneath", §10 "Card headings via `titleForKey`"). One entry per goal
// key that can render as a section on the page.

export interface SectionTitle {
  /** Plain-language heading (Inter 17/24, weight 600). */
  title: string;
  /** The method name, pencilled beside the heading in Caveat. Omitted when a plain heading needs no gloss. */
  method?: string;
  /** One-line plain explanation of the method, shown as a pencilled tooltip
   * (data-note) on the method word so it never reads as unexplained jargon
   * (brand/voice.md §08 "unexplained jargon in UI labels"). */
  methodNote?: string;
}

const TITLES: Record<string, SectionTitle> = {
  successCriteria: { title: 'What done looks like' },
  plan: { title: 'Future moves' },
  people: { title: "Who's involved" },
  stakeholders: { title: 'Who else has a say', method: 'stakeholders', methodNote: 'stakeholders: mapping who has power and what they want' },
  systemsNotes: { title: 'Where the leverage is', method: 'systems', methodNote: 'systems: finding the one point that moves everything else' },
  riskNotes: { title: 'What could go wrong', method: 'red team', methodNote: 'red team: arguing against your own plan' },
  decisions: { title: 'Decisions', method: 'decide', methodNote: 'decide: a choice made, with what would reverse it' },
  exposure: { title: 'What you’re exposed to', method: 'exposure', methodNote: 'exposure: your personal legal, financial and safety risk' },
  capacity: { title: 'What you actually have', method: 'capacity', methodNote: 'capacity: your real hours, money and runway' },
  forecasts: { title: 'Bets on the record', method: 'forecast', methodNote: 'forecast: a dated prediction, scored later' },
  experiments: { title: 'Still a guess', method: 'experiment', methodNote: 'experiment: the smallest test that could prove you wrong' },
  criteriaStatus: { title: 'How it’s going', method: 'eval', methodNote: 'eval: checking progress against done' },
};

export function sectionTitleFor(key: string): SectionTitle {
  return TITLES[key] ?? { title: key };
}
