// Plain-language section headings, with the underlying method pencilled
// beside each one (brand/identity.md §08 "Plain labels, methods
// underneath", §10 "Card headings via `titleForKey`"). One entry per goal
// key that can render as a section on the page.

export interface SectionTitle {
  /** Plain-language heading (Inter 17/24, weight 600). */
  title: string;
  /** The method name, pencilled beside the heading in Caveat. Omitted when a plain heading needs no gloss. */
  method?: string;
}

const TITLES: Record<string, SectionTitle> = {
  successCriteria: { title: 'What done looks like' },
  plan: { title: 'Moves ahead' },
  people: { title: "Who's involved" },
  stakeholders: { title: 'Who else has a say', method: 'stakeholders' },
  systemsNotes: { title: 'Where the leverage is', method: 'systems' },
  riskNotes: { title: 'What could go wrong', method: 'red team' },
  decisions: { title: 'Decisions', method: 'decide' },
  exposure: { title: 'What you’re exposed to', method: 'exposure' },
  capacity: { title: 'What you actually have', method: 'capacity' },
  forecasts: { title: 'Bets on the record', method: 'forecast' },
  experiments: { title: 'Still a guess', method: 'experiment' },
  criteriaStatus: { title: 'How it’s going', method: 'eval' },
};

export function sectionTitleFor(key: string): SectionTitle {
  return TITLES[key] ?? { title: key };
}
