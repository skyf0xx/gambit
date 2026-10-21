import { useState } from 'react';
import { createGoal } from '../lib/goals';
import { defineStarter } from '../lib/compose';
import { t } from '../lib/i18n';
import { InkButton, Leaf, inputCls } from './ui';

export function NewGoalDialog({ onClose }: { onClose: () => void }) {
  const [title, setTitle] = useState('');
  const [touched, setTouched] = useState(false);
  const empty = touched && !title.trim();
  const go = async () => {
    setTouched(true);
    if (!title.trim()) return;
    // Gambit starts defining it straight away, as on first run.
    await createGoal(title.trim(), defineStarter(title));
    onClose();
  };
  return (
    <Leaf title={t('app.newGoal.title')} onClose={onClose}>
      <div className="anim-rise space-y-3">
        <input
          autoFocus
          className={inputCls}
          value={title}
          maxLength={200}
          aria-label={t('app.newGoal.titleLabel')}
          aria-invalid={empty}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={() => setTouched(true)}
          onKeyDown={(e) => e.key === 'Enter' && void go()}
          placeholder={t('app.newGoal.placeholder')}
        />
        {empty && <p className="anim-fade-in text-[14px] text-accent">{t('app.newGoal.needTitle')}</p>}
        <InkButton onClick={() => void go()} disabled={!title.trim()}>{t('app.newGoal.create')}</InkButton>
      </div>
    </Leaf>
  );
}
