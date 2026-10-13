export type PluginType = 'lxMusic' | 'customApi' | 'playerStyle' | 'theme' | 'translator' | 'general'

export interface PluginAuthor {
  name: string
  url?: string
}

export interface PluginStoreItem {
  id: string
  name: string
  description: string
  version: string
  type: PluginType
  author: PluginAuthor
  icon?: string
  screenshots?: string[]
  downloadUrl: string
  sourceRepo: string
  homepage?: string
  license?: string
  minAppVersion?: string
  tags?: string[]
  downloads?: number
  submittedAt?: string
  approvedAt?: string
}

export interface InstalledPlugin {
  manifest: PluginStoreItem
  enabled: boolean
  installedAt: number
  payload?: {
    script?: string
    config?: string
    css?: string
    js?: string
    compiled?: string
  }
}
