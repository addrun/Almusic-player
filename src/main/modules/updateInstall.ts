import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';

type WindowsInstallUpdater = {
  autoInstallOnAppQuit: boolean;
  installDirectory?: string;
};

const protectedEntries = [
  'kugou-sync-work',
  'publish-audit',
  '.git',
  '.agents',
  '.codex',
  '.aws',
  '.pnpm-store',
  'node_modules'
];

/** Keep NSIS updates at the running executable, independently of old product GUIDs. */
export function configureUpdateInstall(
  updater: WindowsInstallUpdater,
  platform: NodeJS.Platform,
  packaged: boolean,
  executable: string
): void {
  // Downloading an update must never install it merely because the player exits.
  updater.autoInstallOnAppQuit = false;
  if (platform === 'win32' && packaged) {
    updater.installDirectory = dirname(executable);
  }
}

/** NSIS removes the entire old installation; development/backup folders need a targeted update. */
export function getUpdateInstallError(
  platform: NodeJS.Platform,
  packaged: boolean,
  executable: string
): string | null {
  if (platform !== 'win32' || !packaged) return null;
  const directory = dirname(executable);
  if (protectedEntries.some((entry) => existsSync(join(directory, entry)))) {
    return '安装目录中包含源码或备份，普通更新安装可能删除这些文件，已停止安装。请使用保留这些文件的定向更新流程。';
  }
  return null;
}
