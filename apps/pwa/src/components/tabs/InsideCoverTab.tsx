import { useState, type ReactNode } from 'react';
import type { Goal } from '../../lib/types';
import { SettingsPage, type SettingsPageProps } from '../Settings';
import { TextAction, PencilWord } from '../ui';
import { LogsTab } from './LogsTab';
import { MemoryList } from './MemoryList';
import { useGoto } from '../gotoContext';

/** A page section folded behind a pencilled toggle, closed until tapped. */
function Folded({ label, hideLabel, open, onToggle, children }: { label: string; hideLabel: string; open: boolean; onToggle: () => void; children: ReactNode }) {
  return (
    <div className="space-y-4">
      <TextAction aria-expanded={open} onClick={onToggle}>
        <PencilWord className="text-[20px] text-graphite">{open ? hideLabel : label}</PencilWord>
      </TextAction>
      {open && children}
    </div>
  );
}

/** Inside cover: the notebook's own settings page, always last in the tab
 * stack, then what Gambit remembers and the goal's log ("History"), each
 * folded at the foot: reference, not something to check, so neither takes
 * a tab of its own or shows until asked. */
export function InsideCoverTab({ g, ...props }: SettingsPageProps & { g?: Goal }) {
  const [picked, setOpen] = useState(false);
  const [memoryOpen, setMemoryOpen] = useState(false);
  // A goto into the log (a changed log line) opens History to show it, and
  // one into memory opens that.
  const goto = useGoto();
  const open = picked || !!goto?.path.startsWith('log');
  const showMemory = memoryOpen || !!goto?.path.startsWith('memory');
  const entries = g?.log.length ?? 0;
  const kept = g?.memory.length ?? 0;
  return (
    <div className="space-y-12">
      <SettingsPage {...props} />
      {g && props.goalId && kept > 0 && (
        <Folded label={`What Gambit remembers · ${kept}`} hideLabel="hide memory" open={showMemory} onToggle={() => setMemoryOpen((v) => !v)}>
          <MemoryList g={g} goalId={props.goalId} />
        </Folded>
      )}
      {g && entries > 0 && (
        <Folded label={`History · ${entries} ${entries === 1 ? 'entry' : 'entries'}`} hideLabel="hide history" open={open} onToggle={() => setOpen((v) => !v)}>
          <LogsTab g={g} />
        </Folded>
      )}
    </div>
  );
}
