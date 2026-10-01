import { useState } from 'react';
import { createGoal } from '../lib/goals';
import { InkButton, Leaf, inputCls } from './ui';

export function NewGoalDialog({ onClose }: { onClose: () => void }) {
  const [title, setTitle] = useState('');
  const [touched, setTouched] = useState(false);
  const empty = touched && !title.trim();
  const go = async () => {
    setTouched(true);
    if (!title.trim()) return;
    await createGoal(title.trim());
    onClose();
  };
  return (
    <Leaf title="New goal" onClose={onClose}>
      <div className="anim-rise space-y-3">
        <input
          autoFocus
          className={inputCls}
          value={title}
          maxLength={200}
          aria-label="Goal title"
          aria-invalid={empty}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={() => setTouched(true)}
          onKeyDown={(e) => e.key === 'Enter' && void go()}
          placeholder="e.g. Land a job offer"
        />
        {empty && <p className="anim-fade-in text-[14px] text-accent">Add a title.</p>}
        <InkButton onClick={() => void go()} disabled={!title.trim()}>Create</InkButton>
      </div>
    </Leaf>
  );
}
