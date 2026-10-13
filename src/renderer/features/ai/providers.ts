export interface AIProvider {
  id: string;
  name: string;
  baseUrl: string;
  defaultModel: string;
  needApiKey: boolean;
  description: string;
  badge?: string;
}

export const AI_PROVIDERS: AIProvider[] = [
  {
    id: 'pollinations',
    name: 'Pollinations (免费)',
    baseUrl: 'https://text.pollinations.ai/v1',
    defaultModel: 'openai',
    needApiKey: false,
    description: '无需 API 密钥，开箱即用。基于 GPT-OSS-20B，支持中文。'
  },
  {
    id: 'github-models',
    name: 'GitHub Models (免费)',
    baseUrl: 'https://models.github.ai/inference',
    defaultModel: 'openai/gpt-4o',
    needApiKey: true,
    badge: '荐',
    description: 'GitHub 用户免费使用 GPT-4o、DeepSeek-R1 等，需 GitHub Classic PAT。'
  },
  {
    id: 'custom',
    name: '自定义',
    baseUrl: '',
    defaultModel: '',
    needApiKey: false,
    description: '自定义 API 地址和模型，兼容 OpenAI 格式。'
  }
];

export function getProvider(id: string): AIProvider | undefined {
  return AI_PROVIDERS.find((p) => p.id === id);
}
