import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { Controller, useForm, type Resolver } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { supabase } from "../../lib/supabase";
import type { Therapist } from "../../types/domain";
import { Button, ErrorMessage, SearchableSelect } from "../../shared/ui";

type Action = "open" | "close" | "movement" | "mobility";
const money = z.coerce.number().positive("Debe ser mayor que 0");
const openSchema = z.object({
  amount: z.coerce.number().min(0, "No puede ser negativo"),
});
const closeSchema = z.object({
  amount: z.coerce.number().min(0, "No puede ser negativo"),
});
const movementSchema = z.object({
  type: z.enum(["income", "expense"]),
  category: z.enum(["refund", "other"]),
  amount: money,
  description: z.string().trim().min(2, "Describe el movimiento"),
});
const mobilitySchema = z.object({
  amount: money,
  provider: z.string().trim().min(2, "Ingresa proveedor"),
  description: z.string().trim().min(2, "Describe el viaje"),
  therapistId: z.string(),
});
type Values = z.infer<typeof openSchema> &
  z.infer<typeof closeSchema> &
  z.infer<typeof movementSchema> &
  z.infer<typeof mobilitySchema>;

export function CashActions({
  action,
  onClose,
}: {
  action: Action;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [error, setError] = useState("");
  const { data: therapists } = useQuery({
    queryKey: ["therapists-options"],
    queryFn: async () => {
      const { data, error: queryError } = await supabase
        .from("therapists")
        .select("id, full_name, phone, active")
        .eq("active", true)
        .order("full_name");
      if (queryError) throw queryError;
      return (data ?? []) as Therapist[];
    },
    enabled: action === "mobility",
  });
  const form = useForm<Values>({
    resolver: zodResolver(
      action === "open"
        ? openSchema
        : action === "close"
          ? closeSchema
          : action === "movement"
            ? movementSchema
            : mobilitySchema,
    ) as unknown as Resolver<Values>,
    defaultValues: {
      amount: 0,
      type: "expense",
      category: "other",
      description: "",
      provider: "",
      therapistId: "",
    },
  });
  const mutation = useMutation({
    mutationFn: async (values: Values) => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("Sesión expirada");
      const { data: register } = await supabase
        .from("cash_registers")
        .select("id")
        .eq("status", "open")
        .maybeSingle();
      if (action === "open") {
        if (register) throw new Error("Ya existe una caja abierta");
        const { error: insertError } = await supabase
          .from("cash_registers")
          .insert({
            opening_amount: values.amount,
            opened_by: userData.user.id,
          });
        if (insertError) throw insertError;
        return;
      }
      if (!register) throw new Error("Primero debes abrir la caja");
      if (action === "close") {
        const { error: updateError } = await supabase
          .from("cash_registers")
          .update({
            status: "closed",
            closing_amount: values.amount,
            closed_at: new Date().toISOString(),
            closed_by: userData.user.id,
          })
          .eq("id", register.id);
        if (updateError) throw updateError;
        return;
      }
      const category = action === "mobility" ? "mobility" : values.category;
      const { data: movement, error: movementError } = await supabase
        .from("cash_movements")
        .insert({
          cash_register_id: register.id,
          movement_type: action === "mobility" ? "expense" : values.type,
          category,
          amount: values.amount,
          description:
            action === "mobility"
              ? `${values.provider}: ${values.description}`
              : values.description,
          created_by: userData.user.id,
        })
        .select("id")
        .single();
      if (movementError) throw movementError;
      if (action === "mobility") {
        const { error: mobilityError } = await supabase
          .from("mobility_expenses")
          .insert({
            amount: values.amount,
            provider: values.provider,
            description: values.description,
            therapist_id: values.therapistId || null,
            cash_movement_id: movement.id,
            created_by: userData.user.id,
          });
        if (mobilityError) throw mobilityError;
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["cash"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      onClose();
    },
    onError: (cause: Error) =>
      setError(
        cause.message.includes("caja")
          ? cause.message
          : "No se pudo guardar la operación.",
      ),
  });
  const title =
    action === "open"
      ? "Abrir caja"
      : action === "close"
        ? "Cerrar caja"
        : action === "mobility"
          ? "Registrar movilidad"
          : "Nuevo movimiento";
  return (
    <div className="modal-backdrop">
      <div className="modal" role="dialog" aria-modal="true">
        <div className="modal-head">
          <div>
            <span className="eyebrow">CAJA</span>
            <h2>{title}</h2>
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
          {(action === "open" || action === "close") && (
            <Field
              label={
                action === "open" ? "Monto inicial (S/)" : "Monto contado (S/)"
              }
              error={form.formState.errors.amount?.message}
            >
              <input
                type="number"
                min="0"
                step="0.01"
                {...form.register("amount")}
              />
            </Field>
          )}
          {action === "movement" && (
            <>
              <div className="segmented">
                <label>
                  <input
                    type="radio"
                    value="expense"
                    {...form.register("type")}
                  />{" "}
                  Gasto
                </label>
                <label>
                  <input
                    type="radio"
                    value="income"
                    {...form.register("type")}
                  />{" "}
                  Ingreso
                </label>
              </div>
              <div className="form-grid">
                <Field
                  label="Categoría"
                  error={form.formState.errors.category?.message}
                >
                  <select {...form.register("category")}>
                    <option value="other">Otro</option>
                    <option value="refund">Devolución</option>
                  </select>
                </Field>
                <Field
                  label="Monto (S/)"
                  error={form.formState.errors.amount?.message}
                >
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    {...form.register("amount")}
                  />
                </Field>
              </div>
              <Field
                label="Descripción"
                error={form.formState.errors.description?.message}
              >
                <input
                  {...form.register("description")}
                  placeholder="Detalle del movimiento"
                />
              </Field>
            </>
          )}
          {action === "mobility" && (
            <>
              <div className="form-grid">
                <Field
                  label="Monto taxi (S/)"
                  error={form.formState.errors.amount?.message}
                >
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    {...form.register("amount")}
                  />
                </Field>
                <Field
                  label="Proveedor"
                  error={form.formState.errors.provider?.message}
                >
                  <input
                    {...form.register("provider")}
                    placeholder="Taxi / aplicativo"
                  />
                </Field>
                <Field label="Masajista">
                  <Controller
                    control={form.control}
                    name="therapistId"
                    render={({ field }) => (
                      <SearchableSelect
                        options={(therapists ?? []).map((therapist) => ({
                          value: therapist.id,
                          label: therapist.full_name,
                        }))}
                        value={field.value}
                        onChange={field.onChange}
                        placeholder="Sin asignar"
                        searchPlaceholder="Buscar masajista…"
                      />
                    )}
                  />
                </Field>
              </div>
              <Field
                label="Descripción"
                error={form.formState.errors.description?.message}
              >
                <input
                  {...form.register("description")}
                  placeholder="Origen y destino"
                />
              </Field>
            </>
          )}
        </form>
        <div className="modal-actions">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            type="submit"
            loading={mutation.isPending}
            onClick={() =>
              void form.handleSubmit((values) => mutation.mutate(values))()
            }
          >
            {action === "close" ? "Cerrar caja" : "Guardar"}
          </Button>
        </div>
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
