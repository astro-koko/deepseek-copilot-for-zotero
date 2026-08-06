export const SIDEBAR_SCROLL_BOTTOM_TOLERANCE = 24;

export interface SidebarScrollViewport {
  addEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: AddEventListenerOptions | boolean,
  ): void;
  clientHeight: number;
  removeEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: EventListenerOptions | boolean,
  ): void;
  scrollHeight: number;
  scrollTop: number;
  getBoundingClientRect(): { top: number };
  querySelectorAll(selector: string): ArrayLike<SidebarMessageElement>;
}

export interface SidebarMessageElement {
  dataset?: { aiAssistantMessageId?: string };
  getBoundingClientRect(): { bottom: number; top: number };
}

export interface SidebarScrollAnchor {
  messageId: string;
  offset: number;
}

export function isNearScrollBottom(
  viewport: Pick<
    SidebarScrollViewport,
    "clientHeight" | "scrollHeight" | "scrollTop"
  >,
  tolerance = SIDEBAR_SCROLL_BOTTOM_TOLERANCE,
): boolean {
  return (
    viewport.scrollHeight - viewport.clientHeight - viewport.scrollTop <=
    tolerance
  );
}

export function shouldFollowLatestOutput({
  hasVisibleOutput,
  wasNearBottom,
}: {
  hasVisibleOutput: boolean;
  wasNearBottom: boolean;
}): boolean {
  return hasVisibleOutput && wasNearBottom;
}

export function captureVisibleMessageAnchor(
  viewport: SidebarScrollViewport | null,
): SidebarScrollAnchor | null {
  if (!viewport) {
    return null;
  }

  const viewportRect = viewport.getBoundingClientRect();
  const messages = Array.from(
    viewport.querySelectorAll("[data-ai-assistant-message-id]"),
  );

  for (const message of messages) {
    const messageId = message.dataset?.aiAssistantMessageId;
    if (!messageId) {
      continue;
    }

    const messageRect = message.getBoundingClientRect();
    if (messageRect.bottom <= viewportRect.top) {
      continue;
    }

    return {
      messageId,
      offset: messageRect.top - viewportRect.top,
    };
  }

  return null;
}

export function restoreVisibleMessageAnchor(
  viewport: SidebarScrollViewport,
  anchor: SidebarScrollAnchor | null,
): void {
  if (!anchor) {
    return;
  }

  const message = Array.from(
    viewport.querySelectorAll("[data-ai-assistant-message-id]"),
  ).find(
    (candidate) => candidate.dataset?.aiAssistantMessageId === anchor.messageId,
  );
  if (!message) {
    return;
  }

  const viewportRect = viewport.getBoundingClientRect();
  const messageRect = message.getBoundingClientRect();
  viewport.scrollTop += messageRect.top - viewportRect.top - anchor.offset;
}
