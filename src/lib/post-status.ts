export const POST_STATUSES = ["draft", "pending", "scheduled", "published", "trash"] as const;
export type PostStatus = (typeof POST_STATUSES)[number];

/** Statuses that make a post (potentially) public — these need the "publish" permission. */
export const PUBLISHING_STATUSES: readonly PostStatus[] = ["published", "scheduled"];
