import type { AiCompletionRequest, AiCompletionResponse, ThirdPartyAiConfig } from '@shared/types';
import { IPC_CHANNELS } from '@shared/types';
import { ipcMain, type WebContents } from 'electron';
import {
  aiCompletion,
  aiStreamCompletion,
  fetchAiModels,
  testAiConnection,
} from '../services/ai/AiCompletionService';

// Active stream sessions
const activeStreams = new Map<string, AbortController>();

function sendAiStreamEvent(
  sender: WebContents,
  streamId: string,
  event: {
    type: 'data' | 'error' | 'exit';
    data?: string;
    exitCode?: number;
  }
): void {
  if (!sender.isDestroyed()) {
    sender.send(IPC_CHANNELS.AI_STREAM_DATA, {
      streamId,
      ...event,
    });
  }
}

export function registerAiIpcHandlers(): void {
  // 非流式 AI 补全
  ipcMain.handle(
    IPC_CHANNELS.AI_COMPLETION,
    async (_, request: AiCompletionRequest): Promise<AiCompletionResponse> => {
      return aiCompletion(request);
    }
  );

  // 流式 AI 补全（用于 code review）
  ipcMain.handle(
    IPC_CHANNELS.AI_STREAM_COMPLETION,
    async (
      event,
      streamId: string,
      config: ThirdPartyAiConfig,
      prompt: string,
      timeout?: number
    ): Promise<{ success: boolean; error?: string }> => {
      if (!config.baseUrl || !config.apiKey || !config.model) {
        return { success: false, error: 'AI API not configured' };
      }

      const sender = event.sender;
      const controller = new AbortController();
      activeStreams.set(streamId, controller);

      void (async () => {
        let exitCode = 0;

        try {
          const stream = aiStreamCompletion(config, prompt, {
            timeout,
            abortSignal: controller.signal,
          });

          for await (const chunk of stream) {
            if (controller.signal.aborted) break;
            sendAiStreamEvent(sender, streamId, {
              type: 'data',
              data: chunk,
            });
          }
        } catch (err) {
          if (!controller.signal.aborted) {
            exitCode = 1;
            const message = err instanceof Error ? err.message : 'Unknown error';
            sendAiStreamEvent(sender, streamId, {
              type: 'error',
              data: message,
            });
          }
        } finally {
          activeStreams.delete(streamId);
          sendAiStreamEvent(sender, streamId, {
            type: 'exit',
            exitCode: controller.signal.aborted ? 0 : exitCode,
          });
        }
      })();

      return { success: true };
    }
  );

  // 停止流式补全
  ipcMain.handle(IPC_CHANNELS.AI_STREAM_STOP, async (_, streamId: string): Promise<void> => {
    const controller = activeStreams.get(streamId);
    if (controller) {
      controller.abort();
      activeStreams.delete(streamId);
    }
  });

  // 获取模型列表
  ipcMain.handle(
    IPC_CHANNELS.AI_FETCH_MODELS,
    async (
      _,
      config: Pick<ThirdPartyAiConfig, 'protocol' | 'baseUrl' | 'apiKey'>
    ): Promise<{ success: boolean; models?: string[]; error?: string }> => {
      return fetchAiModels(config);
    }
  );

  // 测试连接
  ipcMain.handle(
    IPC_CHANNELS.AI_TEST_CONNECTION,
    async (
      _,
      config: ThirdPartyAiConfig
    ): Promise<{ success: boolean; latency?: number; error?: string }> => {
      return testAiConnection(config);
    }
  );
}
