import type { GameAdapter } from './game-adapter';

export class AdapterRegistry {
  readonly #adapters = new Map<string, GameAdapter>();
  register(adapter: GameAdapter) { if (this.#adapters.has(adapter.id)) throw new Error(`Duplicate game adapter: ${adapter.id}`); this.#adapters.set(adapter.id, adapter); return this; }
  get(id: string) { const adapter = this.#adapters.get(id); if (!adapter) throw new Error(`Unknown game adapter: ${id}`); return adapter; }
  list() { return [...this.#adapters.values()]; }
}
