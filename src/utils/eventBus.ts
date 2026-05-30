export class EventBus extends EventTarget {
  private static instance: EventBus | null = null;

  static getInstance(): EventBus {
    if (!EventBus.instance) {
      EventBus.instance = new EventBus();
    }
    return EventBus.instance;
  }

  static dispose(): void {
    EventBus.instance = null;
  }
}
