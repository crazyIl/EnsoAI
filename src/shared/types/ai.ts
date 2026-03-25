export type ClaudeModelId = 'opus' | 'sonnet' | 'haiku';
export type CodexModelId = 'o3' | 'o4-mini';
export type GeminiModelId = 'gemini-3-pro-preview' | 'gemini-3-flash-preview';

export type ModelId = ClaudeModelId | CodexModelId | GeminiModelId;

export type ReasoningEffort = 'none' | 'minimal' | 'low' | 'medium' | 'high' | 'xhigh';

export type AiApiProtocol = 'openai' | 'anthropic';

export type AiProviderMode = 'cli' | 'api';

export interface ThirdPartyAiConfig {
  protocol: AiApiProtocol;
  baseUrl: string;
  apiKey: string;
  model: string;
}

export interface AiCompletionRequest {
  config: ThirdPartyAiConfig;
  prompt: string;
  timeout?: number;
}

export interface AiCompletionResponse {
  success: boolean;
  content?: string;
  error?: string;
}

export interface AiStreamCompletionRequest {
  config: ThirdPartyAiConfig;
  prompt: string;
  timeout?: number;
}
