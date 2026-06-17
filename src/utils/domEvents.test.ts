import { afterEach, describe, expect, it } from "vitest";

import { createHostCustomEvent, createHostEvent } from "./domEvents";

describe("domEvents", () => {
  const originalEvent = globalThis.Event;
  const originalCustomEvent = globalThis.CustomEvent;

  afterEach(() => {
    (globalThis as any).Event = originalEvent;
    (globalThis as any).CustomEvent = originalCustomEvent;
  });

  it("creates plain events from the host window when the plugin global lacks Event", () => {
    (globalThis as any).Event = undefined;

    const event = createHostEvent("settingsChange", {
      Event: originalEvent,
    } as unknown as Window);

    expect(event.type).toBe("settingsChange");
  });

  it("creates custom events from the host window when the plugin global lacks CustomEvent", () => {
    (globalThis as any).CustomEvent = undefined;

    const event = createHostCustomEvent("scopeChange", { id: "paper-1" }, {
      CustomEvent: originalCustomEvent,
      Event: originalEvent,
    } as unknown as Window);

    expect(event.type).toBe("scopeChange");
    expect(event.detail).toEqual({ id: "paper-1" });
  });
});
