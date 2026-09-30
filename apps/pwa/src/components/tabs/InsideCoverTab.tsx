import { SettingsPage, type SettingsPageProps } from '../Settings';

/** Inside cover: the notebook's own settings page, always last in the tab
 * stack. Thin wrapper so Tabs.tsx doesn't need to know Settings.tsx's own
 * export name. */
export function InsideCoverTab(props: SettingsPageProps) {
  return <SettingsPage {...props} />;
}
