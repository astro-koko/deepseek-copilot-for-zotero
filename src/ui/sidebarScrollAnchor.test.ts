import { describe, expect, it } from "vitest";

import {
  captureVisibleMessageAnchor,
  isNearScrollBottom,
  restoreVisibleMessageAnchor,
  shouldFollowLatestOutput,
} from "./sidebarScrollAnchor";

interface FakeMessage {
  id: string;
  top: number;
  bottom: number;
}

function createViewport({
  messages,
  scrollTop = 0,
}: {
  messages: FakeMessage[];
  scrollTop?: number;
}) {
  const viewport = {
    addEventListener() {},
    clientHeight: 120,
    removeEventListener() {},
    scrollHeight: 600,
    scrollTop,
    getBoundingClientRect: () => ({ top: 100 }),
    querySelectorAll: () =>
      messages.map((message) => ({
        dataset: { aiAssistantMessageId: message.id },
        getBoundingClientRect: () => ({
          bottom: message.bottom,
          top: message.top,
        }),
      })),
  };

  return viewport;
}

describe("sidebar scroll anchoring", () => {
  it("restores the first visible message to its prior viewport offset after reflow", () => {
    const viewport = createViewport({
      messages: [
        { id: "earlier", top: 60, bottom: 98 },
        { id: "anchor", top: 118, bottom: 260 },
        { id: "later", top: 280, bottom: 460 },
      ],
    });
    const anchor = captureVisibleMessageAnchor(viewport);

    expect(anchor).toEqual({ messageId: "anchor", offset: 18 });

    const reflowedViewport = createViewport({
      messages: [
        { id: "earlier", top: 40, bottom: 94 },
        { id: "anchor", top: 146, bottom: 334 },
        { id: "later", top: 360, bottom: 620 },
      ],
      scrollTop: 240,
    });

    restoreVisibleMessageAnchor(reflowedViewport, anchor!);

    expect(reflowedViewport.scrollTop).toBe(268);
  });

  it("never follows new output when the reader was above the bottom", () => {
    expect(
      shouldFollowLatestOutput({
        hasVisibleOutput: true,
        wasNearBottom: false,
      }),
    ).toBe(false);
  });

  it("follows new output only when the reader was already near the bottom", () => {
    expect(
      isNearScrollBottom({
        clientHeight: 120,
        scrollHeight: 600,
        scrollTop: 454,
      }),
    ).toBe(false);
    expect(
      isNearScrollBottom({
        clientHeight: 120,
        scrollHeight: 600,
        scrollTop: 464,
      }),
    ).toBe(true);
    expect(
      shouldFollowLatestOutput({
        hasVisibleOutput: true,
        wasNearBottom: true,
      }),
    ).toBe(true);
  });
});
