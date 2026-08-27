import { ProjectForm } from "@/components/admin/portfolio/ProjectForm";

export default function NewProjectPage() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Add New Project</h1>
        <p className="mt-1 text-sm text-muted">Add a project to your public portfolio.</p>
      </div>
      <ProjectForm mode="create" />
    </div>
  );
}
