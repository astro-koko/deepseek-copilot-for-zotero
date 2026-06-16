import { beforeEach, describe, expect, it, vi } from "vitest";

import { cleanupReaderIntegration, initReaderIntegration } from "./readerIntegration";
import { clearDebugLog, serializeDebugLog } from "../utils/debugLog";

class FakeEventBus extends EventTarget {
  dispatched: Array<{ type: string; detail: unknown }> = [];

  override dispatchEvent(event: Event): boolean {
    this.dispatched.push({
      detail: (event as CustomEvent).detail,
      type: event.type,
    });
    return true;
  }
}

describe("readerIntegration", () => {
  const registerEventListener = vi.fn();
  const unregisterEventListener = vi.fn();

  beforeEach(() => {
    clearDebugLog();
    registerEventListener.mockReset();
    unregisterEventListener.mockReset();

    vi.stubGlobal("addon", {
      data: {
        config: {
          addonID: "test-addon-id",
        },
      },
    });
    vi.stubGlobal("ztoolkit", {
      log: vi.fn(),
    });
    vi.stubGlobal("Zotero", {
      Prefs: {
        get: vi.fn(() => "en-US"),
      },
      Reader: {
        registerEventListener,
        unregisterEventListener,
      },
      getMainWindow: vi.fn(),
      locale: "en-US",
    });
  });

  it("registers both Reader event listeners with the addon id", () => {
    initReaderIntegration();

    expect(registerEventListener).toHaveBeenNthCalledWith(
      1,
      "renderTextSelectionPopup",
      expect.any(Function),
      "test-addon-id",
    );
    expect(registerEventListener).toHaveBeenNthCalledWith(
      2,
      "createViewContextMenu",
      expect.any(Function),
      "test-addon-id",
    );
  });

  it("unregisters both Reader event listeners during cleanup", () => {
    initReaderIntegration();
    const popupHandler = registerEventListener.mock.calls[0][1];
    const contextMenuHandler = registerEventListener.mock.calls[1][1];

    cleanupReaderIntegration();

    expect(unregisterEventListener).toHaveBeenNthCalledWith(
      1,
      "renderTextSelectionPopup",
      popupHandler,
    );
    expect(unregisterEventListener).toHaveBeenNthCalledWith(
      2,
      "createViewContextMenu",
      contextMenuHandler,
    );
  });

  it("dispatches a readerSelectionAction event from the text selection popup", () => {
    const eventBus = new FakeEventBus();
    const customEventCtor = class HostCustomEvent<T> extends Event {
      detail: T;

      constructor(type: string, init: CustomEventInit<T>) {
        super(type);
        this.detail = init.detail as T;
      }
    };

    (Zotero.getMainWindow as ReturnType<typeof vi.fn>).mockReturnValue({
      __aiAssistantEventBus: eventBus,
      CustomEvent: customEventCtor,
    });

    initReaderIntegration();
    const popupHandler = registerEventListener.mock.calls[0][1] as (
      event: Parameters<typeof registerEventListener>[1] extends (arg: infer T) => unknown
        ? T
        : never,
    ) => void;

    const explainButtonListeners = new Map<string, () => void>();
    const askButtonListeners = new Map<string, () => void>();
    const createdButtons: Array<{
      addEventListener: (type: string, listener: () => void) => void;
      textContent?: string;
    }> = [];

    const doc = {
      createElement: (tag: string) => {
        const node = {
          appendChild: vi.fn(),
          className: "",
          style: { cssText: "" },
          textContent: "",
        };

        if (tag === "button") {
          const listeners = createdButtons.length === 0 ? explainButtonListeners : askButtonListeners;
          const button = {
            ...node,
            addEventListener: (type: string, listener: () => void) => {
              listeners.set(type, listener);
            },
          };
          createdButtons.push(button);
          return button;
        }

        return node;
      },
    } as unknown as Document;

    popupHandler({
      append: vi.fn(),
      doc,
      params: {
        annotation: {
          pageIndex: 2,
          text: "Important selection",
        },
      },
      reader: {
        itemID: 42,
        type: "pdf",
      },
      type: "renderTextSelectionPopup",
    });

    const explainClick = explainButtonListeners.get("click");
    if (!explainClick) {
      throw new Error("Expected Explain button click listener");
    }
    explainClick();

    expect(eventBus.dispatched).toEqual([
      {
        detail: {
          action: "explain",
          page: 3,
          readerItemID: 42,
          text: "Important selection",
          traceId: expect.stringMatching(/^reader-explain-/),
        },
        type: "readerSelectionAction",
      },
    ]);
    const logs = serializeDebugLog();
    expect(logs).toContain("reader.popup.render");
    expect(logs).toContain("reader.action.dispatch");
    expect(logs).toContain('"selectedTextChars":19');
    expect(logs).not.toContain("Important selection");
  });

  it("logs a blocked action when the popup click has no event bus", () => {
    (Zotero.getMainWindow as ReturnType<typeof vi.fn>).mockReturnValue({
      CustomEvent,
    });

    initReaderIntegration();
    const popupHandler = registerEventListener.mock.calls[0][1] as (
      event: Parameters<typeof registerEventListener>[1] extends (arg: infer T) => unknown
        ? T
        : never,
    ) => void;

    const buttonListeners = new Map<string, () => void>();
    const doc = {
      createElement: (tag: string) => {
        const node = {
          appendChild: vi.fn(),
          className: "",
          style: { cssText: "" },
          textContent: "",
        };
        if (tag === "button") {
          return {
            ...node,
            addEventListener: (type: string, listener: () => void) => {
              if (!buttonListeners.has(type)) {
                buttonListeners.set(type, listener);
              }
            },
          };
        }
        return node;
      },
    } as unknown as Document;

    popupHandler({
      append: vi.fn(),
      doc,
      params: {
        annotation: {
          pageIndex: 0,
          text: "Hidden text should not be logged",
        },
      },
      reader: {
        itemID: 42,
        type: "pdf",
      },
      type: "renderTextSelectionPopup",
    });

    buttonListeners.get("click")?.();

    const logs = serializeDebugLog();
    expect(logs).toContain("reader.action.blocked");
    expect(logs).toContain("missing-event-bus");
    expect(logs).not.toContain("Hidden text should not be logged");
  });
});
