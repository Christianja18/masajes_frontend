import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Ban, Clock3, Plus } from "lucide-react";
import { useState, type ReactNode } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { supabase } from "../../lib/supabase";
import type { Therapist } from "../../types/domain";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorMessage,
  Pagination,
} from "../../shared/ui";
interface Schedule {
  id: string;
  therapist_id: string;
  weekday: number;
  start_time: string;
  end_time: string;
  active: boolean;
  therapist: { full_name: string } | null;
}
interface ScheduleBlock {
  id: string;
  therapist_id: string;
  starts_at: string;
  ends_at: string;
  reason: string | null;
  therapist: { full_name: string } | null;
}
const days = [
  "Domingo",
  "Lunes",
  "Martes",
  "Miércoles",
  "Jueves",
  "Viernes",
  "Sábado",
];
async function getSchedules(page: number, pageSize: number) {
  const { data, count, error } = await supabase
    .from("therapist_schedules")
    .select(
      "id, therapist_id, weekday, start_time, end_time, active, therapist:therapists(full_name)",
      { count: "exact" },
    )
    .order("weekday")
    .order("start_time")
    .range((page - 1) * pageSize, page * pageSize - 1);
  if (error) throw error;
  return { rows: (data ?? []) as unknown as Schedule[], total: count ?? 0 };
}
async function getTherapists(): Promise<Therapist[]> {
  const { data, error } = await supabase
    .from("therapists")
    .select("id, full_name, phone, active")
    .eq("active", true)
    .order("full_name");
  if (error) throw error;
  return (data ?? []) as Therapist[];
}
async function getBlocks(page: number, pageSize: number) {
  const { data, count, error } = await supabase
    .from("therapist_schedule_blocks")
    .select(
      "id, therapist_id, starts_at, ends_at, reason, therapist:therapists(full_name)",
      { count: "exact" },
    )
    .order("starts_at", { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1);
  if (error) throw error;
  return {
    rows: (data ?? []) as unknown as ScheduleBlock[],
    total: count ?? 0,
  };
}
const scheduleSchema = z
  .object({
    therapistId: z.string().min(1, "Selecciona masajista"),
    weekday: z.coerce.number().int().min(0).max(6),
    start: z.string(),
    end: z.string(),
  })
  .refine((value) => value.start < value.end, {
    path: ["end"],
    message: "La hora final debe ser posterior",
  });
type ScheduleValues = z.infer<typeof scheduleSchema>;
type ScheduleInput = z.input<typeof scheduleSchema>;
export function SchedulesPage() {
  const [open, setOpen] = useState(false);
  const [blockOpen, setBlockOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [blockPage, setBlockPage] = useState(1);
  const pageSize = 6;
  const { data, isLoading, error } = useQuery({
    queryKey: ["schedules", page],
    queryFn: () => getSchedules(page, pageSize),
  });
  const blocksQuery = useQuery({
    queryKey: ["schedule-blocks", blockPage],
    queryFn: () => getBlocks(blockPage, pageSize),
  });
  const schedules = data?.rows ?? [];
  const blocks = blocksQuery.data?.rows ?? [];
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">AGENDA</span>
          <h1>Horarios</h1>
          <p>Define jornadas semanales por masajista.</p>
        </div>
        <div className="heading-actions">
          <Button onClick={() => setOpen(true)}>
            <Plus size={17} /> Nuevo horario
          </Button>
          <Button variant="secondary" onClick={() => setBlockOpen(true)}>
            <Ban size={17} /> Bloquear horario
          </Button>
        </div>
      </div>
      {error && <ErrorMessage message="No pudimos cargar los horarios." />}
      {isLoading ? (
        <div className="table-loading">Cargando horarios…</div>
      ) : schedules.length ? (
        <Card className="table-card">
          <div className="responsive-table">
            <table>
              <thead>
                <tr>
                  <th>Día</th>
                  <th>Masajista</th>
                  <th>Horario</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {schedules.map((schedule) => (
                  <tr key={schedule.id}>
                    <td>
                      <strong>{days[schedule.weekday]}</strong>
                    </td>
                    <td>{schedule.therapist?.full_name || "—"}</td>
                    <td>
                      <span className="inline-icon">
                        <Clock3 size={14} /> {schedule.start_time.slice(0, 5)} -{" "}
                        {schedule.end_time.slice(0, 5)}
                      </span>
                    </td>
                    <td>
                      <Badge tone={schedule.active ? "success" : "neutral"}>
                        {schedule.active ? "Activo" : "Inactivo"}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination
            page={page}
            pageCount={Math.ceil((data?.total ?? 0) / pageSize)}
            onPageChange={setPage}
          />
        </Card>
      ) : (
        <Card>
          <EmptyState
            title="Sin horarios"
            text="Define horarios para permitir reservas."
          />
        </Card>
      )}
      {open && <ScheduleForm onClose={() => setOpen(false)} />}
      {blockOpen && <BlockForm onClose={() => setBlockOpen(false)} />}
      {blocksQuery.data && (
        <Card className="table-card schedule-blocks">
          <div className="card-heading">
            <div>
              <span className="eyebrow">EXCEPCIONES</span>
              <h3>Bloqueos próximos</h3>
            </div>
          </div>
          {blocks.length ? (
            <div className="responsive-table">
              <table>
                <thead>
                  <tr>
                    <th>Masajista</th>
                    <th>Desde</th>
                    <th>Hasta</th>
                    <th>Motivo</th>
                  </tr>
                </thead>
                <tbody>
                  {blocks.map((block) => (
                    <tr key={block.id}>
                      <td>{block.therapist?.full_name || "—"}</td>
                      <td>
                        {new Intl.DateTimeFormat("es-PE", {
                          dateStyle: "short",
                          timeStyle: "short",
                          timeZone: "America/Lima",
                        }).format(new Date(block.starts_at))}
                      </td>
                      <td>
                        {new Intl.DateTimeFormat("es-PE", {
                          dateStyle: "short",
                          timeStyle: "short",
                          timeZone: "America/Lima",
                        }).format(new Date(block.ends_at))}
                      </td>
                      <td>{block.reason || "Bloqueo manual"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState
              title="Sin bloqueos"
              text="Vacaciones, permisos y ausencias aparecerán aquí."
            />
          )}
          <Pagination
            page={blockPage}
            pageCount={Math.ceil((blocksQuery.data?.total ?? 0) / pageSize)}
            onPageChange={setBlockPage}
          />
        </Card>
      )}
    </>
  );
}
function ScheduleForm({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const [error, setError] = useState("");
  const { data: therapists } = useQuery({
    queryKey: ["schedule-therapists"],
    queryFn: getTherapists,
  });
  const form = useForm<ScheduleInput, unknown, ScheduleValues>({
    resolver: zodResolver(scheduleSchema),
    defaultValues: {
      therapistId: "",
      weekday: 1,
      start: "09:00",
      end: "18:00",
    },
  });
  const mutation = useMutation({
    mutationFn: async (values: ScheduleValues) => {
      const { error: insertError } = await supabase
        .from("therapist_schedules")
        .insert({
          therapist_id: values.therapistId,
          weekday: values.weekday,
          start_time: values.start,
          end_time: values.end,
        });
      if (insertError) throw insertError;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["schedules"] });
      onClose();
    },
    onError: () =>
      setError("No se pudo guardar el horario. Revisa permisos y cruces."),
  });
  return (
    <div className="modal-backdrop">
      <div className="modal" role="dialog" aria-modal="true">
        <div className="modal-head">
          <div>
            <span className="eyebrow">NUEVO HORARIO</span>
            <h2>Definir jornada</h2>
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
            <Field label="Masajista">
              <select {...form.register("therapistId")}>
                <option value="">Seleccionar</option>
                {therapists?.map((therapist) => (
                  <option key={therapist.id} value={therapist.id}>
                    {therapist.full_name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Día">
              <select {...form.register("weekday")}>
                {days.map((day, index) => (
                  <option key={day} value={index}>
                    {day}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Inicio">
              <input type="time" {...form.register("start")} />
            </Field>
            <Field label="Fin" error={form.formState.errors.end?.message}>
              <input type="time" {...form.register("end")} />
            </Field>
          </div>
          <div className="modal-actions">
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" loading={mutation.isPending}>
              Guardar horario
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

const blockSchema = z
  .object({
    therapistId: z.string().min(1, "Selecciona masajista"),
    date: z.string().min(1, "Selecciona fecha"),
    start: z.string(),
    end: z.string(),
    reason: z.string().trim().min(2, "Ingresa motivo"),
  })
  .refine((value) => value.start < value.end, {
    path: ["end"],
    message: "La hora final debe ser posterior",
  });
type BlockValues = z.infer<typeof blockSchema>;
type BlockInput = z.input<typeof blockSchema>;
function BlockForm({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const [error, setError] = useState("");
  const { data: therapists } = useQuery({
    queryKey: ["block-therapists"],
    queryFn: getTherapists,
  });
  const form = useForm<BlockInput, unknown, BlockValues>({
    resolver: zodResolver(blockSchema),
    defaultValues: {
      therapistId: "",
      date: "",
      start: "09:00",
      end: "18:00",
      reason: "",
    },
  });
  const mutation = useMutation({
    mutationFn: async (values: BlockValues) => {
      const startsAt = new Date(`${values.date}T${values.start}:00-05:00`);
      const endsAt = new Date(`${values.date}T${values.end}:00-05:00`);
      const { error: insertError } = await supabase
        .from("therapist_schedule_blocks")
        .insert({
          therapist_id: values.therapistId,
          starts_at: startsAt.toISOString(),
          ends_at: endsAt.toISOString(),
          reason: values.reason,
        });
      if (insertError) throw insertError;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["schedule-blocks"] });
      onClose();
    },
    onError: () => setError("No se pudo crear el bloqueo."),
  });
  return (
    <div className="modal-backdrop">
      <div className="modal" role="dialog" aria-modal="true">
        <div className="modal-head">
          <div>
            <span className="eyebrow">EXCEPCIÓN DE AGENDA</span>
            <h2>Bloquear horario</h2>
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
            <Field label="Masajista">
              <select {...form.register("therapistId")}>
                <option value="">Seleccionar</option>
                {therapists?.map((therapist) => (
                  <option key={therapist.id} value={therapist.id}>
                    {therapist.full_name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Fecha">
              <input type="date" {...form.register("date")} />
            </Field>
            <Field label="Inicio">
              <input type="time" {...form.register("start")} />
            </Field>
            <Field label="Fin" error={form.formState.errors.end?.message}>
              <input type="time" {...form.register("end")} />
            </Field>
          </div>
          <Field label="Motivo">
            <input
              {...form.register("reason")}
              placeholder="Vacaciones, permiso…"
            />
          </Field>
          <div className="modal-actions">
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" loading={mutation.isPending}>
              Guardar bloqueo
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
