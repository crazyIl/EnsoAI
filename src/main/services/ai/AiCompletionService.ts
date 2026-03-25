import { createAnthropic } from '@ai-sdk/anthropic';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import type { AiCompletionRequest, AiCompletionResponse, ThirdPartyAiConfig } from '@shared/types';
import type { LanguageModel } from 'ai';
import { generateText, streamText } from 'ai';
import { session } from 'electron';

/**
 * AI API 补全服务
 * 基于 Vercel AI SDK，支持 OpenAI 兼容和 Anthropic 两种协议
 */

interface AiStreamOptions {
  timeout?: number;
  abortSignal?: AbortSignal;
}

function createAbortSignal(
  timeout: number,
  abortSignal?: AbortSignal
): {
  signal: AbortSignal;
  cleanup: () => void;
} {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  const handleAbort = () => controller.abort();
  if (abortSignal?.aborted) {
    handleAbort();
  } else {
    abortSignal?.addEventListener('abort', handleAbort, { once: true });
  }

  return {
    signal: controller.signal,
    cleanup: () => {
      clearTimeout(timer);
      abortSignal?.removeEventListener('abort', handleAbort);
    },
  };
}

const sessionFetch = (input: RequestInfo | URL, init?: RequestInit) =>
  session.defaultSession.fetch(input as string, init);

function normalizeBaseURL(config: ThirdPartyAiConfig): string {
  const baseURL = config.baseUrl.replace(/\/+$/, '');

  if (config.protocol !== 'anthropic') {
    return baseURL;
  }

  try {
    const url = new URL(baseURL);
    if (!url.pathname || url.pathname === '/') {
      url.pathname = '/v1';
      return url.toString().replace(/\/+$/, '');
    }
  } catch {
    return baseURL;
  }

  return baseURL;
}

function createModel(config: ThirdPartyAiConfig): LanguageModel {
  const baseURL = normalizeBaseURL(config);

  if (config.protocol === 'anthropic') {
    const anthropic = createAnthropic({
      baseURL,
      apiKey: config.apiKey,
      fetch: sessionFetch,
    });
    return anthropic(config.model);
  }

  // OpenAI 协议
  const provider = createOpenAICompatible({
    name: 'third-party',
    baseURL,
    apiKey: config.apiKey,
    fetch: sessionFetch,
  });
  return provider.chatModel(config.model);
}

/**
 * 发起 AI 补全请求（非流式）
 */
export async function aiCompletion(request: AiCompletionRequest): Promise<AiCompletionResponse> {
  const { config, prompt, timeout = 60000 } = request;

  if (!config.baseUrl || !config.apiKey || !config.model) {
    return {
      success: false,
      error: 'AI API not configured (missing baseUrl, apiKey, or model)',
    };
  }

  try {
    const model = createModel(config);
    const { signal, cleanup } = createAbortSignal(timeout);

    try {
      const { text } = await generateText({
        model,
        prompt,
        abortSignal: signal,
      });

      return { success: true, content: text };
    } finally {
      cleanup();
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[AiCompletion] Error:', message);
    return { success: false, error: message };
  }
}

/**
 * 发起 AI 流式补全请求（用于 code review）
 * 返回一个 async generator，逐步 yield 文本片段
 */
export async function* aiStreamCompletion(
  config: ThirdPartyAiConfig,
  prompt: string,
  options: AiStreamOptions = {}
): AsyncGenerator<string, void, unknown> {
  const { timeout = 120000, abortSignal } = options;

  if (!config.baseUrl || !config.apiKey || !config.model) {
    throw new Error('AI API not configured');
  }

  const model = createModel(config);
  const { signal, cleanup } = createAbortSignal(timeout, abortSignal);

  try {
    const { textStream } = streamText({
      model,
      prompt,
      abortSignal: signal,
    });

    for await (const textPart of textStream) {
      if (textPart) yield textPart;
    }
  } finally {
    cleanup();
  }
}

/**
 * 获取可用模型列表
 */
export async function fetchAiModels(
  config: Pick<ThirdPartyAiConfig, 'protocol' | 'baseUrl' | 'apiKey'>
): Promise<{ success: boolean; models?: string[]; error?: string }> {
  if (!config.baseUrl || !config.apiKey) {
    return { success: false, error: 'Missing baseUrl or apiKey' };
  }

  const baseURL = config.baseUrl.replace(/\/+$/, '');

  try {
    let url: string;
    let headers: Record<string, string>;

    if (config.protocol === 'anthropic') {
      if (baseURL.endsWith('/v1')) {
        url = `${baseURL}/models`;
      } else if (baseURL.endsWith('/models')) {
        url = baseURL;
      } else {
        url = `${baseURL}/v1/models`;
      }
      headers = {
        'x-api-key': config.apiKey,
        'anthropic-version': '2023-06-01',
      };
    } else {
      // OpenAI
      if (baseURL.endsWith('/v1')) {
        url = `${baseURL}/models`;
      } else if (baseURL.endsWith('/models')) {
        url = baseURL;
      } else {
        url = `${baseURL}/v1/models`;
      }
      headers = {
        Authorization: `Bearer ${config.apiKey}`,
      };
    }

    const resp = await session.defaultSession.fetch(url, {
      method: 'GET',
      headers,
      signal: AbortSignal.timeout(10000),
    });

    if (!resp.ok) {
      const text = await resp.text();
      return { success: false, error: `HTTP ${resp.status}: ${text.slice(0, 200)}` };
    }

    const data = (await resp.json()) as { data?: Array<{ id: string }> };
    const models = (data.data || []).map((m) => m.id).sort();
    return { success: true, models };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return { success: false, error: message };
  }
}

/**
 * 测试 AI API 连接
 */
export async function testAiConnection(
  config: ThirdPartyAiConfig
): Promise<{ success: boolean; latency?: number; error?: string }> {
  const start = Date.now();
  const result = await aiCompletion({
    config,
    prompt: 'Reply with exactly: OK',
    timeout: 15000,
  });
  const latency = Date.now() - start;

  if (result.success) {
    return { success: true, latency };
  }
  return { success: false, error: result.error };
}
