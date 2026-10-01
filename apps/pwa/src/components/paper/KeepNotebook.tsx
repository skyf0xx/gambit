import { useUi, isStandalone, installRoute, installSteps } from '../../lib/persist';
import { TextAction } from '../ui';

/** The one install prompt on the page: a pencilled note under the goal,
 * shown once the goal has real content (so there's something to lose) and
 * never again once saved or waved off. Browsers that can't install at all
 * get nothing here; the Inside cover covers them. */
export function KeepNotebook() {
  const { installEvent, installDismissed, justInstalled, dismissInstall } = useUi();
  if (typeof window === 'undefined') return null;
  const route = installRoute(!!installEvent);
  if (installDismissed || justInstalled || isStandalone() || route === 'none') return null;

  return (
    <aside className="hand anim-fade-in space-y-1 text-[16px] leading-6 text-graphite">
      <p>
        <span className="text-ink">Keep this notebook.</span> Unused sites get cleared.
      </p>
      <p className="flex flex-wrap items-center gap-x-4">
        {route === 'prompt' ? (
          <TextAction className="underline" onClick={() => void installEvent!.prompt()}>Install</TextAction>
        ) : (
          <span className="text-ink">{installSteps[route]}</span>
        )}
        <TextAction className="text-graphite underline" onClick={dismissInstall}>Not now</TextAction>
      </p>
    </aside>
  );
}
