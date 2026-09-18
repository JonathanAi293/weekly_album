/**
 * `release_date` is a PostgreSQL date, so it arrives as an ISO calendar date.
 * Keep it as text instead of creating a Date object: a timezone conversion can
 * otherwise move the displayed date by one day on some clients.
 */
export function formatReleaseDate(releaseDate: string | null | undefined, releaseYear: number) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(releaseDate ?? "")) {
    return releaseDate!.replaceAll("-", ".");
  }

  return String(releaseYear);
}
