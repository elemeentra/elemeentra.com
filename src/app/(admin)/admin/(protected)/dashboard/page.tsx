import { Briefcase, FileText, Mail, Send, MessageSquare, UserSquare2 } from "lucide-react";
import { query, type RowDataPacket } from "@/lib/db";

interface CountRow extends RowDataPacket {
  count: number;
}

async function getCount(sql: string, params: unknown[] = []): Promise<number> {
  try {
    const rows = await query<CountRow>(sql, params);
    return Number(rows[0]?.count ?? 0);
  } catch {
    // Table may not have data / DB not yet seeded on a fresh install — fail soft to 0
    // rather than crashing the whole dashboard.
    return 0;
  }
}

async function getStats() {
  const [
    totalProjects,
    published,
    draft,
    scheduled,
    unreadContacts,
    subscribers,
    pendingComments,
    teamMembers,
  ] = await Promise.all([
    getCount("SELECT COUNT(*) AS count FROM projects"),
    getCount("SELECT COUNT(*) AS count FROM posts WHERE status = 'published'"),
    getCount("SELECT COUNT(*) AS count FROM posts WHERE status = 'draft'"),
    getCount("SELECT COUNT(*) AS count FROM posts WHERE status = 'scheduled'"),
    getCount("SELECT COUNT(*) AS count FROM contact_messages WHERE is_read = FALSE"),
    getCount("SELECT COUNT(*) AS count FROM newsletter_subscribers WHERE unsubscribed_at IS NULL"),
    getCount("SELECT COUNT(*) AS count FROM comments WHERE approved = FALSE"),
    getCount("SELECT COUNT(*) AS count FROM team_members"),
  ]);

  return {
    totalProjects,
    posts: { published, draft, scheduled },
    unreadContacts,
    subscribers,
    pendingComments,
    teamMembers,
  };
}

export default async function DashboardPage() {
  const stats = await getStats();

  const cards = [
    {
      label: "Portfolio Projects",
      value: stats.totalProjects,
      icon: Briefcase,
      detail: null as string | null,
    },
    {
      label: "Blog Posts",
      value: stats.posts.published + stats.posts.draft + stats.posts.scheduled,
      icon: FileText,
      detail: `${stats.posts.published} published · ${stats.posts.draft} draft · ${stats.posts.scheduled} scheduled`,
    },
    {
      label: "Unread Messages",
      value: stats.unreadContacts,
      icon: Mail,
      detail: null,
    },
    {
      label: "Newsletter Subscribers",
      value: stats.subscribers,
      icon: Send,
      detail: null,
    },
    {
      label: "Pending Comments",
      value: stats.pendingComments,
      icon: MessageSquare,
      detail: null,
    },
    {
      label: "Team Members",
      value: stats.teamMembers,
      icon: UserSquare2,
      detail: null,
    },
  ];

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
        <p className="mt-1 text-sm text-muted">Overview of your Elemeentra site.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.label}
              className="rounded-2xl border border-border bg-card p-5 shadow-sm"
            >
              <div className="mb-3 flex items-center justify-between">
                <span className="text-sm font-medium text-muted">{card.label}</span>
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-crimson-light text-crimson">
                  <Icon className="h-4 w-4" />
                </div>
              </div>
              <p className="text-3xl font-bold text-foreground">{card.value}</p>
              {card.detail && <p className="mt-1 text-xs text-muted">{card.detail}</p>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
