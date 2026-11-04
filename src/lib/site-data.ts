import "server-only";
import { PUBLISHED_SQL } from "@/lib/post-visibility";
import { query, type RowDataPacket } from "@/lib/db";
import { getReviewColumns } from "@/lib/reviews-schema";

/** Safe JSON-array parser for JSON columns (mysql2 may return string or array). */
export function parseJsonArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((v): v is string => typeof v === "string");
  if (typeof value === "string" && value.trim()) {
    try {
      const parsed: unknown = JSON.parse(value);
      return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : [];
    } catch {
      return [];
    }
  }
  return [];
}

export interface SiteService {
  id: number;
  icon: string | null;
  title: string;
  slug: string;
  short_description: string | null;
  full_description: string | null;
  benefits: string[];
}

interface ServiceRow extends RowDataPacket {
  id: number; icon: string | null; title: string; slug: string;
  short_description: string | null; full_description: string | null; benefits: unknown;
}

const mapService = (r: ServiceRow): SiteService => ({ ...r, benefits: parseJsonArray(r.benefits) });

export async function getActiveServices(limit?: number): Promise<SiteService[]> {
  const rows = await query<ServiceRow>(
    `SELECT id, icon, title, slug, short_description, full_description, benefits
     FROM services WHERE status = 'active'
     ORDER BY display_order ASC, id ASC ${limit ? "LIMIT ?" : ""}`,
    limit ? [limit] : []
  );
  return rows.map(mapService);
}

export async function getServiceBySlug(slug: string): Promise<SiteService | null> {
  const rows = await query<ServiceRow>(
    `SELECT id, icon, title, slug, short_description, full_description, benefits
     FROM services WHERE slug = ? AND status = 'active' LIMIT 1`,
    [slug]
  );
  return rows[0] ? mapService(rows[0]) : null;
}

export interface SiteProject {
  id: number;
  title: string;
  slug: string;
  category: string;
  client_name: string | null;
  description: string | null;
  challenge: string | null;
  solution: string | null;
  result_summary: string | null;
  image_url: string | null;
  gallery_images: string[];
  tech_tags: string[];
  project_url: string | null;
  results: string | null;
  featured: boolean;
}

interface ProjectRow extends RowDataPacket {
  id: number; title: string; slug: string; category: string; client_name: string | null;
  description: string | null; challenge: string | null; solution: string | null;
  result_summary: string | null; image_url: string | null; gallery_images: unknown;
  tech_tags: unknown; project_url: string | null; results: string | null; featured: number;
}

const PROJECT_COLS = `id, title, slug, category, client_name, description, challenge, solution,
  result_summary, image_url, gallery_images, tech_tags, project_url, results, featured`;

const mapProject = (r: ProjectRow): SiteProject => ({
  ...r,
  featured: Boolean(r.featured),
  gallery_images: parseJsonArray(r.gallery_images),
  tech_tags: parseJsonArray(r.tech_tags),
});

export async function getProjects(opts: { featuredOnly?: boolean; limit?: number } = {}): Promise<SiteProject[]> {
  const where = opts.featuredOnly ? "WHERE featured = 1" : "";
  const rows = await query<ProjectRow>(
    `SELECT ${PROJECT_COLS} FROM projects ${where}
     ORDER BY display_order ASC, id DESC ${opts.limit ? "LIMIT ?" : ""}`,
    opts.limit ? [opts.limit] : []
  );
  return rows.map(mapProject);
}

export async function getProjectBySlug(slug: string): Promise<SiteProject | null> {
  const rows = await query<ProjectRow>(`SELECT ${PROJECT_COLS} FROM projects WHERE slug = ? LIMIT 1`, [slug]);
  return rows[0] ? mapProject(rows[0]) : null;
}

export interface SiteReview {
  id: number; name: string; rating: number; review_title: string | null; review_text: string | null;
}
type ReviewRow = RowDataPacket & SiteReview;

export async function getApprovedReviews(limit = 6): Promise<SiteReview[]> {
  const col = await getReviewColumns();
  return query<ReviewRow>(
    `SELECT id, name, rating, ${col.title ?? "NULL"} AS review_title, ${col.text} AS review_text
     FROM reviews WHERE status = 'approved'
     ORDER BY ${col.featured ? "featured DESC, " : ""}created_at DESC LIMIT ?`,
    [limit]
  );
}

export interface SitePost {
  title: string; slug: string; excerpt: string | null; featured_image: string | null; published_at: string | null;
}
type PostRow = RowDataPacket & SitePost;

export async function getLatestPosts(limit = 3): Promise<SitePost[]> {
  return query<PostRow>(
    `SELECT title, slug, excerpt, featured_image, published_at
     FROM posts WHERE ${PUBLISHED_SQL}
     ORDER BY published_at DESC LIMIT ?`,
    [limit]
  );
}

export interface SiteTeamMember {
  id: number; name: string; role: string | null; photo_url: string | null; bio: string | null; linkedin_url: string | null;
}
type TeamRow = RowDataPacket & SiteTeamMember;

export async function getTeamMembers(): Promise<SiteTeamMember[]> {
  return query<TeamRow>(
    `SELECT id, name, role, photo_url, bio, linkedin_url
     FROM team_members ORDER BY display_order ASC, id ASC`
  );
}

export async function getReviewStats(): Promise<{ count: number; average: number }> {
  const rows = await query<RowDataPacket & { c: number; a: string | null }>(
    "SELECT COUNT(*) AS c, AVG(rating) AS a FROM reviews WHERE status = 'approved'"
  );
  return { count: Number(rows[0]?.c ?? 0), average: Number(rows[0]?.a ?? 0) };
}

export interface SiteComment { id: number; name: string; comment_text: string | null; created_at: string | null }
type CommentRow = RowDataPacket & SiteComment;

export async function getApprovedComments(postId: number): Promise<SiteComment[]> {
  return query<CommentRow>(
    `SELECT id, name, comment_text, created_at FROM comments
     WHERE post_id = ? AND approved = TRUE ORDER BY created_at ASC LIMIT 100`,
    [postId]
  );
}
