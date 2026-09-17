// A map over async work with a ceiling on how much of it runs at once
// (the-pipeline-reads-each-workspace-once).
//
// `Promise.all(items.map(read))` starts every read together. Reading a
// workspace of 256 archived changes that way queued thousands of file
// operations at once; with several such readings side by side, the editor's
// extension host ran out of file handles (EMFILE) and every other reading
// waited behind them. A ceiling keeps the work parallel without letting one
// reading take every handle.

/** `fn` over every item, in order, with at most `limit` calls running at a
 * time. Rejects with the first failure, as `Promise.all` does; calls already
 * started are left to finish. */
export async function mapBounded<T, R>(
  items: readonly T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array<R>(items.length);
  const ceiling = Math.max(1, Math.floor(limit));
  let next = 0;
  let failed = false;
  const worker = async (): Promise<void> => {
    while (!failed && next < items.length) {
      const index = next;
      next += 1;
      try {
        results[index] = await fn(items[index] as T, index);
      } catch (error) {
        failed = true;
        throw error;
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(ceiling, items.length) }, worker));
  return results;
}
