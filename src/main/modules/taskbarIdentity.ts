import { existsSync } from 'node:fs';
import { join } from 'node:path';

export const WINDOWS_APP_ID = 'com.almusic.player';
export const WINDOWS_ICON_NAME = 'app-icon-light-v2.ico';

type IdentityWindow = {
  setAppDetails: (details: {
    appId: string;
    appIconPath: string;
    appIconIndex: number;
    relaunchCommand: string;
    relaunchDisplayName: string;
  }) => void;
};

export function applyTaskbarIdentity(
  window: IdentityWindow,
  platform: NodeJS.Platform,
  executable: string,
  resourcesDirectory: string
): void {
  if (platform !== 'win32') return;
  const externalIcon = join(resourcesDirectory, WINDOWS_ICON_NAME);
  window.setAppDetails({
    appId: WINDOWS_APP_ID,
    appIconPath: existsSync(externalIcon) ? externalIcon : executable,
    appIconIndex: 0,
    relaunchCommand: `"${executable}"`,
    relaunchDisplayName: 'Almusic'
  });
}
