/** Opt-in timings for local performance diagnosis. Never log URLs or credentials. */
export async function auditStep<T>(label: string, work: () => Promise<T>): Promise<T> {
  if (process.env.PERF_AUDIT !== "1") return work();
  const start = performance.now();
  try { return await work(); }
  finally { console.info(`[perf] ${label}: ${(performance.now() - start).toFixed(0)}ms`); }
}

export const auditedFetch: typeof fetch = async (input, init) => {
  if (process.env.PERF_AUDIT !== "1") return fetch(input, init);
  const start = performance.now();
  const path = new URL(typeof input === "string" || input instanceof URL ? input : input.url).pathname;
  try { return await fetch(input, init); }
  finally { console.info(`[perf] supabase ${path}: ${(performance.now() - start).toFixed(0)}ms`); }
};
