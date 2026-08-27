import { notFound } from "next/navigation";
import { query, type RowDataPacket } from "@/lib/db";
import { ServiceForm, type ServiceFormData } from "@/components/admin/services/ServiceForm";

interface ServiceRow extends RowDataPacket {
  id: number;
  icon: string | null;
  title: string;
  short_description: string | null;
  full_description: string | null;
  benefits: string | null;
  status: "active" | "inactive";
  display_order: number;
}

export default async function EditServicePage({ params }: { params: { id: string } }) {
  const id = Number(params.id);
  if (!Number.isInteger(id) || id <= 0) notFound();

  const rows = await query<ServiceRow>("SELECT * FROM services WHERE id = ? LIMIT 1", [id]);
  const service = rows[0];
  if (!service) notFound();

  const initialData: Partial<ServiceFormData> = {
    icon: service.icon ?? "",
    title: service.title,
    short_description: service.short_description ?? "",
    full_description: service.full_description ?? "",
    benefits: service.benefits ? JSON.parse(service.benefits) : [],
    status: service.status,
    display_order: service.display_order,
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Edit Service</h1>
        <p className="mt-1 text-sm text-muted">{service.title}</p>
      </div>
      <ServiceForm mode="edit" serviceId={service.id} initialData={initialData} />
    </div>
  );
}
