import type {
  ProviderConfig,
  ChatCompletionMessage,
  StreamingResponse,
  ChatCompletionRequest,
  ProviderRequestDiagnostics,
} from "./types";

const PROVIDER_DIAGNOSTIC_PATH = "/tmp/ds-copilot-provider-request.json";

export function createOpenAICompatibleProvider(
  config: ProviderConfig,
) {
  async function sendChat(
    messages: ChatCompletionMessage[],
    signal?: AbortSignal,
    diagnostics?: ProviderRequestDiagnostics,
  ): Promise<StreamingResponse> {
    const requestBody: ChatCompletionRequest = {
      model: config.model,
      messages,
      stream: true,
      temperature: 0.7,
    };

    recordProviderRequestDiagnostic(config, requestBody, diagnostics);

    const AbortControllerCtor = (globalThis as any).AbortController;
    const controller =
      typeof AbortControllerCtor === "function"
        ? new AbortControllerCtor()
        : null;
    if (signal && controller) {
      signal.addEventListener("abort", () => controller.abort());
    }

    const response = await fetch(`${config.baseURL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify(requestBody),
      signal: controller?.signal,
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
      let buffer = "";
      try {
        while (true) {
          const { done, value } = await reader!.read(undefined as any);
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            const trimmedLine = line.trim();
            if (!trimmedLine.startsWith("data: ")) continue;
            const data = trimmedLine.slice(6);
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
      abort: () => controller?.abort?.(),
      stream: streamGenerator(),
    };
  }

  return { sendChat };
}

function recordProviderRequestDiagnostic(
  config: ProviderConfig,
  requestBody: ChatCompletionRequest,
  diagnosticsMeta?: ProviderRequestDiagnostics,
): void {
  const diagnostics = ((globalThis as any).__aiAssistantDiagnostics ??= {});
  const payload = {
    endpoint: `${config.baseURL}/chat/completions`,
    fullTextChars: diagnosticsMeta?.fullTextChars,
    fullTextSource: diagnosticsMeta?.fullTextSource,
    hasApiKey: Boolean(config.apiKey),
    messageCount: requestBody.messages.length,
    model: requestBody.model,
    stream: requestBody.stream,
    systemPromptChars: diagnosticsMeta?.systemPromptChars,
    timestamp: new Date().toISOString(),
  };
  diagnostics.lastProviderRequest = payload;

  try {
    const target =
      typeof Zotero?.File?.pathToFile === "function"
        ? Zotero.File.pathToFile(PROVIDER_DIAGNOSTIC_PATH)
        : PROVIDER_DIAGNOSTIC_PATH;
    Zotero.File?.putContents?.(
      target as unknown as nsIFile,
      JSON.stringify(payload, null, 2),
    );
  } catch {
    // Keep diagnostics best-effort so request flow never depends on file IO.
  }
}
