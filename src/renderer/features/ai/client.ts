import { getProvider, type AIProvider } from './providers';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatOptions {
  providerId: string;
  apiKey?: string;
  model?: string;
  baseUrl?: string;
  messages: ChatMessage[];
  signal?: AbortSignal;
}

export interface ChatResult {
  content: string;
  model: string;
  provider: string;
}

export async function chatCompletion(options: ChatOptions): Promise<ChatResult> {
  const provider = getProvider(options.providerId);
  if (!provider && options.providerId !== 'custom') {
    throw new Error(`未知的 AI 提供商: ${options.providerId}`);
  }

  const p: AIProvider = provider || {
    id: 'custom',
    name: '自定义',
    baseUrl: options.baseUrl || '',
    defaultModel: options.model || '',
    needApiKey: false,
    description: ''
  };

  const model = options.model || p.defaultModel;
  const baseUrl = options.baseUrl || p.baseUrl;

  if (!baseUrl) {
    throw new Error('未配置 API 地址');
  }

  if (p.needApiKey && !options.apiKey) {
    throw new Error(`${p.name} 需要 API 密钥，请在设置中配置`);
  }

  if (p.id === 'gemini') {
    return geminiChat(baseUrl, model, options.apiKey || '', options.messages, options.signal);
  }

  const extraHeaders: Record<string, string> = {};
  if (p.id === 'github-models') {
    extraHeaders['Accept'] = 'application/vnd.github+json';
    extraHeaders['X-GitHub-Api-Version'] = '2022-11-28';
  }

  return openaiChat(baseUrl, model, options.apiKey, options.messages, options.signal, extraHeaders);
}

async function openaiChat(
  baseUrl: string,
  model: string,
  apiKey: string | undefined,
  messages: ChatMessage[],
  signal?: AbortSignal,
  extraHeaders?: Record<string, string>
): Promise<ChatResult> {
  const url = `${baseUrl}/chat/completions`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...extraHeaders
  };
  if (apiKey) {
    headers['Authorization'] = `Bearer ${apiKey}`;
  }

  const body = JSON.stringify({
    model,
    messages,
    stream: false
  });

  const resp = await fetch(url, { method: 'POST', headers, body, signal });
  if (!resp.ok) {
    const errText = await resp.text().catch(() => '');
    throw new Error(`API 请求失败 (${resp.status}): ${errText.slice(0, 200)}`);
  }

  const data = await resp.json();
  const content = data?.choices?.[0]?.message?.content || '';
  if (!content) {
    throw new Error('API 返回了空内容');
  }

  return { content, model: data?.model || model, provider: 'openai' };
}

async function geminiChat(
  baseUrl: string,
  model: string,
  apiKey: string,
  messages: ChatMessage[],
  signal?: AbortSignal
): Promise<ChatResult> {
  const url = `${baseUrl}/models/${model}:generateContent?key=${apiKey}`;

  const contents = messages.map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }]
  }));

  const body = JSON.stringify({ contents });
  const resp = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, signal });
  if (!resp.ok) {
    const errText = await resp.text().catch(() => '');
    throw new Error(`Gemini API 请求失败 (${resp.status}): ${errText.slice(0, 200)}`);
  }

  const data = await resp.json();
  const content = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
  if (!content) {
    throw new Error('Gemini API 返回了空内容');
  }

  return { content, model, provider: 'gemini' };
}
