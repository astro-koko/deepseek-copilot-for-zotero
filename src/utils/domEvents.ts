export function createHostEvent(type: string, win?: Window | null): Event {
  const EventCtor =
    win?.Event ??
    (globalThis as typeof globalThis & { Event?: typeof Event }).Event;
  if (typeof EventCtor === "function") {
    return new EventCtor(type);
  }

  const event = win?.document?.createEvent?.("Event");
  if (event) {
    event.initEvent(type, false, false);
    return event;
  }

  throw new Error(`Unable to create DOM event: ${type}`);
}

export function createHostCustomEvent<T>(
  type: string,
  detail: T,
  win?: Window | null,
): CustomEvent {
  const CustomEventCtor =
    win?.CustomEvent ??
    (globalThis as typeof globalThis & { CustomEvent?: typeof CustomEvent })
      .CustomEvent;
  if (typeof CustomEventCtor === "function") {
    return new CustomEventCtor(type, { detail });
  }

  const event = createHostEvent(type, win) as CustomEvent;
  Object.defineProperty(event, "detail", {
    configurable: true,
    value: detail,
  });
  return event;
}
