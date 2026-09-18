export type RecommendationKind = "taste_match" | "exploration";

export type AlbumCover = {
  manualCoverUrl: string | null;
  musicbrainzReleaseGroupId: string | null;
  fallbackUrl: string | null;
  legacyCoverUrl: string | null;
};

export type Album = {
  id: string;
  title: string;
  artist: string;
  releaseYear: number;
  tags: string[];
  cover: AlbumCover;
  type: "口味命中" | "探索推荐";
  reason: string;
  review: string;
  source: string;
  sourceUrl: string | null;
};

export type Issue = {
  id: string;
  slug: string;
  number: string;
  date: string;
  title: string;
  subtitle?: string | null;
  intro: string;
  albums: Album[];
};

export type IssueListItem = Omit<Issue, "albums"> & { albumCount: number };
export type LibraryAlbum = { album: Album; issueSlug: string; issueNumber: string; issueDate: string; publishedAt: string };

export type PreferenceProfile = {
  profileText: string | null;
  profileJson: Record<string, unknown> | null;
  version: number;
  createdAt: string;
};
