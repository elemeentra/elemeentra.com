import { notFound } from "next/navigation";
import { query, type RowDataPacket } from "@/lib/db";
import { paragraphsToText } from "@/lib/sanitize";
import { ProjectForm, type ProjectFormData } from "@/components/admin/portfolio/ProjectForm";

interface ProjectRow extends RowDataPacket {
  id: number;
  title: string;
  category: string;
  client_name: string | null;
  description: string | null;
  challenge: string | null;
  solution: string | null;
  result_summary: string | null;
  image_url: string | null;
  gallery_images: string | null;
  tech_tags: string | null;
  project_url: string | null;
  results: string | null;
  featured: number;
  display_order: number;
}

export default async function EditProjectPage({ params }: { params: { id: string } }) {
  const id = Number(params.id);
  if (!Number.isInteger(id) || id <= 0) notFound();

  const rows = await query<ProjectRow>("SELECT * FROM projects WHERE id = ? LIMIT 1", [id]);
  const project = rows[0];
  if (!project) notFound();

  const initialData: Partial<ProjectFormData> = {
    title: project.title,
    category: project.category,
    client_name: project.client_name ?? "",
    description: project.description ?? "",
    challenge: paragraphsToText(project.challenge),
    solution: paragraphsToText(project.solution),
    result_summary: project.result_summary ?? "",
    image_url: project.image_url,
    gallery_images: project.gallery_images ? JSON.parse(project.gallery_images) : [],
    tech_tags: project.tech_tags ? JSON.parse(project.tech_tags) : [],
    project_url: project.project_url ?? "",
    results: paragraphsToText(project.results),
    featured: Boolean(project.featured),
    display_order: project.display_order,
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Edit Project</h1>
        <p className="mt-1 text-sm text-muted">{project.title}</p>
      </div>
      <ProjectForm mode="edit" projectId={project.id} initialData={initialData} />
    </div>
  );
}
