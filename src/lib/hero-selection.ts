import { isNumericRating } from "./rating";
import type { FeedbackRecord } from "./feedback";

type Issue<Album extends { id: string }> = {
  slug: string;
  issue_number: number;
  recommendations: Array<{ display_order: number; albums: Album | null }>;
};

/** Skip the latest published issue, then choose the highest score in the first qualifying issue. */
export function selectPreviousIssueHero<Album extends { id: string }>(issues: Issue<Album>[], feedback: FeedbackRecord[]) {
  const ratings = new Map(feedback.filter(record => isNumericRating(record.rating, record.ratingStatus) && record.rating >= 7).map(record => [record.albumId, record.rating as number]));
  for (const issue of [...issues].sort((a, b) => b.issue_number - a.issue_number).slice(1)) {
    const eligible = (issue.recommendations ?? []).flatMap(recommendation => {
      const album = recommendation.albums;
      const rating = album ? ratings.get(album.id) : undefined;
      return album && rating !== undefined ? [{ album, rating, displayOrder: recommendation.display_order }] : [];
    }).sort((a, b) => b.rating - a.rating || a.displayOrder - b.displayOrder);
    if (eligible.length) return { ...eligible[0], issueNumber: issue.issue_number, issueSlug: issue.slug };
  }
  return null;
}
