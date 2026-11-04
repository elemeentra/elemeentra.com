import { formatDate } from "@/lib/date-utils";
import type { ThreadComment } from "@/lib/blog-public";

/** Approved comments with one level of replies (admin replies appear under the original comment). */
export function CommentThread({ comments }: { comments: ThreadComment[] }) {
  const top = comments.filter((c) => !c.parent_id);
  const repliesOf = (id: number) => comments.filter((c) => c.parent_id === id);
  if (top.length === 0) return null;

  return (
    <ul className="mb-10 space-y-4">
      {top.map((c) => (
        <li key={c.id}>
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-foreground">{c.name}</p>
              {c.created_at && <time className="text-xs text-muted">{formatDate(c.created_at)}</time>}
            </div>
            <p className="mt-1 whitespace-pre-line text-sm text-muted">{c.comment_text}</p>
          </div>
          {repliesOf(c.id).map((r) => (
            <div key={r.id} className="ml-6 mt-3 rounded-xl border border-crimson/20 bg-crimson-light/40 p-4 sm:ml-10">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-foreground">{r.name} <span className="ml-1 rounded-full bg-crimson px-1.5 py-0.5 text-[10px] font-bold uppercase text-white">Reply</span></p>
                {r.created_at && <time className="text-xs text-muted">{formatDate(r.created_at)}</time>}
              </div>
              <p className="mt-1 whitespace-pre-line text-sm text-muted">{r.comment_text}</p>
            </div>
          ))}
        </li>
      ))}
    </ul>
  );
}
