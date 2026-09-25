/** Pick one stable archive year for an issue from its recommended albums. */
export function deriveIssueReleaseYear(releaseYears: Array<number | null | undefined>): number | null {
  const counts = new Map<number, number>();
  for (const year of releaseYears) {
    if (Number.isInteger(year) && year !== null && year !== undefined) counts.set(year, (counts.get(year) ?? 0) + 1);
  }

  return [...counts.entries()]
    .sort(([yearA, countA], [yearB, countB]) => countB - countA || yearB - yearA)[0]?.[0] ?? null;
}
