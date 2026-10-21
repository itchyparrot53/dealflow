import { AsyncLocalStorage } from "node:async_hooks";

// The event chain travels out-of-band so a service called by an automation action needs no new
// parameter: the runner opens a chain, every write inside it inherits the same id and one more
// depth, and the dispatcher can therefore recognise a loop (same chain, same record).
export type ChainContext = {
  chainId: string;
  depth: number;
  automationId: string | null;
};

const storage = new AsyncLocalStorage<ChainContext>();

export function currentChain(): ChainContext | undefined {
  return storage.getStore();
}

export function runInChain<T>(ctx: ChainContext, fn: () => Promise<T>): Promise<T> {
  return storage.run(ctx, fn);
}
