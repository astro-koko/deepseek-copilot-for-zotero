import type {
  ProviderConfig,
  ChatCompletionMessage,
  StreamingResponse,
  ChatCompletionRequest,
} from "./types";

export function createOpenAICompatibleProvider(
  config: ProviderConfig,
) {
  async function sendChat(
    messages: ChatCompletionMessage[],
    signal?: AbortSignal,
  ): Promise<StreamingResponse> {
    const requestBody: ChatCompletionRequest = {
      model: config.model,
      messages,
      stream: true,
      temperature: 0.7,
    };

    const controller = new AbortController();
    if (signal) {
      signal.addEventListener("abort", () => controller.abort());
    }

    const response = await fetch(`${config.baseURL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Provider error ${response.status}: ${errorText}`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error("No response body");
    }

    async function* streamGenerator(): AsyncGenerator<string> {
      const decoder = new TextDecoder();
      try {
        while (true) {
          const { done, value } = await reader!.read(undefined as any);
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split("\n");

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const data = line.slice(6);
            if (data === "[DONE]") return;

            try {
              const parsed = JSON.parse(data);
              const delta = parsed.choices?.[0]?.delta?.content;
              if (delta) yield delta;
            } catch {
              // Ignore parse errors for malformed chunks
            }
          }
        }
      } finally {
        reader!.releaseLock();
      }
    }

    return {
      abort: () => controller.abort(),
      stream: streamGenerator(),
    };
  }

  return { sendChat };
}
