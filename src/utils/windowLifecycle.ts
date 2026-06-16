type EventBusWindowLike = {
  __aiAssistantEventBus?: EventTarget;
};

export function createWindowEventDispatcher<
  TWindow extends EventBusWindowLike,
  TDetail = unknown,
>(eventName: string) {
  const windows = new Set<TWindow>();

  return {
    addWindow(win: TWindow) {
      windows.add(win);
    },
    removeWindow(win: TWindow) {
      windows.delete(win);
    },
    clear() {
      windows.clear();
    },
    dispatch(detail: TDetail) {
      for (const win of windows) {
        const eventBus = win.__aiAssistantEventBus;
        if (!eventBus) continue;
        eventBus.dispatchEvent(new CustomEvent(eventName, { detail }));
      }
    },
  };
}

export function createRefCountedRegistration(
  register: () => void,
  unregister: () => void,
) {
  let refCount = 0;

  return {
    acquire() {
      refCount += 1;
      if (refCount === 1) {
        register();
      }
    },
    release() {
      if (refCount === 0) return;

      refCount -= 1;
      if (refCount === 0) {
        unregister();
      }
    },
    reset() {
      if (refCount > 0) {
        refCount = 0;
        unregister();
      }
    },
  };
}
