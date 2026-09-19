import { useState } from 'react';
import { createGoal } from '../lib/goals';
import { Btn, Modal, inputCls } from './ui';

export function NewGoalDialog({ onClose }: { onClose: () => void }) {
  const [title, setTitle] = useState('');
  const go = async () => { if (title.trim()) { await createGoal(title.trim()); onClose(); } };
  return (
    <Modal title="New goal" onClose={onClose}>
      <div className="space-y-3">
        <input autoFocus className={inputCls} value={title} maxLength={200} onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && void go()} placeholder="A working title, e.g. Land a job offer" />
        <p className="text-xs text-slate-500">You'll sharpen it in conversation; the title can change.</p>
        <Btn kind="primary" onClick={() => void go()} disabled={!title.trim()}>Create</Btn>
      </div>
    </Modal>
  );
}
