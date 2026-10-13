import type { Component } from 'vue';
import { shallowReactive } from 'vue';

export interface SettingItem {
  key?: string;
  type: 'boolean' | 'slider' | 'color' | 'radio' | 'font' | 'divider';
  label?: string;
  default?: any;
  min?: number;
  max?: number;
  step?: number;
  marks?: string[];
  options?: { value: string; label: string; showWhen?: { key: string; is?: string; not?: string; and?: { key: string; is?: string; not?: string } } }[];
  showWhen?: { key: string; is?: string; not?: string; and?: { key: string; is?: string; not?: string } };
}

export interface PlayerStyleDefinition {
  key: string;
  label: string;
  component: Component;
  /** 浮动覆盖布局专用组件（可选）。如未提供，OverlayPlayerHost 会使用 component + overlayMode prop */
  overlayComponent?: Component;
  isFullScreen?: boolean;
  theme?: 'light' | 'dark';
  showStyleSwitch?: boolean;
  settings?: SettingItem[];
  renderMode?: 'vue' | 'dom';
  externalId?: string;
}

const styles = shallowReactive<PlayerStyleDefinition[]>([]);

export function registerStyle(def: PlayerStyleDefinition) {
  const idx = styles.findIndex(s => s.key === def.key);
  if (idx >= 0) {
    styles[idx] = def;
  } else {
    styles.push(def);
  }
}

export function registerExternalStyle(def: PlayerStyleDefinition) {
  const existing = styles.find(s => s.key === def.key);
  if (existing) return existing;
  styles.push(def);
  return def;
}

export function unregisterStyle(key: string) {
  const idx = styles.findIndex(s => s.key === key);
  if (idx >= 0) {
    styles.splice(idx, 1);
  }
}

export function getStyle(key: string): PlayerStyleDefinition | undefined {
  return styles.find(s => s.key === key);
}

export function getAllStyles(): PlayerStyleDefinition[] {
  return [...styles];
}
