import type { Component } from 'vue';
import { reactive } from 'vue';

export type FeatureType = 'playerStyle' | 'analysis' | 'tool';

export interface FeatureDefinition {
  id: string;
  name: string;
  description: string;
  icon: string;
  type: FeatureType;
  locked?: boolean;
  component?: Component;
}

const features = reactive<FeatureDefinition[]>([]);

export function registerFeature(def: FeatureDefinition) {
  const idx = features.findIndex((f) => f.id === def.id);
  if (idx >= 0) {
    features[idx] = def;
  } else {
    features.push(def);
  }
}

export function unregisterFeature(id: string) {
  const idx = features.findIndex((f) => f.id === id);
  if (idx >= 0) {
    features.splice(idx, 1);
  }
}

export function getAllFeatures(): FeatureDefinition[] {
  return [...features];
}

export function getFeature(id: string): FeatureDefinition | undefined {
  return features.find((f) => f.id === id);
}
