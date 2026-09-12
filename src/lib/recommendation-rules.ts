import type { Rating } from "./rating";
import type { RatingStatus } from "./feedback";

export type PreferenceStrength = "clear_negative" | "neutral_weak" | "positive" | "strong_positive" | "very_strong_positive" | "top_tier";

// Internal-only calibration. Never render this copy in the scoring UI.
export const PERSONAL_RATING_RULES = `
The user's ratings are deliberately strict. Do not apply a typical public-review scale.
- below 5.0: clear negative feedback; shortcomings materially affected the experience.
- 5.0–5.5: neutral-to-weak; some merit, but overall ordinary.
- 6.0–6.5: positive feedback; a good album worth hearing, not a failure.
- 7.0–7.5: strong positive feedback; clearly liked, with replay or collection value.
- 8.0–8.5: very strong personal-aesthetic match; likely repeated listening.
- 9.0–10.0: rare top-tier signal (annual or long-term level), never treat as routine.
Interpret a score with its short review, listening status, and any replay evidence. A no_rating decision is neutral: it is not 0, low, negative, or eligible for numeric averages, ranking, hit-rate calculations, or numerical preference signals. Its written comment can still supply qualitative taste signals. Pending (no score decision yet) is also numerically neutral. If prose and score appear to conflict, re-evaluate using this strict scale before assuming negativity. Keep the original rating unchanged; this rule only maps it to preference strength.
`;

export function ratingToPreferenceStrength(rating: Rating, ratingStatus: RatingStatus): PreferenceStrength | null {
  if (rating === null || ratingStatus !== "rated") return null;
  if (rating < 5) return "clear_negative";
  if (rating <= 5.5) return "neutral_weak";
  if (rating <= 6.5) return "positive";
  if (rating <= 7.5) return "strong_positive";
  if (rating <= 8.5) return "very_strong_positive";
  return "top_tier";
}

export const PROFILE_REFRESH_INSTRUCTIONS = `${PERSONAL_RATING_RULES}
Use recent changes as a modifier, not a replacement for long-term evidence. Infer preferences from multiple signals rather than one rating. Preserve uncertainty when evidence is thin.`;

export const WEEKLY_RECOMMENDATION_INSTRUCTIONS = `${PERSONAL_RATING_RULES}
Favor candidates that connect to strong and very-strong positive signals. Keep 2–3 meaningful exploration picks that have at least one bridge to known taste, exclude primary rap/hip-hop, and avoid albums already recommended or heard.`;
