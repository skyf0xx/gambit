import { useState } from 'react';
import { createGoal } from '../lib/goals';
import { InkButton, Leaf, inputCls } from './ui';

export function NewGoalDialog({ onClose }: { onClose: () => void }) {
  const [title, setTitle] = useState('');
  const go = async () => { if (title.trim()) { await createGoal(title.trim()); onClose(); } };
  return (
    <Leaf title="New goal" onClose={onClose}>
      <div className="space-y-3">
        <input autoFocus className={inputCls} value={title} maxLength={200} onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && void go()} placeholder="A working title, e.g. Land a job offer" />
        <p className="text-[14px] text-graphite">You'll sharpen it in conversation; the title can change.</p>
        <InkButton onClick={() => void go()} disabled={!title.trim()}>Create</InkButton>
      </div>
    </Leaf>
  );
}
