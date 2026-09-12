import type { Rating } from "./rating";

export const listeningStatuses = ["want_to_listen", "listened", "not_interested"] as const;
export type ListeningStatus = (typeof listeningStatuses)[number];
export const ratingStatuses = ["pending", "rated", "no_rating"] as const;
export type RatingStatus = (typeof ratingStatuses)[number];

export type FeedbackRecord = {
  albumId: string;
  status: ListeningStatus | null;
  rating: Rating;
  ratingStatus: RatingStatus;
  comment: string;
  updatedAt: string;
  statusUpdatedAt: string | null;
};

export type FeedbackPatch = Pick<Partial<FeedbackRecord>, "status" | "rating" | "ratingStatus" | "comment">;
