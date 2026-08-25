import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Sparkles, Trash2, UsersRound } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { useState } from "react";
import type { ReactNode } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import type { Service, Therapist } from "../../types/domain";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorMessage,
  formatCurrency,
  IconButton,
} from "../../shared/ui";
async function getCatalog() {
  const [services, therapists] = await Promise.all([
    supabase
      .from("services")
      .select("id, name, duration_minutes, price, active")
      .order("name"),
    supabase
      .from("therapists")
      .select("id, full_name, phone, active")
      .order("full_name"),
  ]);
  if (services.error) throw services.error;
  if (therapists.error) throw therapists.error;
  return {
    services: (services.data ?? []) as Service[],
    therapists: (therapists.data ?? []) as Therapist[],
  };
}
export function CatalogPage() {
  const [form, setForm] = useState<"service" | "therapist" | null>(null);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [editingTherapist, setEditingTherapist] = useState<Therapist | null>(
    null,
  );
  const queryClient = useQueryClient();
  const deactivate = async (table: "services" | "therapists", id: string) => {
    if (!window.confirm("¿Desactivar este registro?")) return;
    const { error: updateError } = await supabase
      .from(table)
      .update({ active: false })
      .eq("id", id);
    if (!updateError)
      void queryClient.invalidateQueries({ queryKey: ["catalog"] });
  };
  const { data, isLoading, error } = useQuery({
    queryKey: ["catalog"],
    queryFn: getCatalog,
  });
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">CONFIGURACIÓN</span>
          <h1>Servicios y equipo</h1>
          <p>Catálogo que alimenta tu agenda diaria.</p>
        </div>
        <div className="heading-actions">
          <Button onClick={() => setForm("service")}>
            <Plus size={17} /> Nuevo servicio
          </Button>
          <Button variant="secondary" onClick={() => setForm("therapist")}>
            <UsersRound size={17} /> Nueva masajista
          </Button>
        </div>
      </div>
      {error && <ErrorMessage message="No pudimos cargar el catálogo." />}
      {isLoading ? (
        <div className="loading-grid">
          <div />
          <div />
        </div>
      ) : (
        <div className="catalog-grid">
          <Card>
            <div className="card-heading">
              <div>
                <span className="eyebrow">CATÁLOGO</span>
                <h3>Servicios</h3>
              </div>
              <Sparkles size={20} className="muted-icon" />
            </div>
            {data?.services.length ? (
              <div className="catalog-list">
                {data.services.map((service) => (
                  <div className="catalog-row" key={service.id}>
                    <div className="service-dot">
                      <Sparkles size={16} />
                    </div>
                    <div>
                      <strong>{service.name}</strong>
                      <span>{service.duration_minutes} minutos</span>
                    </div>
                    <div className="catalog-price">
                      {formatCurrency(service.price)}
                    </div>
                    <Badge tone={service.active ? "success" : "neutral"}>
                      {service.active ? "Activo" : "Inactivo"}
                    </Badge>
                    <div className="row-actions">
                      <IconButton
                        label="Editar servicio"
                        onClick={() => setEditingService(service)}
                      >
                        <Pencil size={15} />
                      </IconButton>
                      <IconButton
                        label="Desactivar servicio"
                        variant="danger"
                        onClick={() => void deactivate("services", service.id)}
                      >
                        <Trash2 size={15} />
                      </IconButton>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                title="Sin servicios"
                text="Agrega el primer servicio del centro."
              />
            )}
          </Card>
          <Card>
            <div className="card-heading">
              <div>
                <span className="eyebrow">EQUIPO</span>
                <h3>Masajistas</h3>
              </div>
              <UsersRound size={20} className="muted-icon" />
            </div>
            {data?.therapists.length ? (
              <div className="catalog-list">
                {data.therapists.map((therapist) => (
                  <div className="catalog-row" key={therapist.id}>
                    <div className="avatar avatar-purple">
                      {therapist.full_name.slice(0, 1)}
                    </div>
                    <div>
                      <strong>{therapist.full_name}</strong>
                      <span>{therapist.phone || "Sin teléfono"}</span>
                    </div>
                    <Badge tone={therapist.active ? "success" : "neutral"}>
                      {therapist.active ? "Disponible" : "Inactiva"}
                    </Badge>
                    <div className="row-actions">
                      <IconButton
                        label="Editar masajista"
                        onClick={() => setEditingTherapist(therapist)}
                      >
                        <Pencil size={15} />
                      </IconButton>
                      <IconButton
                        label="Desactivar masajista"
                        variant="danger"
                        onClick={() =>
                          void deactivate("therapists", therapist.id)
                        }
                      >
                        <Trash2 size={15} />
                      </IconButton>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                title="Sin masajistas"
                text="Agrega el equipo para organizar horarios."
              />
            )}
          </Card>
        </div>
      )}
      {form === "service" && <ServiceForm onClose={() => setForm(null)} />}
      {form === "therapist" && <TherapistForm onClose={() => setForm(null)} />}
      {editingService && (
        <ServiceForm
          service={editingService}
          onClose={() => setEditingService(null)}
        />
      )}
      {editingTherapist && (
        <TherapistForm
          therapist={editingTherapist}
          onClose={() => setEditingTherapist(null)}
        />
      )}
    </>
  );
}

const serviceSchema = z.object({
  name: z.string().trim().min(2, "Ingresa un nombre"),
  duration: z.coerce
    .number()
    .int()
    .min(30)
    .multipleOf(30, "Usa múltiplos de 30 minutos"),
  price: z.coerce.number().min(0, "Precio inválido"),
});
type ServiceFormValues = z.infer<typeof serviceSchema>;
type ServiceFormInput = z.input<typeof serviceSchema>;
function ServiceForm({
  service,
  onClose,
}: {
  service?: Service;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [error, setError] = useState("");
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ServiceFormInput, unknown, ServiceFormValues>({
    resolver: zodResolver(serviceSchema),
    defaultValues: {
      name: service?.name ?? "",
      duration: service?.duration_minutes ?? 60,
      price: Number(service?.price ?? 0),
    },
  });
  const mutation = useMutation({
    mutationFn: async (values: ServiceFormValues) => {
      const query = service
        ? supabase
            .from("services")
            .update({
              name: values.name,
              duration_minutes: values.duration,
              price: values.price,
            })
            .eq("id", service.id)
        : supabase
            .from("services")
            .insert({
              name: values.name,
              duration_minutes: values.duration,
              price: values.price,
            });
      const { error: insertError } = await query;
      if (insertError) throw insertError;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["catalog"] });
      onClose();
    },
    onError: () =>
      setError("No se pudo guardar el servicio. Revisa permisos y datos."),
  });
  return (
    <CatalogModal
      title={service ? "Editar servicio" : "Nuevo servicio"}
      eyebrow="CATÁLOGO"
      error={error}
      onClose={onClose}
    >
      <form
        className="booking-form"
        onSubmit={(event) =>
          void handleSubmit((values) => mutation.mutate(values))(event)
        }
      >
        <div className="form-grid">
          <Field label="Nombre" error={errors.name?.message}>
            <input {...register("name")} placeholder="Masaje relajante" />
          </Field>
          <Field label="Duración (minutos)" error={errors.duration?.message}>
            <input
              type="number"
              step="30"
              min="30"
              {...register("duration", { valueAsNumber: true })}
            />
          </Field>
          <Field label="Precio (S/)" error={errors.price?.message}>
            <input
              type="number"
              step="0.01"
              min="0"
              {...register("price", { valueAsNumber: true })}
            />
          </Field>
        </div>
        <ModalActions onClose={onClose} loading={mutation.isPending}>
          {service ? "Actualizar servicio" : "Guardar servicio"}
        </ModalActions>
      </form>
    </CatalogModal>
  );
}
const therapistSchema = z.object({
  name: z.string().trim().min(2, "Ingresa un nombre"),
  phone: z.string().trim().min(6, "Teléfono inválido").or(z.literal("")),
  description: z.string().trim(),
});
type TherapistFormValues = z.infer<typeof therapistSchema>;
function TherapistForm({
  therapist,
  onClose,
}: {
  therapist?: Therapist;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [error, setError] = useState("");
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<TherapistFormValues>({
    resolver: zodResolver(therapistSchema),
    defaultValues: {
      name: therapist?.full_name ?? "",
      phone: therapist?.phone ?? "",
      description: "",
    },
  });
  const mutation = useMutation({
    mutationFn: async (values: TherapistFormValues) => {
      const query = therapist
        ? supabase
            .from("therapists")
            .update({
              full_name: values.name,
              phone: values.phone || null,
              description: values.description || null,
            })
            .eq("id", therapist.id)
        : supabase
            .from("therapists")
            .insert({
              full_name: values.name,
              phone: values.phone || null,
              description: values.description || null,
            });
      const { error: insertError } = await query;
      if (insertError) throw insertError;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["catalog"] });
      onClose();
    },
    onError: () =>
      setError("No se pudo guardar la masajista. Revisa permisos y datos."),
  });
  return (
    <CatalogModal
      title={therapist ? "Editar masajista" : "Nueva masajista"}
      eyebrow="EQUIPO"
      error={error}
      onClose={onClose}
    >
      <form
        className="booking-form"
        onSubmit={(event) =>
          void handleSubmit((values) => mutation.mutate(values))(event)
        }
      >
        <div className="form-grid">
          <Field label="Nombre completo" error={errors.name?.message}>
            <input {...register("name")} placeholder="Nombre de la masajista" />
          </Field>
          <Field label="Teléfono" error={errors.phone?.message}>
            <input {...register("phone")} placeholder="999 999 999" />
          </Field>
          <Field label="Descripción">
            <input
              {...register("description")}
              placeholder="Especialidad (opcional)"
            />
          </Field>
        </div>
        <ModalActions onClose={onClose} loading={mutation.isPending}>
          {therapist ? "Actualizar masajista" : "Guardar masajista"}
        </ModalActions>
      </form>
    </CatalogModal>
  );
}
function CatalogModal({
  title,
  eyebrow,
  error,
  onClose,
  children,
}: {
  title: string;
  eyebrow: string;
  error: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div className="modal-backdrop">
      <div className="modal" role="dialog" aria-modal="true">
        <div className="modal-head">
          <div>
            <span className="eyebrow">{eyebrow}</span>
            <h2>{title}</h2>
          </div>
          <button className="modal-close" onClick={onClose} aria-label="Cerrar">
            ×
          </button>
        </div>
        {error && <ErrorMessage message={error} />}
        {children}
      </div>
    </div>
  );
}
function ModalActions({
  onClose,
  loading,
  children,
}: {
  onClose: () => void;
  loading: boolean;
  children: ReactNode;
}) {
  return (
    <div className="modal-actions">
      <Button type="button" variant="secondary" onClick={onClose}>
        Cancelar
      </Button>
      <Button type="submit" loading={loading}>
        {children}
      </Button>
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
