import { revalidateTag } from "next/cache";

export function invalidateIssueData() {
  revalidateTag("issues", { expire: 0 });
}

export function invalidateSiteSettings() {
  revalidateTag("site-settings", { expire: 0 });
}

export function invalidateFeedbackData() {
  revalidateTag("feedback", { expire: 0 });
}
