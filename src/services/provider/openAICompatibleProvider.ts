import type {
  ProviderConfig,
  ChatCompletionMessage,
  ChatStreamChunk,
  StreamingResponse,
  ChatCompletionRequest,
  ProviderRequestDiagnostics,
} from "./types";

const PROVIDER_DIAGNOSTIC_PATH = "/tmp/deepseek-copliot-provider-request.json";

export function createOpenAICompatibleProvider(config: ProviderConfig) {
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

    async function* streamGenerator(): AsyncGenerator<ChatStreamChunk> {
      const decoder = new TextDecoder();
      let buffer = "";
      try {
        while (true) {
          const { done, value } = await reader!.read(undefined as any);
          if (done) {
            buffer += decoder
              .decode()
              .replace(/\r\n/g, "\n")
              .replace(/\r/g, "\n");
            for (const event of parseSseEvents(buffer, true).events) {
              if (event === "[DONE]") return;
              yield* parseStreamEvent(event);
            }
            break;
          }

          buffer += decoder
            .decode(value, { stream: true })
            .replace(/\r\n/g, "\n")
            .replace(/\r/g, "\n");
          const parsed = parseSseEvents(buffer);
          buffer = parsed.remainder;

          for (const event of parsed.events) {
            if (event === "[DONE]") return;
            yield* parseStreamEvent(event);
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

function parseSseEvents(
  buffer: string,
  flush = false,
): { events: string[]; remainder: string } {
  const events: string[] = [];
  let remainder = buffer;

  while (true) {
    const separatorIndex = remainder.indexOf("\n\n");
    if (separatorIndex < 0) {
      break;
    }

    const rawEvent = remainder.slice(0, separatorIndex);
    remainder = remainder.slice(separatorIndex + 2);
    const event = parseSseDataPayload(rawEvent);
    if (event) {
      events.push(event);
    }
  }

  if (flush && remainder.trim()) {
    const event = parseSseDataPayload(remainder);
    if (event) {
      events.push(event);
    }
    remainder = "";
  }

  return { events, remainder };
}

function parseSseDataPayload(rawEvent: string): string {
  return rawEvent
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice(5).trimStart())
    .join("\n")
    .trim();
}

async function* parseStreamEvent(
  data: string,
): AsyncGenerator<ChatStreamChunk> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(data);
  } catch {
    // Ignore malformed stream events; later valid SSE events can still arrive.
    return;
  }

  const streamError = extractProviderStreamError(parsed);
  if (streamError) {
    throw new Error(`Provider stream error: ${streamError}`);
  }

  const delta = (parsed as any).choices?.[0]?.delta;
  const reasoningDelta =
    delta?.reasoning_content || delta?.reasoning || delta?.reasoningContent;
  if (reasoningDelta) {
    yield {
      type: "reasoning_delta",
      content: String(reasoningDelta),
    };
  }

  const contentDelta = delta?.content;
  if (contentDelta) {
    yield String(contentDelta);
  }
}

function extractProviderStreamError(parsed: unknown): string | null {
  if (!parsed || typeof parsed !== "object") {
    return null;
  }

  const record = parsed as Record<string, unknown>;
  const error = record.error;
  if (!error) {
    return null;
  }

  if (typeof error === "string") {
    return error;
  }

  if (typeof error === "object") {
    const errorRecord = error as Record<string, unknown>;
    const message = errorRecord.message || errorRecord.type || errorRecord.code;
    if (message) {
      return String(message);
    }
  }

  try {
    return JSON.stringify(error);
  } catch {
    return "Unknown provider stream error";
  }
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
