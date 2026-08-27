import { ServiceForm } from "@/components/admin/services/ServiceForm";

export default function NewServicePage() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Add New Service</h1>
        <p className="mt-1 text-sm text-muted">Add a service to your public services page.</p>
      </div>
      <ServiceForm mode="create" />
    </div>
  );
}
