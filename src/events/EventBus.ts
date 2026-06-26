import type { GameEventMap, GameEventName } from './GameEvents';

type Handler<T> = (payload: T) => void;

/**
 * A tiny, dependency-free, strongly-typed publish/subscribe bus.
 *
 * It is the single seam between the pure game core, the controllers and the
 * Phaser/DOM views: nothing in `core/` imports a view, and no view imports the
 * engine directly — they communicate exclusively through these events.
 */
export class EventBus {
  // Internally untyped for storage; the public methods enforce the typing.
  private handlers = new Map<GameEventName, Set<Handler<unknown>>>();

  on<K extends GameEventName>(event: K, handler: Handler<GameEventMap[K]>): () => void {
    let set = this.handlers.get(event);
    if (!set) {
      set = new Set();
      this.handlers.set(event, set);
    }
    set.add(handler as Handler<unknown>);
    return () => this.off(event, handler);
  }

  once<K extends GameEventName>(event: K, handler: Handler<GameEventMap[K]>): () => void {
    const off = this.on(event, (payload) => {
      off();
      handler(payload);
    });
    return off;
  }

  off<K extends GameEventName>(event: K, handler: Handler<GameEventMap[K]>): void {
    this.handlers.get(event)?.delete(handler as Handler<unknown>);
  }

  emit<K extends GameEventName>(event: K, payload: GameEventMap[K]): void {
    // Copy to a list so handlers may safely unsubscribe during dispatch.
    const set = this.handlers.get(event);
    if (!set) return;
    for (const handler of [...set]) (handler as Handler<GameEventMap[K]>)(payload);
  }

  clear(): void {
    this.handlers.clear();
  }
}
