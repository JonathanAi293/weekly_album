export type Rating = number | null;

export const RATING_MIN = 1;
export const RATING_MAX = 10;
export const RATING_STEP = 0.5;
export const RATING_SLIDER_MIN = 0;
export const RATING_SLIDER_MAX = 19;

export function isValidRating(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= RATING_MIN && value <= RATING_MAX && Number.isInteger(value / RATING_STEP);
}

export function formatRating(value: Rating) {
  return value === null ? "—" : value.toFixed(1);
}

/** UI-only positions. Position 0 deliberately maps to no_rating, never numeric zero. */
export function sliderIndexToRating(index: number) {
  if (index <= 0) return { rating:null, ratingStatus:"no_rating" as const };
  return { rating: RATING_MIN + (index - 1) * RATING_STEP, ratingStatus:"rated" as const };
}

export function ratingToSliderIndex(rating: Rating, ratingStatus: "pending" | "rated" | "no_rating") {
  if (ratingStatus === "no_rating") return 0;
  if (ratingStatus === "rated" && isValidRating(rating)) return Math.round((rating - RATING_MIN) / RATING_STEP) + 1;
  // Pending is not a slider option; park its visual thumb at 1.0 without creating a rating.
  return 1;
}

/** Only this state is eligible for averages, ranking, hit-rate calculations, and numeric taste signals. */
export function isNumericRating(value: Rating, ratingStatus: "pending" | "rated" | "no_rating"): value is number {
  return ratingStatus === "rated" && isValidRating(value);
}
