import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Eye, Plus, Printer } from "lucide-react";
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
  promotion: { name: string } | null;
}
interface SalePromotion {
  id: string;
  name: string;
  discount_type: "percentage" | "fixed";
  discount_value: number | string;
  starts_at: string | null;
  ends_at: string | null;
  max_uses: number | null;
  uses_count: number;
  service_ids: string[];
}
interface SalePackage {
  id: string;
  name: string;
  price: number | string;
  validity_days: number | null;
  package_items: Array<{ service_id: string; quantity: number }>;
}
async function getSales(page: number, pageSize: number) {
  const { data, count, error } = await supabase
    .from("sales")
    .select(
      "id, total, discount, created_at, customer:customers(full_name), promotion:promotions(name)",
      { count: "exact" },
    )
    .order("created_at", { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1);
  if (error) throw error;
  return { rows: (data ?? []) as unknown as SaleRow[], total: count ?? 0 };
}
async function getSaleOptions() {
  const [services, customers, packages, promotions, promotionServices] =
    await Promise.all([
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
      supabase
        .from("packages")
        .select(
          "id, name, price, validity_days, package_items(service_id, quantity)",
        )
        .eq("active", true)
        .order("name"),
      supabase
        .from("promotions")
        .select(
          "id, name, discount_type, discount_value, starts_at, ends_at, max_uses, uses_count",
        )
        .eq("active", true)
        .order("name"),
      supabase.from("promotion_services").select("promotion_id, service_id"),
    ]);
  if (services.error) throw services.error;
  if (customers.error) throw customers.error;
  if (packages.error) throw packages.error;
  if (promotions.error) throw promotions.error;
  if (promotionServices.error) throw promotionServices.error;
  const now = Date.now();
  const serviceIdsByPromotion = new Map<string, string[]>();
  for (const item of promotionServices.data ?? []) {
    const serviceIds = serviceIdsByPromotion.get(item.promotion_id) ?? [];
    serviceIds.push(item.service_id);
    serviceIdsByPromotion.set(item.promotion_id, serviceIds);
  }
  return {
    services: (services.data ?? []) as Service[],
    customers: (customers.data ?? []) as Customer[],
    packages: (packages.data ?? []) as unknown as SalePackage[],
    promotions: (promotions.data ?? [])
      .filter((promotion) => {
        const starts = promotion.starts_at
          ? new Date(promotion.starts_at).getTime()
          : -Infinity;
        const ends = promotion.ends_at
          ? new Date(promotion.ends_at).getTime()
          : Infinity;
        return (
          starts <= now &&
          now <= ends &&
          (promotion.max_uses === null ||
            promotion.uses_count < promotion.max_uses)
        );
      })
      .map((promotion) => ({
        ...promotion,
        service_ids: serviceIdsByPromotion.get(promotion.id) ?? [],
      })) as SalePromotion[],
  };
}
const saleSchema = z.object({
  items: z
    .array(
      z.object({
        itemType: z.enum(["service", "package"]),
        serviceId: z.string(),
        packageId: z.string(),
        quantity: z.coerce.number().int().min(1),
      }),
    )
    .min(1, "Agrega al menos un servicio"),
  customerId: z.string(),
  promotionId: z.string(),
  discount: z.coerce.number().min(0),
  paymentMethod: z.enum(["cash", "yape", "plin", "card", "transfer", "other"]),
  paymentAmount: z.coerce.number().min(0),
});
type SaleValues = z.infer<typeof saleSchema>;
type SaleInput = z.input<typeof saleSchema>;
export function SalesPage() {
  const [open, setOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
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
                  <th>Promoción</th>
                  <th>Estado</th>
                  <th aria-label="Acciones" />
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
                    <td>{sale.promotion?.name || "—"}</td>
                    <td>
                      <Badge tone="success">Registrada</Badge>
                    </td>
                    <td>
                      <button
                        type="button"
                        className="icon-action"
                        title="Ver detalle e imprimir boleta"
                        aria-label="Ver detalle e imprimir boleta"
                        onClick={() => setDetailId(sale.id)}
                      >
                        <Eye size={15} />
                      </button>
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
      {detailId && (
        <SaleDetail saleId={detailId} onClose={() => setDetailId(null)} />
      )}
    </>
  );
}
function SaleDetail({
  saleId,
  onClose,
}: {
  saleId: string;
  onClose: () => void;
}) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["sale-detail", saleId],
    queryFn: async () => {
      const [saleResult, itemsResult, paymentsResult] = await Promise.all([
        supabase
          .from("sales")
          .select(
            "id, customer_id, subtotal, discount, total, created_at, customer:customers(full_name, phone, email), promotion:promotions(name)",
          )
          .eq("id", saleId)
          .single(),
        supabase
          .from("sale_items")
          .select("description, quantity, unit_price, discount, total")
          .eq("sale_id", saleId),
        supabase
          .from("payments")
          .select("payment_method, amount, reference_number")
          .eq("sale_id", saleId),
      ]);
      if (saleResult.error) throw saleResult.error;
      if (itemsResult.error) throw itemsResult.error;
      if (paymentsResult.error) throw paymentsResult.error;
      let customerName = saleResult.data.customer?.[0]?.full_name ?? null;
      if (!customerName && saleResult.data.customer_id) {
        const { data: customer, error: customerError } = await supabase
          .from("customers")
          .select("full_name")
          .eq("id", saleResult.data.customer_id)
          .maybeSingle();
        if (customerError) throw customerError;
        customerName = customer?.full_name ?? null;
      }
      return {
        sale: saleResult.data,
        customerName,
        items: itemsResult.data ?? [],
        payments: paymentsResult.data ?? [],
      };
    },
  });
  if (isLoading) {
    return (
      <div className="modal-backdrop">
        <div className="modal">Cargando detalle…</div>
      </div>
    );
  }
  if (error || !data) {
    return (
      <div className="modal-backdrop">
        <div className="modal">
          <ErrorMessage message="No se pudo cargar el detalle de la venta." />
          <Button variant="secondary" onClick={onClose}>
            Cerrar
          </Button>
        </div>
      </div>
    );
  }
  return (
    <div className="modal-backdrop">
      <div className="modal printable-receipt" role="dialog" aria-modal="true">
        <div className="modal-head">
          <div>
            <span className="eyebrow">VOUCHER</span>
            <h2>Detalle de venta</h2>
          </div>
          <button
            className="modal-close no-print"
            onClick={onClose}
            aria-label="Cerrar"
          >
            ×
          </button>
        </div>
        <div className="receipt-header">
          <strong>Centro de Masajes</strong>
          <span>
            {new Intl.DateTimeFormat("es-PE", {
              dateStyle: "medium",
              timeStyle: "short",
              timeZone: "America/Lima",
            }).format(new Date(data.sale.created_at))}
          </span>
          <span>
            Cliente:{" "}
            {data.customerName ||
              (data.sale.customer_id
                ? "Cliente no disponible"
                : "Cliente no registrado")}
          </span>
          {data.sale.promotion?.[0]?.name && (
            <span>Promoción: {data.sale.promotion[0].name}</span>
          )}
        </div>
        <div className="responsive-table">
          <table>
            <thead>
              <tr>
                <th>Servicio</th>
                <th>Cant.</th>
                <th>Precio</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((item, index) => (
                <tr key={index}>
                  <td>{item.description}</td>
                  <td>{item.quantity}</td>
                  <td>{formatCurrency(item.unit_price)}</td>
                  <td>{formatCurrency(item.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="receipt-totals">
          <span>Subtotal: {formatCurrency(data.sale.subtotal)}</span>
          <span>Descuento: {formatCurrency(data.sale.discount)}</span>
          <strong>Total: {formatCurrency(data.sale.total)}</strong>
        </div>
        {data.payments.length > 0 && (
          <p className="muted">
            Pago:{" "}
            {data.payments.map((payment) => payment.payment_method).join(", ")}
          </p>
        )}
        <div className="modal-actions no-print">
          <Button variant="secondary" onClick={onClose}>
            Cerrar
          </Button>
          <Button onClick={() => window.print()}>
            <Printer size={15} /> Imprimir voucher
          </Button>
        </div>
      </div>
    </div>
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
      items: [
        { itemType: "service", serviceId: "", packageId: "", quantity: 1 },
      ],
      customerId: "",
      promotionId: "",
      discount: 0,
      paymentMethod: "cash",
      paymentAmount: 0,
    },
  });
  const items = form.watch("items");
  const discount = Number(form.watch("discount") || 0);
  const promotionId = form.watch("promotionId");
  const promotion = options?.promotions.find((item) => item.id === promotionId);
  const subtotal = (items ?? []).reduce((sum, item) => {
    const price =
      item.itemType === "package"
        ? options?.packages.find((option) => option.id === item.packageId)
            ?.price
        : options?.services.find((option) => option.id === item.serviceId)
            ?.price;
    return sum + Number(price ?? 0) * Number(item.quantity || 0);
  }, 0);
  const promotionBase = (items ?? []).reduce((sum, item) => {
    const applies =
      !promotion ||
      promotion.service_ids.length === 0 ||
      promotion.service_ids.includes(item.serviceId);
    if (!applies) return sum;
    const price =
      item.itemType === "package"
        ? options?.packages.find((option) => option.id === item.packageId)
            ?.price
        : options?.services.find((option) => option.id === item.serviceId)
            ?.price;
    return sum + Number(price ?? 0) * Number(item.quantity || 0);
  }, 0);
  const promotionDiscount = promotion
    ? promotion.discount_type === "percentage"
      ? promotionBase * (Number(promotion.discount_value) / 100)
      : Math.min(promotionBase, Number(promotion.discount_value))
    : 0;
  const totalDiscount = Math.min(subtotal, discount + promotionDiscount);
  const total = Math.max(0, subtotal - totalDiscount);
  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "items",
  });
  const mutation = useMutation({
    mutationFn: async (values: SaleValues) => {
      const saleItems = values.items.map((item) => {
        const service =
          item.itemType === "service"
            ? options?.services.find((option) => option.id === item.serviceId)
            : null;
        const packageRow =
          item.itemType === "package"
            ? options?.packages.find((option) => option.id === item.packageId)
            : null;
        if (!service && !packageRow) throw new Error("Ítem inválido");
        if (packageRow && !values.customerId)
          throw new Error("Un paquete requiere cliente registrado");
        return {
          service,
          packageRow,
          quantity: item.quantity,
          subtotal:
            Number(service?.price ?? packageRow?.price ?? 0) * item.quantity,
        };
      });
      const saleSubtotal = saleItems.reduce(
        (sum, item) => sum + item.subtotal,
        0,
      );
      if (values.discount > saleSubtotal)
        throw new Error("Descuento supera subtotal");
      const selectedPromotion = options?.promotions.find(
        (item) => item.id === values.promotionId,
      );
      const promotionBase = saleItems.reduce((sum, item) => {
        const applies =
          !selectedPromotion ||
          selectedPromotion.service_ids.length === 0 ||
          selectedPromotion.service_ids.includes(item.service?.id ?? "");
        return applies ? sum + item.subtotal : sum;
      }, 0);
      const promotionDiscount = selectedPromotion
        ? selectedPromotion.discount_type === "percentage"
          ? promotionBase * (Number(selectedPromotion.discount_value) / 100)
          : Math.min(promotionBase, Number(selectedPromotion.discount_value))
        : 0;
      const totalDiscount = Math.min(
        saleSubtotal,
        values.discount + promotionDiscount,
      );
      const totalAmount = saleSubtotal - totalDiscount;
      const { data: sale, error: saleError } = await supabase
        .from("sales")
        .insert({
          customer_id: values.customerId || null,
          subtotal: saleSubtotal,
          discount: totalDiscount,
          total: totalAmount,
          promotion_id: values.promotionId || null,
        })
        .select("id")
        .single();
      if (saleError) throw saleError;
      const { error: itemError } = await supabase.from("sale_items").insert(
        saleItems.map((item) => ({
          sale_id: sale.id,
          service_id: item.service?.id ?? null,
          package_id: item.packageRow?.id ?? null,
          description: item.service?.name ?? item.packageRow?.name ?? "Ítem",
          quantity: item.quantity,
          unit_price: item.service?.price ?? item.packageRow?.price ?? 0,
          discount: 0,
          total: item.subtotal,
        })),
      );
      if (itemError) throw itemError;
      for (const item of saleItems.filter((saleItem) => saleItem.packageRow)) {
        const packageRow = item.packageRow!;
        const totalSessions = packageRow.package_items.reduce(
          (sum, packageItem) => sum + packageItem.quantity * item.quantity,
          0,
        );
        const expiresAt = packageRow.validity_days
          ? new Date(
              Date.now() + packageRow.validity_days * 86400000,
            ).toISOString()
          : null;
        const { error: customerPackageError } = await supabase
          .from("customer_packages")
          .insert({
            customer_id: values.customerId,
            package_id: packageRow.id,
            total_sessions: totalSessions,
            expires_at: expiresAt,
          });
        if (customerPackageError) throw customerPackageError;
      }
      if (selectedPromotion) {
        const { error: promotionError } = await supabase
          .from("promotions")
          .update({ uses_count: selectedPromotion.uses_count + 1 })
          .eq("id", selectedPromotion.id);
        if (promotionError) throw promotionError;
      }
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
      void queryClient.invalidateQueries({ queryKey: ["customer-packages"] });
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
          <Field label="Promoción (opcional)">
            <Controller
              control={form.control}
              name="promotionId"
              render={({ field }) => (
                <SearchableSelect
                  options={(options?.promotions ?? []).map((item) => ({
                    value: item.id,
                    label: `${item.name} · ${item.discount_type === "percentage" ? `${item.discount_value}%` : formatCurrency(item.discount_value)}`,
                  }))}
                  value={field.value}
                  onChange={field.onChange}
                  placeholder="Sin promoción"
                  searchPlaceholder="Buscar promoción…"
                />
              )}
            />
            {promotion && (
              <small className="field-hint">
                Descuento aplicado: {formatCurrency(promotionDiscount)}
              </small>
            )}
          </Field>
          <div className="form-section">
            <div className="card-heading">
              <strong>Servicios y paquetes vendidos</strong>
              <Button
                type="button"
                variant="secondary"
                onClick={() =>
                  append({
                    itemType: "service",
                    serviceId: "",
                    packageId: "",
                    quantity: 1,
                  })
                }
              >
                <Plus size={15} /> Agregar servicio
              </Button>
            </div>
            {fields.map((field, index) => (
              <div className="form-grid" key={field.id}>
                <Field
                  label={
                    (items[index]?.itemType === "package"
                      ? "Paquete "
                      : "Servicio ") +
                    (index + 1)
                  }
                  error={
                    form.formState.errors.items?.[index]?.serviceId?.message
                  }
                >
                  <Controller
                    control={form.control}
                    name={
                      ("items." +
                        index +
                        "." +
                        (items[index]?.itemType === "package"
                          ? "packageId"
                          : "serviceId")) as never
                    }
                    render={({ field: controllerField }) => (
                      <SearchableSelect
                        options={(
                          (items[index]?.itemType === "package"
                            ? options?.packages
                            : options?.services) ?? []
                        ).map((service) => ({
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
