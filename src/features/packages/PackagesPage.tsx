import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Gift, Plus, Trash2, UserPlus } from "lucide-react";
import { useState, type ReactNode } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { supabase } from "../../lib/supabase";
import type { Service } from "../../types/domain";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorMessage,
  IconButton,
  Pagination,
  formatCurrency,
} from "../../shared/ui";
interface PackageRow {
  id: string;
  name: string;
  description: string | null;
  price: number | string;
  validity_days: number | null;
  active: boolean;
}
async function getPackages(): Promise<PackageRow[]> {
  const { data, error } = await supabase
    .from("packages")
    .select("id, name, description, price, validity_days, active")
    .order("name");
  if (error) throw error;
  return (data ?? []) as PackageRow[];
}
const packageSchema = z.object({
  name: z.string().trim().min(2, "Ingresa nombre"),
  description: z.string().trim(),
  price: z.coerce.number().min(0),
  validity: z.coerce.number().int().positive().or(z.literal(0)),
  serviceId: z.string().min(1, "Selecciona servicio"),
  quantity: z.coerce.number().int().positive(),
});
type PackageValues = z.infer<typeof packageSchema>;
type PackageInput = z.input<typeof packageSchema>;
export function PackagesPage() {
  const [open, setOpen] = useState(false);
  const [purchase, setPurchase] = useState<PackageRow | null>(null);
  const [page, setPage] = useState(1);
  const queryClient = useQueryClient();
  const deactivate = async (id: string) => {
    if (!window.confirm("¿Desactivar este paquete?")) return;
    const { error: updateError } = await supabase
      .from("packages")
      .update({ active: false })
      .eq("id", id);
    if (!updateError)
      void queryClient.invalidateQueries({ queryKey: ["packages"] });
  };
  const { data, isLoading, error } = useQuery({
    queryKey: ["packages"],
    queryFn: getPackages,
  });
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">FIDELIZACIÓN</span>
          <h1>Paquetes</h1>
          <p>Administra sesiones prepagadas de tus servicios.</p>
        </div>
        <Button onClick={() => setOpen(true)}>
          <Plus size={17} /> Nuevo paquete
        </Button>
      </div>
      {error && <ErrorMessage message="No pudimos cargar los paquetes." />}
      {isLoading ? (
        <div className="table-loading">Cargando paquetes…</div>
      ) : data?.length ? (
        <div className="catalog-grid">
          {data.slice((page - 1) * 8, page * 8).map((item) => (
            <Card key={item.id}>
              <div className="card-heading">
                <div className="service-dot">
                  <Gift size={17} />
                </div>
                <div className="row-actions">
                  <Badge tone={item.active ? "success" : "neutral"}>
                    {item.active ? "Activo" : "Inactivo"}
                  </Badge>
                  <IconButton
                    label="Asignar paquete a cliente"
                    onClick={() => setPurchase(item)}
                  >
                    <UserPlus size={15} />
                  </IconButton>
                  <IconButton
                    label="Desactivar paquete"
                    variant="danger"
                    onClick={() => void deactivate(item.id)}
                  >
                    <Trash2 size={15} />
                  </IconButton>
                </div>
              </div>
              <h3>{item.name}</h3>
              <p className="muted">
                {item.description || "Paquete de servicios"}
              </p>
              <div className="cash-total">
                <span>Precio</span>
                <strong>{formatCurrency(item.price)}</strong>
              </div>
            </Card>
          ))}
          <Pagination
            page={page}
            pageCount={Math.ceil(data.length / 8)}
            onPageChange={setPage}
          />
        </div>
      ) : (
        <Card>
          <EmptyState
            title="Sin paquetes"
            text="Crea paquetes para fidelizar clientes."
          />
        </Card>
      )}
      {open && <PackageForm onClose={() => setOpen(false)} />}
      {purchase && (
        <PurchasePackageForm
          packageRow={purchase}
          onClose={() => setPurchase(null)}
        />
      )}
    </>
  );
}
function PackageForm({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const [error, setError] = useState("");
  const { data: services } = useQuery({
    queryKey: ["package-services"],
    queryFn: async () => {
      const { data, error: queryError } = await supabase
        .from("services")
        .select("id, name, duration_minutes, price, active")
        .eq("active", true)
        .order("name");
      if (queryError) throw queryError;
      return (data ?? []) as Service[];
    },
  });
  const form = useForm<PackageInput, unknown, PackageValues>({
    resolver: zodResolver(packageSchema),
    defaultValues: {
      name: "",
      description: "",
      price: 0,
      validity: 0,
      serviceId: "",
      quantity: 1,
    },
  });
  const mutation = useMutation({
    mutationFn: async (values: PackageValues) => {
      const { data: packageRow, error: packageError } = await supabase
        .from("packages")
        .insert({
          name: values.name,
          description: values.description || null,
          price: values.price,
          validity_days: values.validity || null,
        })
        .select("id")
        .single();
      if (packageError) throw packageError;
      const { error: itemError } = await supabase.from("package_items").insert({
        package_id: packageRow.id,
        service_id: values.serviceId,
        quantity: values.quantity,
      });
      if (itemError) throw itemError;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["packages"] });
      onClose();
    },
    onError: () =>
      setError("No se pudo guardar el paquete. Revisa permisos y servicio."),
  });
  return (
    <div className="modal-backdrop">
      <div className="modal" role="dialog" aria-modal="true">
        <div className="modal-head">
          <div>
            <span className="eyebrow">NUEVO PAQUETE</span>
            <h2>Crear paquete</h2>
          </div>
          <button className="modal-close" onClick={onClose} aria-label="Cerrar">
            ×
          </button>
        </div>
        {error && <ErrorMessage message={error} />}
        <form
          className="booking-form"
          onSubmit={(event) =>
            void form.handleSubmit((values) => mutation.mutate(values))(event)
          }
        >
          <div className="form-grid">
            <Field label="Nombre" error={form.formState.errors.name?.message}>
              <input {...form.register("name")} placeholder="Paquete Relax" />
            </Field>
            <Field label="Precio (S/)">
              <input
                type="number"
                min="0"
                step="0.01"
                {...form.register("price")}
              />
            </Field>
            <Field
              label="Servicio"
              error={form.formState.errors.serviceId?.message}
            >
              <select {...form.register("serviceId")}>
                <option value="">Seleccionar servicio</option>
                {services?.map((service) => (
                  <option key={service.id} value={service.id}>
                    {service.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Sesiones">
              <input type="number" min="1" {...form.register("quantity")} />
            </Field>
            <Field label="Vigencia (días, opcional)">
              <input type="number" min="0" {...form.register("validity")} />
            </Field>
          </div>
          <Field label="Descripción">
            <input {...form.register("description")} placeholder="Incluye…" />
          </Field>
          <div className="modal-actions">
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" loading={mutation.isPending}>
              Guardar paquete
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {error && <small className="field-error">{error}</small>}
    </label>
  );
}

const purchaseSchema = z.object({
  customerId: z.string().min(1, "Selecciona cliente"),
});
type PurchaseValues = z.infer<typeof purchaseSchema>;
function PurchasePackageForm({
  packageRow,
  onClose,
}: {
  packageRow: PackageRow;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [error, setError] = useState("");
  const { data: customers } = useQuery({
    queryKey: ["package-customers"],
    queryFn: async () => {
      const { data, error: queryError } = await supabase
        .from("customers")
        .select("id, full_name, phone, email, active")
        .eq("active", true)
        .order("full_name");
      if (queryError) throw queryError;
      return data ?? [];
    },
  });
  const form = useForm<PurchaseValues>({
    resolver: zodResolver(purchaseSchema),
    defaultValues: { customerId: "" },
  });
  const mutation = useMutation({
    mutationFn: async (values: PurchaseValues) => {
      const { data: items, error: itemError } = await supabase
        .from("package_items")
        .select("quantity")
        .eq("package_id", packageRow.id);
      if (itemError) throw itemError;
      const totalSessions = (items ?? []).reduce(
        (sum, item) => sum + Number(item.quantity),
        0,
      );
      if (!totalSessions) throw new Error("Paquete sin servicios");
      const expiresAt = packageRow.validity_days
        ? new Date(
            Date.now() + packageRow.validity_days * 86400000,
          ).toISOString()
        : null;
      const { error: insertError } = await supabase
        .from("customer_packages")
        .insert({
          customer_id: values.customerId,
          package_id: packageRow.id,
          total_sessions: totalSessions,
          expires_at: expiresAt,
        });
      if (insertError) throw insertError;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["packages"] });
      onClose();
    },
    onError: () => setError("No se pudo asignar el paquete."),
  });
  return (
    <div className="modal-backdrop">
      <div className="modal" role="dialog" aria-modal="true">
        <div className="modal-head">
          <div>
            <span className="eyebrow">PAQUETE</span>
            <h2>Asignar a cliente</h2>
            <p className="muted">{packageRow.name}</p>
          </div>
          <button className="modal-close" onClick={onClose} aria-label="Cerrar">
            ×
          </button>
        </div>
        {error && <ErrorMessage message={error} />}
        <form
          className="booking-form"
          onSubmit={(event) =>
            void form.handleSubmit((values) => mutation.mutate(values))(event)
          }
        >
          <label className="field">
            <span>Cliente</span>
            <select {...form.register("customerId")}>
              <option value="">Seleccionar cliente</option>
              {customers?.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.full_name}
                </option>
              ))}
            </select>
            {form.formState.errors.customerId && (
              <small className="field-error">
                {form.formState.errors.customerId.message}
              </small>
            )}
          </label>
          <div className="modal-actions">
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" loading={mutation.isPending}>
              Asignar paquete
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
