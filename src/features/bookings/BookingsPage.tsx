import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CalendarDays,
  Ban,
  MapPin,
  Search,
  SlidersHorizontal,
} from "lucide-react";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import type { FormEvent } from "react";
import { supabase } from "../../lib/supabase";
import type { Booking, Customer, Service, Therapist } from "../../types/domain";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorMessage,
  formatDate,
  Pagination,
  IconButton,
} from "../../shared/ui";
async function getBookings(page: number, pageSize: number, search: string) {
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  let query = supabase
    .from("bookings")
    .select(
      "id, customer_id, therapist_id, service_id, guest_name, guest_phone, starts_at, ends_at, status, location_type, address, address_reference, customer:customers(full_name), therapist:therapists(full_name), service:services(name, duration_minutes, price)",
      { count: "exact" },
    )
    .order("starts_at", { ascending: false })
    .range(from, to);
  if (search)
    query = query.or(
      `guest_name.ilike.%${search}%,guest_phone.ilike.%${search}%`,
    );
  const { data, count, error } = await query;
  if (error) throw error;
  return { rows: (data ?? []) as unknown as Booking[], total: count ?? 0 };
}
const statusTone = {
  pending: "warning",
  confirmed: "info",
  in_progress: "success",
  completed: "success",
  cancelled: "danger",
  no_show: "danger",
} as const;
const statusLabel = {
  pending: "Pendiente",
  confirmed: "Confirmada",
  in_progress: "En curso",
  completed: "Completada",
  cancelled: "Cancelada",
  no_show: "No asistió",
};
const bookingSchema = z
  .object({
    customerMode: z.enum(["guest", "registered"]),
    customerId: z.string(),
    guestName: z.string(),
    guestPhone: z.string(),
    guestEmail: z.string(),
    serviceId: z.string().min(1, "Selecciona un servicio"),
    therapistId: z.string().min(1, "Selecciona una masajista"),
    date: z.string().min(1, "Selecciona una fecha"),
    time: z.string().min(1, "Selecciona una hora"),
    locationType: z.enum(["on_site", "customer_home"]),
    address: z.string(),
    reference: z.string(),
  })
  .superRefine((value, ctx) => {
    if (value.customerMode === "guest" && value.guestName.trim().length < 2)
      ctx.addIssue({
        code: "custom",
        path: ["guestName"],
        message: "Ingresa nombre del visitante",
      });
    if (value.customerMode === "guest" && value.guestPhone.trim().length < 6)
      ctx.addIssue({
        code: "custom",
        path: ["guestPhone"],
        message: "Ingresa un teléfono válido",
      });
    if (value.customerMode === "registered" && !value.customerId)
      ctx.addIssue({
        code: "custom",
        path: ["customerId"],
        message: "Selecciona un cliente",
      });
    if (
      value.locationType === "customer_home" &&
      value.address.trim().length < 5
    )
      ctx.addIssue({
        code: "custom",
        path: ["address"],
        message: "Ingresa la dirección del domicilio",
      });
  });
type BookingFormValues = z.infer<typeof bookingSchema>;

async function getFormOptions() {
  const [services, therapists, customers] = await Promise.all([
    supabase
      .from("services")
      .select("id, name, duration_minutes, price, active")
      .eq("active", true)
      .order("name"),
    supabase
      .from("therapists")
      .select("id, full_name, phone, active")
      .eq("active", true)
      .order("full_name"),
    supabase
      .from("customers")
      .select("id, full_name, phone, email, active")
      .eq("active", true)
      .order("full_name"),
  ]);
  if (services.error) throw services.error;
  if (therapists.error) throw therapists.error;
  if (customers.error) throw customers.error;
  return {
    services: (services.data ?? []) as Service[],
    therapists: (therapists.data ?? []) as Therapist[],
    customers: (customers.data ?? []) as Customer[],
  };
}

export function BookingsPage() {
  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [page, setPage] = useState(1);
  const queryClient = useQueryClient();
  useEffect(() => {
    const channel = supabase
      .channel("bookings-live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "bookings" },
        () => {
          void queryClient.invalidateQueries({ queryKey: ["bookings"] });
          void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [queryClient]);
  const cancelBooking = async (id: string) => {
    if (!window.confirm("¿Cancelar esta reserva?")) return;
    const { error: updateError } = await supabase
      .from("bookings")
      .update({ status: "cancelled" })
      .eq("id", id);
    if (!updateError) {
      void queryClient.invalidateQueries({ queryKey: ["bookings"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    }
  };
  const pageSize = 10;
  const { data, isLoading, error } = useQuery({
    queryKey: ["bookings", page, search],
    queryFn: () => getBookings(page, pageSize, search.trim()),
  });
  const bookings = data?.rows ?? [];
  const pageCount = Math.ceil((data?.total ?? 0) / pageSize);
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">OPERACIÓN</span>
          <h1>Reservas</h1>
          <p>Consulta y organiza la agenda del centro.</p>
        </div>
        <Button onClick={() => setFormOpen(true)}>
          <CalendarDays size={17} /> Nueva reserva
        </Button>
      </div>
      <Card className="filter-card">
        <div className="search-field">
          <Search size={17} />
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Buscar cliente o servicio…"
            aria-label="Buscar reservas"
          />
        </div>
        <Button variant="secondary">
          <SlidersHorizontal size={16} /> Filtros
        </Button>
      </Card>
      {error && <ErrorMessage message="No pudimos cargar las reservas." />}
      {isLoading ? (
        <div className="table-loading">Cargando agenda…</div>
      ) : bookings.length === 0 ? (
        <Card>
          <EmptyState
            title="No hay reservas"
            text="Cuando registres una reserva aparecerá aquí."
          />
        </Card>
      ) : (
        <Card className="table-card">
          <div className="responsive-table">
            <table>
              <thead>
                <tr>
                  <th>Fecha y hora</th>
                  <th>Cliente</th>
                  <th>Servicio</th>
                  <th>Masajista</th>
                  <th>Ubicación</th>
                  <th>Estado</th>
                  <th aria-label="Acciones" />
                </tr>
              </thead>
              <tbody>
                {bookings.map((booking) => (
                  <tr key={booking.id}>
                    <td>
                      <strong>{formatDate(booking.starts_at)}</strong>
                    </td>
                    <td>
                      <IconButton
                        label="Cancelar reserva"
                        variant="danger"
                        disabled={
                          booking.status === "cancelled" ||
                          booking.status === "completed"
                        }
                        onClick={() => void cancelBooking(booking.id)}
                      >
                        <Ban size={15} />
                      </IconButton>
                    </td>
                    <td>
                      <strong>
                        {booking.customer?.full_name ||
                          booking.guest_name ||
                          "Sin nombre"}
                      </strong>
                      <small>
                        {booking.guest_phone || "Cliente registrado"}
                      </small>
                    </td>
                    <td>{booking.service?.name || "—"}</td>
                    <td>{booking.therapist?.full_name || "—"}</td>
                    <td>
                      {booking.location_type === "customer_home" ? (
                        <span className="inline-icon">
                          <MapPin size={14} /> Domicilio
                        </span>
                      ) : (
                        "Local"
                      )}
                    </td>
                    <td>
                      <Badge tone={statusTone[booking.status]}>
                        {statusLabel[booking.status]}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination
            page={page}
            pageCount={pageCount}
            onPageChange={setPage}
          />
        </Card>
      )}
      {formOpen && <BookingForm onClose={() => setFormOpen(false)} />}
    </>
  );
}

function BookingForm({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const { data: options, isLoading } = useQuery({
    queryKey: ["booking-options"],
    queryFn: getFormOptions,
  });
  const [serverError, setServerError] = useState("");
  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors },
  } = useForm<BookingFormValues>({
    resolver: zodResolver(bookingSchema),
    defaultValues: {
      customerMode: "guest",
      customerId: "",
      guestName: "",
      guestPhone: "",
      guestEmail: "",
      serviceId: "",
      therapistId: "",
      date: "",
      time: "",
      locationType: "on_site",
      address: "",
      reference: "",
    },
  });
  const mode = watch("customerMode");
  const location = watch("locationType");
  const mutation = useMutation({
    mutationFn: async (values: BookingFormValues) => {
      const service = options?.services.find(
        (item) => item.id === values.serviceId,
      );
      if (!service) throw new Error("Servicio no encontrado");
      const startsAt = new Date(`${values.date}T${values.time}:00-05:00`);
      const endsAt = new Date(
        startsAt.getTime() + service.duration_minutes * 60_000,
      );
      const payload = {
        customer_id:
          values.customerMode === "registered" ? values.customerId : null,
        therapist_id: values.therapistId,
        service_id: values.serviceId,
        guest_name:
          values.customerMode === "guest" ? values.guestName.trim() : null,
        guest_phone:
          values.customerMode === "guest" ? values.guestPhone.trim() : null,
        guest_email:
          values.customerMode === "guest" && values.guestEmail
            ? values.guestEmail.trim()
            : null,
        starts_at: startsAt.toISOString(),
        ends_at: endsAt.toISOString(),
        location_type: values.locationType,
        address:
          values.locationType === "customer_home"
            ? values.address.trim()
            : null,
        address_reference:
          values.locationType === "customer_home" && values.reference
            ? values.reference.trim()
            : null,
        status: "pending",
      };
      const { error } = await supabase.from("bookings").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["bookings"] });
      reset();
      onClose();
    },
    onError: (error: Error) =>
      setServerError(
        error.message.includes("horario") || error.message.includes("masajista")
          ? error.message
          : "No se pudo guardar la reserva. Verifica horario y datos.",
      ),
  });
  if (isLoading)
    return (
      <div className="modal-backdrop">
        <div className="modal">
          <div className="table-loading">Cargando opciones…</div>
        </div>
      </div>
    );
  return (
    <div className="modal-backdrop" role="presentation">
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="booking-title"
      >
        <div className="modal-head">
          <div>
            <span className="eyebrow">NUEVA RESERVA</span>
            <h2 id="booking-title">Agendar atención</h2>
          </div>
          <button className="modal-close" onClick={onClose} aria-label="Cerrar">
            ×
          </button>
        </div>
        {serverError && <ErrorMessage message={serverError} />}
        <form
          className="booking-form"
          onSubmit={(event: FormEvent<HTMLFormElement>) =>
            void handleSubmit((values) => mutation.mutate(values))(event)
          }
        >
          <div className="form-section">
            <strong>Datos del cliente</strong>
            <div className="segmented">
              <label>
                <input
                  type="radio"
                  value="guest"
                  {...register("customerMode")}
                />{" "}
                Invitado
              </label>
              <label>
                <input
                  type="radio"
                  value="registered"
                  {...register("customerMode")}
                />{" "}
                Registrado
              </label>
            </div>
            {mode === "guest" ? (
              <div className="form-grid">
                <Field label="Nombre" error={errors.guestName?.message}>
                  <input
                    {...register("guestName")}
                    placeholder="Nombre del visitante"
                  />
                </Field>
                <Field label="Teléfono" error={errors.guestPhone?.message}>
                  <input
                    {...register("guestPhone")}
                    placeholder="999 999 999"
                  />
                </Field>
                <Field
                  label="Correo (opcional)"
                  error={errors.guestEmail?.message}
                >
                  <input
                    type="email"
                    {...register("guestEmail")}
                    placeholder="cliente@correo.com"
                  />
                </Field>
              </div>
            ) : (
              <Field
                label="Cliente registrado"
                error={errors.customerId?.message}
              >
                <select {...register("customerId")}>
                  <option value="">Seleccionar cliente</option>
                  {options?.customers.map((customer) => (
                    <option key={customer.id} value={customer.id}>
                      {customer.full_name}
                    </option>
                  ))}
                </select>
              </Field>
            )}
          </div>
          <div className="form-section">
            <strong>Servicio y horario</strong>
            <div className="form-grid">
              <Field label="Servicio" error={errors.serviceId?.message}>
                <select {...register("serviceId")}>
                  <option value="">Seleccionar servicio</option>
                  {options?.services.map((service) => (
                    <option key={service.id} value={service.id}>
                      {service.name} · {service.duration_minutes} min
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Masajista" error={errors.therapistId?.message}>
                <select {...register("therapistId")}>
                  <option value="">Seleccionar masajista</option>
                  {options?.therapists.map((therapist) => (
                    <option key={therapist.id} value={therapist.id}>
                      {therapist.full_name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Fecha" error={errors.date?.message}>
                <input type="date" {...register("date")} />
              </Field>
              <Field label="Hora" error={errors.time?.message}>
                <input type="time" step="1800" {...register("time")} />
              </Field>
            </div>
          </div>
          <div className="form-section">
            <strong>Ubicación</strong>
            <div className="segmented">
              <label>
                <input
                  type="radio"
                  value="on_site"
                  {...register("locationType")}
                />{" "}
                En el local
              </label>
              <label>
                <input
                  type="radio"
                  value="customer_home"
                  {...register("locationType")}
                />{" "}
                A domicilio
              </label>
            </div>
            {location === "customer_home" && (
              <div className="form-grid">
                <Field label="Dirección" error={errors.address?.message}>
                  <input
                    {...register("address")}
                    placeholder="Av. / calle y número"
                  />
                </Field>
                <Field label="Referencia (opcional)">
                  <input
                    {...register("reference")}
                    placeholder="Piso, puerta, color…"
                  />
                </Field>
              </div>
            )}
          </div>
          <div className="modal-actions">
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" loading={mutation.isPending}>
              Guardar reserva
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
