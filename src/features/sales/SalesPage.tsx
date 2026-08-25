import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { useState, type ReactNode } from "react";
import { useForm } from "react-hook-form";
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
} from "../../shared/ui";

interface SaleRow {
  id: string;
  total: number | string;
  discount: number | string;
  created_at: string;
  customer: { full_name: string } | null;
}
async function getSales(): Promise<SaleRow[]> {
  const { data, error } = await supabase
    .from("sales")
    .select("id, total, discount, created_at, customer:customers(full_name)")
    .order("created_at", { ascending: false })
    .limit(30);
  if (error) throw error;
  return (data ?? []) as unknown as SaleRow[];
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
  serviceId: z.string().min(1, "Selecciona un servicio"),
  customerId: z.string(),
  quantity: z.coerce.number().int().min(1),
  discount: z.coerce.number().min(0),
  paymentMethod: z.enum(["cash", "yape", "plin", "card", "transfer", "other"]),
  paymentAmount: z.coerce.number().min(0),
});
type SaleValues = z.infer<typeof saleSchema>;
type SaleInput = z.input<typeof saleSchema>;
export function SalesPage() {
  const [open, setOpen] = useState(false);
  const [page, setPage] = useState(1);
  const { data, isLoading, error } = useQuery({
    queryKey: ["sales"],
    queryFn: getSales,
  });
  const pageSize = 10;
  const pageCount = Math.ceil((data?.length ?? 0) / pageSize);
  const visibleSales = (data ?? []).slice(
    (page - 1) * pageSize,
    page * pageSize,
  );
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
      ) : data?.length ? (
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
                {visibleSales.map((sale) => (
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
      serviceId: "",
      customerId: "",
      quantity: 1,
      discount: 0,
      paymentMethod: "cash",
      paymentAmount: 0,
    },
  });
  const serviceId = form.watch("serviceId");
  const quantity = Number(form.watch("quantity") || 0);
  const discount = Number(form.watch("discount") || 0);
  const selected = options?.services.find(
    (service) => service.id === serviceId,
  );
  const total = Math.max(0, Number(selected?.price ?? 0) * quantity - discount);
  const mutation = useMutation({
    mutationFn: async (values: SaleValues) => {
      const service = options?.services.find(
        (item) => item.id === values.serviceId,
      );
      if (!service) throw new Error("Servicio inválido");
      if (values.discount > service.price * values.quantity)
        throw new Error("Descuento supera subtotal");
      const subtotal = Number(service.price) * values.quantity;
      const totalAmount = subtotal - values.discount;
      const { data: sale, error: saleError } = await supabase
        .from("sales")
        .insert({
          customer_id: values.customerId || null,
          subtotal,
          discount: values.discount,
          total: totalAmount,
        })
        .select("id")
        .single();
      if (saleError) throw saleError;
      const { error: itemError } = await supabase.from("sale_items").insert({
        sale_id: sale.id,
        service_id: service.id,
        description: service.name,
        quantity: values.quantity,
        unit_price: service.price,
        discount: 0,
        total: subtotal,
      });
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
            <Field
              label="Servicio"
              error={form.formState.errors.serviceId?.message}
            >
              <select {...form.register("serviceId")}>
                <option value="">Seleccionar servicio</option>
                {options?.services.map((service) => (
                  <option key={service.id} value={service.id}>
                    {service.name} · {formatCurrency(service.price)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Cliente (opcional)">
              <select {...form.register("customerId")}>
                <option value="">Sin cliente registrado</option>
                {options?.customers.map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.full_name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Cantidad">
              <input type="number" min="1" {...form.register("quantity")} />
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
