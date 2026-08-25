import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Percent, Plus, Trash2 } from "lucide-react";
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
  formatCurrency,
  IconButton,
  Pagination,
} from "../../shared/ui";
interface Promotion {
  id: string;
  name: string;
  description: string | null;
  discount_type: "percentage" | "fixed";
  discount_value: number | string;
  starts_at: string | null;
  ends_at: string | null;
  active: boolean;
}
async function getPromotions(): Promise<Promotion[]> {
  const { data, error } = await supabase
    .from("promotions")
    .select(
      "id, name, description, discount_type, discount_value, starts_at, ends_at, active",
    )
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Promotion[];
}
const promotionSchema = z.object({
  name: z.string().trim().min(2, "Ingresa un nombre"),
  description: z.string().trim(),
  type: z.enum(["percentage", "fixed"]),
  value: z.coerce.number().positive("Debe ser mayor que 0"),
  maxUses: z.coerce.number().int().positive().or(z.literal(0)),
  serviceIds: z.array(z.string()),
});
type PromotionValues = z.infer<typeof promotionSchema>;
type PromotionInput = z.input<typeof promotionSchema>;
export function PromotionsPage() {
  const [open, setOpen] = useState(false);
  const [page, setPage] = useState(1);
  const queryClient = useQueryClient();
  const deactivate = async (id: string) => {
    if (!window.confirm("¿Desactivar esta promoción?")) return;
    const { error: updateError } = await supabase
      .from("promotions")
      .update({ active: false })
      .eq("id", id);
    if (!updateError)
      void queryClient.invalidateQueries({ queryKey: ["promotions"] });
  };
  const { data, isLoading, error } = useQuery({
    queryKey: ["promotions"],
    queryFn: getPromotions,
  });
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">CAMPAÑAS</span>
          <h1>Promociones</h1>
          <p>Descuentos activos para tus servicios.</p>
        </div>
        <Button onClick={() => setOpen(true)}>
          <Plus size={17} /> Nueva promoción
        </Button>
      </div>
      {error && <ErrorMessage message="No pudimos cargar las promociones." />}
      {isLoading ? (
        <div className="table-loading">Cargando promociones…</div>
      ) : data?.length ? (
        <div className="catalog-grid">
          {data.slice((page - 1) * 8, page * 8).map((promotion) => (
            <Card key={promotion.id}>
              <div className="card-heading">
                <div className="service-dot">
                  <Percent size={17} />
                </div>
                <div className="row-actions">
                  <Badge tone={promotion.active ? "success" : "neutral"}>
                    {promotion.active ? "Activa" : "Inactiva"}
                  </Badge>
                  <IconButton
                    label="Desactivar promoción"
                    variant="danger"
                    onClick={() => void deactivate(promotion.id)}
                  >
                    <Trash2 size={15} />
                  </IconButton>
                </div>
              </div>
              <h3>{promotion.name}</h3>
              <p className="muted">
                {promotion.description || "Promoción del centro"}
              </p>
              <div className="cash-total">
                <span>Descuento</span>
                <strong>
                  {promotion.discount_type === "percentage"
                    ? `${promotion.discount_value}%`
                    : formatCurrency(promotion.discount_value)}
                </strong>
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
            title="Sin promociones"
            text="Crea la primera campaña del centro."
          />
        </Card>
      )}
      {open && <PromotionForm onClose={() => setOpen(false)} />}
    </>
  );
}
function PromotionForm({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const [error, setError] = useState("");
  const { data: services } = useQuery({
    queryKey: ["promotion-services"],
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
  const form = useForm<PromotionInput, unknown, PromotionValues>({
    resolver: zodResolver(promotionSchema),
    defaultValues: {
      name: "",
      description: "",
      type: "percentage",
      value: 10,
      maxUses: 0,
      serviceIds: [],
    },
  });
  const mutation = useMutation({
    mutationFn: async (values: PromotionValues) => {
      if (values.type === "percentage" && values.value > 100)
        throw new Error("Porcentaje inválido");
      const { data: promotion, error: insertError } = await supabase
        .from("promotions")
        .insert({
          name: values.name,
          description: values.description || null,
          discount_type: values.type,
          discount_value: values.value,
          max_uses: values.maxUses || null,
        })
        .select("id")
        .single();
      if (insertError) throw insertError;
      if (values.serviceIds.length > 0) {
        const { error: relationError } = await supabase
          .from("promotion_services")
          .insert(
            values.serviceIds.map((serviceId) => ({
              promotion_id: promotion.id,
              service_id: serviceId,
            })),
          );
        if (relationError) throw relationError;
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["promotions"] });
      onClose();
    },
    onError: (cause: Error) =>
      setError(
        cause.message.includes("Porcentaje")
          ? cause.message
          : "No se pudo guardar la promoción.",
      ),
  });
  return (
    <div className="modal-backdrop">
      <div className="modal" role="dialog" aria-modal="true">
        <div className="modal-head">
          <div>
            <span className="eyebrow">NUEVA PROMOCIÓN</span>
            <h2>Crear promoción</h2>
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
            <Field label="Nombre">
              <input
                {...form.register("name")}
                placeholder="Promoción de bienvenida"
              />
            </Field>
            <Field label="Tipo">
              <select {...form.register("type")}>
                <option value="percentage">Porcentaje</option>
                <option value="fixed">Monto fijo</option>
              </select>
            </Field>
            <Field label="Valor">
              <input
                type="number"
                min="0"
                step="0.01"
                {...form.register("value")}
              />
            </Field>
            <Field label="Usos máximos (0 = sin límite)">
              <input type="number" min="0" {...form.register("maxUses")} />
            </Field>
          </div>
          <div className="form-section">
            <strong>Servicios aplicables</strong>
            <p className="muted">Si no seleccionas ninguno, aplica a todos.</p>
            <div className="check-list">
              {services?.map((service) => (
                <label className="checkbox-label" key={service.id}>
                  <input
                    type="checkbox"
                    value={service.id}
                    {...form.register("serviceIds")}
                  />
                  {service.name}
                </label>
              ))}
            </div>
          </div>
          <Field label="Descripción">
            <input
              {...form.register("description")}
              placeholder="Condiciones de la promoción"
            />
          </Field>
          <div className="modal-actions">
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" loading={mutation.isPending}>
              Guardar promoción
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}
