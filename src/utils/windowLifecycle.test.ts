import { describe, expect, it, vi } from "vitest";

import {
  createRefCountedRegistration,
  createWindowEventDispatcher,
} from "./windowLifecycle";

class FakeEventBus extends EventTarget {
  readonly events: Array<{ type: string; detail: unknown }> = [];

  constructor() {
    super();
    this.addEventListener("scopeChange", (event) => {
      this.events.push({
        type: event.type,
        detail: (event as CustomEvent).detail,
      });
    });
  }
}

class FakeWindow {
  __aiAssistantEventBus?: FakeEventBus;

  constructor(withEventBus = true) {
    if (withEventBus) {
      this.__aiAssistantEventBus = new FakeEventBus();
    }
  }
}

describe("windowLifecycle", () => {
  it("broadcasts scope changes to every registered window event bus", () => {
    const dispatcher = createWindowEventDispatcher<FakeWindow>("scopeChange");
    const firstWindow = new FakeWindow();
    const secondWindow = new FakeWindow();

    dispatcher.addWindow(firstWindow);
    dispatcher.addWindow(secondWindow);
    dispatcher.dispatch({ type: "paper", id: "paper-1" });

    expect(firstWindow.__aiAssistantEventBus?.events).toEqual([
      { type: "scopeChange", detail: { type: "paper", id: "paper-1" } },
    ]);
    expect(secondWindow.__aiAssistantEventBus?.events).toEqual([
      { type: "scopeChange", detail: { type: "paper", id: "paper-1" } },
    ]);
  });

  it("stops sending events to windows after they are removed", () => {
    const dispatcher = createWindowEventDispatcher<FakeWindow>("scopeChange");
    const activeWindow = new FakeWindow();
    const removedWindow = new FakeWindow();

    dispatcher.addWindow(activeWindow);
    dispatcher.addWindow(removedWindow);
    dispatcher.removeWindow(removedWindow);
    dispatcher.dispatch({ type: "collection", id: "collection-1" });

    expect(activeWindow.__aiAssistantEventBus?.events).toEqual([
      {
        type: "scopeChange",
        detail: { type: "collection", id: "collection-1" },
      },
    ]);
    expect(removedWindow.__aiAssistantEventBus?.events).toEqual([]);
  });

  it("registers shared resources once and releases them after the last window", () => {
    const register = vi.fn();
    const unregister = vi.fn();
    const registration = createRefCountedRegistration(register, unregister);

    registration.acquire();
    registration.acquire();

    expect(register).toHaveBeenCalledTimes(1);
    expect(unregister).not.toHaveBeenCalled();

    registration.release();
    expect(unregister).not.toHaveBeenCalled();

    registration.release();
    expect(unregister).toHaveBeenCalledTimes(1);
  });

  it("ignores extra release calls and supports reset", () => {
    const register = vi.fn();
    const unregister = vi.fn();
    const registration = createRefCountedRegistration(register, unregister);

    registration.acquire();
    registration.release();
    registration.release();
    registration.reset();

    expect(register).toHaveBeenCalledTimes(1);
    expect(unregister).toHaveBeenCalledTimes(1);
  });
});
