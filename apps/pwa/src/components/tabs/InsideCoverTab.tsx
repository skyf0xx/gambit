import { useState } from 'react';
import type { Goal } from '../../lib/types';
import { SettingsPage, type SettingsPageProps } from '../Settings';
import { TextAction, PencilWord } from '../ui';
import { LogsTab } from './LogsTab';
import { useGoto } from '../gotoContext';

/** Inside cover: the notebook's own settings page, always last in the tab
 * stack, with the goal's log folded at its foot as "History" — it's a
 * record of how the goal got here, not something to check, so it doesn't
 * take a tab of its own. */
export function InsideCoverTab({ g, ...props }: SettingsPageProps & { g?: Goal }) {
  const [picked, setOpen] = useState(false);
  // A goto into the log (a changed log line) opens History to show it.
  const goto = useGoto();
  const open = picked || !!goto?.path.startsWith('log');
  const entries = g?.log.length ?? 0;
  return (
    <div className="space-y-12">
      <SettingsPage {...props} />
      {g && entries > 0 && (
        <div className="space-y-4">
          <TextAction aria-expanded={open} onClick={() => setOpen((v) => !v)}>
            <PencilWord className="text-[20px] text-graphite">{open ? 'hide history' : `History · ${entries} ${entries === 1 ? 'entry' : 'entries'}`}</PencilWord>
          </TextAction>
          {open && <LogsTab g={g} />}
        </div>
      )}
    </div>
  );
}
