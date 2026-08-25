import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Controller, useFieldArray, useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { supabase } from "../../lib/supabase";
import type { Customer, Service } from "../../types/domain";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorMessage,
  formatCurrency,
  Pagination,
  SearchableSelect,
} from "../../shared/ui";

interface SaleRow {
  id: string;
  total: number | string;
  discount: number | string;
  created_at: string;
  customer: { full_name: string } | null;
}
async function getSales(page: number, pageSize: number) {
  const { data, count, error } = await supabase
    .from("sales")
    .select("id, total, discount, created_at, customer:customers(full_name)", {
      count: "exact",
    })
    .order("created_at", { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1);
  if (error) throw error;
  return { rows: (data ?? []) as unknown as SaleRow[], total: count ?? 0 };
}
async function getSaleOptions() {
  const [services, customers] = await Promise.all([
    supabase
      .from("services")
      .select("id, name, duration_minutes, price, active")
      .eq("active", true)
      .order("name"),
    supabase
      .from("customers")
      .select("id, full_name, phone, email, active")
      .eq("active", true)
      .order("full_name"),
  ]);
  if (services.error) throw services.error;
  if (customers.error) throw customers.error;
  return {
    services: (services.data ?? []) as Service[],
    customers: (customers.data ?? []) as Customer[],
  };
}
const saleSchema = z.object({
  items: z
    .array(
      z.object({
        serviceId: z.string().min(1, "Selecciona un servicio"),
        quantity: z.coerce.number().int().min(1),
      }),
    )
    .min(1, "Agrega al menos un servicio"),
  customerId: z.string(),
  discount: z.coerce.number().min(0),
  paymentMethod: z.enum(["cash", "yape", "plin", "card", "transfer", "other"]),
  paymentAmount: z.coerce.number().min(0),
});
type SaleValues = z.infer<typeof saleSchema>;
type SaleInput = z.input<typeof saleSchema>;
export function SalesPage() {
  const [open, setOpen] = useState(false);
  const [page, setPage] = useState(1);
  const pageSize = 6;
  const { data, isLoading, error } = useQuery({
    queryKey: ["sales", page],
    queryFn: () => getSales(page, pageSize),
  });
  const sales = data?.rows ?? [];
  const pageCount = Math.ceil((data?.total ?? 0) / pageSize);
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">INGRESOS</span>
          <h1>Ventas y pagos</h1>
          <p>Registra servicios vendidos y sus formas de pago.</p>
        </div>
        <Button onClick={() => setOpen(true)}>
          <Plus size={17} /> Nueva venta
        </Button>
      </div>
      {error && <ErrorMessage message="No pudimos cargar las ventas." />}
      {isLoading ? (
        <div className="table-loading">Cargando ventas…</div>
      ) : sales.length ? (
        <Card className="table-card">
          <div className="responsive-table">
            <table>
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Cliente</th>
                  <th>Total</th>
                  <th>Descuento</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {sales.map((sale) => (
                  <tr key={sale.id}>
                    <td>
                      {new Intl.DateTimeFormat("es-PE", {
                        dateStyle: "short",
                        timeStyle: "short",
                        timeZone: "America/Lima",
                      }).format(new Date(sale.created_at))}
                    </td>
                    <td>{sale.customer?.full_name || "Venta sin cliente"}</td>
                    <td>
                      <strong>{formatCurrency(sale.total)}</strong>
                    </td>
                    <td>{formatCurrency(sale.discount)}</td>
                    <td>
                      <Badge tone="success">Registrada</Badge>
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
      ) : (
        <Card>
          <EmptyState
            title="Sin ventas"
            text="Registra la primera venta del centro."
          />
        </Card>
      )}
      {open && <SaleForm onClose={() => setOpen(false)} />}
    </>
  );
}
function SaleForm({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const [error, setError] = useState("");
  const { data: options, isLoading } = useQuery({
    queryKey: ["sale-options"],
    queryFn: getSaleOptions,
  });
  const form = useForm<SaleInput, unknown, SaleValues>({
    resolver: zodResolver(saleSchema),
    defaultValues: {
      items: [{ serviceId: "", quantity: 1 }],
      customerId: "",
      discount: 0,
      paymentMethod: "cash",
      paymentAmount: 0,
    },
  });
  const items = form.watch("items");
  const discount = Number(form.watch("discount") || 0);
  const subtotal = (items ?? []).reduce((sum, item) => {
    const service = options?.services.find(
      (option) => option.id === item.serviceId,
    );
    return sum + Number(service?.price ?? 0) * Number(item.quantity || 0);
  }, 0);
  const total = Math.max(0, subtotal - discount);
  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "items",
  });
  const mutation = useMutation({
    mutationFn: async (values: SaleValues) => {
      const saleItems = values.items.map((item) => {
        const service = options?.services.find(
          (option) => option.id === item.serviceId,
        );
        if (!service) throw new Error("Servicio inválido");
        return {
          service,
          quantity: item.quantity,
          subtotal: Number(service.price) * item.quantity,
        };
      });
      const saleSubtotal = saleItems.reduce(
        (sum, item) => sum + item.subtotal,
        0,
      );
      if (values.discount > saleSubtotal)
        throw new Error("Descuento supera subtotal");
      const totalAmount = saleSubtotal - values.discount;
      const { data: sale, error: saleError } = await supabase
        .from("sales")
        .insert({
          customer_id: values.customerId || null,
          subtotal: saleSubtotal,
          discount: values.discount,
          total: totalAmount,
        })
        .select("id")
        .single();
      if (saleError) throw saleError;
      const { error: itemError } = await supabase.from("sale_items").insert(
        saleItems.map((item) => ({
          sale_id: sale.id,
          service_id: item.service.id,
          description: item.service.name,
          quantity: item.quantity,
          unit_price: item.service.price,
          discount: 0,
          total: item.subtotal,
        })),
      );
      if (itemError) throw itemError;
      if (values.paymentAmount > 0) {
        const { data: register } = await supabase
          .from("cash_registers")
          .select("id")
          .eq("status", "open")
          .maybeSingle();
        if (!register) throw new Error("Abre caja antes de registrar el pago");
        const { error: paymentError } = await supabase.rpc("register_payment", {
          p_sale_id: sale.id,
          p_cash_register_id: register.id,
          p_payment_method: values.paymentMethod,
          p_amount: values.paymentAmount,
          p_reference_number: null,
        });
        if (paymentError) throw paymentError;
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["sales"] });
      void queryClient.invalidateQueries({ queryKey: ["cash"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      onClose();
    },
    onError: (cause: Error) =>
      setError(
        cause.message.includes("caja")
          ? cause.message
          : "No se pudo registrar la venta.",
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
    <div className="modal-backdrop">
      <div className="modal" role="dialog" aria-modal="true">
        <div className="modal-head">
          <div>
            <span className="eyebrow">NUEVA VENTA</span>
            <h2>Registrar venta</h2>
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
            <Field label="Cliente (opcional)">
              <Controller
                control={form.control}
                name="customerId"
                render={({ field }) => (
                  <SearchableSelect
                    options={[
                      { value: "", label: "Sin cliente registrado" },
                      ...(options?.customers ?? []).map((customer) => ({
                        value: customer.id,
                        label: customer.full_name,
                      })),
                    ]}
                    value={field.value}
                    onChange={field.onChange}
                    placeholder="Sin cliente registrado"
                    searchPlaceholder="Buscar cliente…"
                  />
                )}
              />
            </Field>
            <Field label="Descuento (S/)">
              <input
                type="number"
                min="0"
                step="0.01"
                {...form.register("discount")}
              />
            </Field>
          </div>
          <div className="form-section">
            <div className="card-heading">
              <strong>Servicios vendidos</strong>
              <Button
                type="button"
                variant="secondary"
                onClick={() => append({ serviceId: "", quantity: 1 })}
              >
                <Plus size={15} /> Agregar servicio
              </Button>
            </div>
            {fields.map((field, index) => (
              <div className="form-grid" key={field.id}>
                <Field
                  label={"Servicio " + (index + 1)}
                  error={
                    form.formState.errors.items?.[index]?.serviceId?.message
                  }
                >
                  <Controller
                    control={form.control}
                    name={`items.${index}.serviceId` as const}
                    render={({ field: controllerField }) => (
                      <SearchableSelect
                        options={(options?.services ?? []).map((service) => ({
                          value: service.id,
                          label:
                            service.name +
                            " · " +
                            formatCurrency(service.price),
                        }))}
                        value={controllerField.value}
                        onChange={controllerField.onChange}
                        placeholder="Seleccionar servicio"
                        searchPlaceholder="Buscar servicio…"
                      />
                    )}
                  />
                </Field>
                <Field
                  label="Cantidad"
                  error={
                    form.formState.errors.items?.[index]?.quantity?.message
                  }
                >
                  <input
                    type="number"
                    min="1"
                    {...form.register(`items.${index}.quantity` as const)}
                  />
                </Field>
                <button
                  type="button"
                  className="icon-action icon-action-danger"
                  aria-label="Quitar servicio"
                  title="Quitar servicio"
                  disabled={fields.length === 1}
                  onClick={() => remove(index)}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
          <div className="cash-total">
            <span>Total</span>
            <strong>{formatCurrency(total)}</strong>
          </div>
          <div className="form-grid">
            <Field label="Método de pago">
              <select {...form.register("paymentMethod")}>
                <option value="cash">Efectivo</option>
                <option value="yape">Yape</option>
                <option value="plin">Plin</option>
                <option value="card">Tarjeta</option>
                <option value="transfer">Transferencia</option>
                <option value="other">Otro</option>
              </select>
            </Field>
            <Field label="Pago recibido (S/)">
              <input
                type="number"
                min="0"
                step="0.01"
                {...form.register("paymentAmount")}
              />
            </Field>
          </div>
          <div className="modal-actions">
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" loading={mutation.isPending}>
              Guardar venta
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
