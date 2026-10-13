import { reactive } from 'vue';

const STORAGE_KEY = 'feature-flags';

function loadFlags(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return {};
}

function saveFlags(flags: Record<string, boolean>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(flags));
  } catch {}
}

const flags = reactive<Record<string, boolean>>(loadFlags());

export function isFeatureEnabled(id: string): boolean {
  return flags[id] ?? false;
}

export function setFeatureEnabled(id: string, enabled: boolean) {
  flags[id] = enabled;
  saveFlags({ ...flags });
}

export function getFeatureFlags(): Record<string, boolean> {
  return { ...flags };
}

export { flags as featureFlags };
