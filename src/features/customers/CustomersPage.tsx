import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Search, Trash2, UserRound } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { supabase } from "../../lib/supabase";
import type { Customer } from "../../types/domain";
import {
  Button,
  Card,
  EmptyState,
  ErrorMessage,
  IconButton,
  Pagination,
} from "../../shared/ui";
async function getCustomers(): Promise<Customer[]> {
  const { data, error } = await supabase
    .from("customers")
    .select("id, full_name, phone, email, active")
    .order("full_name");
  if (error) throw error;
  return (data ?? []) as Customer[];
}
export function CustomersPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [page, setPage] = useState(1);
  const { data, isLoading, error } = useQuery({
    queryKey: ["customers"],
    queryFn: getCustomers,
  });
  const customers = (data ?? []).filter(
    (c) =>
      c.full_name.toLowerCase().includes(search.toLowerCase()) ||
      (c.phone || "").includes(search),
  );
  const pageSize = 10;
  const pageCount = Math.ceil(customers.length / pageSize);
  const visibleCustomers = customers.slice(
    (page - 1) * pageSize,
    page * pageSize,
  );
  const deactivateCustomer = async (id: string) => {
    if (!window.confirm("¿Desactivar este cliente?")) return;
    const { error: updateError } = await supabase
      .from("customers")
      .update({ active: false })
      .eq("id", id);
    if (!updateError)
      void queryClient.invalidateQueries({ queryKey: ["customers"] });
  };
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">RELACIÓN</span>
          <h1>Clientes</h1>
          <p>
            Consulta clientes registrados. Las reservas también aceptan
            invitados.
          </p>
        </div>
        <Button onClick={() => setOpen(true)}>
          <Plus size={17} /> Nuevo cliente
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
            placeholder="Buscar por nombre o teléfono…"
            aria-label="Buscar clientes"
          />
        </div>
      </Card>
      {error && <ErrorMessage message="No pudimos cargar los clientes." />}
      {isLoading ? (
        <div className="table-loading">Cargando clientes…</div>
      ) : customers.length === 0 ? (
        <Card>
          <EmptyState
            title="No hay clientes registrados"
            text="Puedes crear una reserva sin registrar al cliente."
          />
        </Card>
      ) : (
        <Card className="table-card">
          <div className="responsive-table">
            <table>
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Teléfono</th>
                  <th>Correo</th>
                  <th>Estado</th>
                  <th aria-label="Acciones" />
                </tr>
              </thead>
              <tbody>
                {visibleCustomers.map((customer) => (
                  <tr key={customer.id}>
                    <td>
                      <span className="inline-icon">
                        <span className="avatar avatar-small">
                          <UserRound size={15} />
                        </span>
                        <strong>{customer.full_name}</strong>
                      </span>
                    </td>
                    <td>
                      <div className="row-actions">
                        <IconButton
                          label="Editar cliente"
                          onClick={() => setEditing(customer)}
                        >
                          <Pencil size={15} />
                        </IconButton>
                        <IconButton
                          label="Desactivar cliente"
                          variant="danger"
                          onClick={() => void deactivateCustomer(customer.id)}
                        >
                          <Trash2 size={15} />
                        </IconButton>
                      </div>
                    </td>
                    <td>{customer.phone || "—"}</td>
                    <td>{customer.email || "—"}</td>
                    <td>
                      <span
                        className={`status-dot ${customer.active ? "active" : ""}`}
                      >
                        {customer.active ? "Activo" : "Inactivo"}
                      </span>
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
      {open && <CustomerForm onClose={() => setOpen(false)} />}
      {editing && (
        <CustomerForm customer={editing} onClose={() => setEditing(null)} />
      )}
    </>
  );
}

const customerSchema = z.object({
  fullName: z.string().trim().min(2, "Ingresa el nombre completo"),
  phone: z.string().trim().min(6, "Ingresa un teléfono válido"),
  email: z.string().trim().email("Correo inválido").or(z.literal("")),
  notes: z.string().trim(),
});
type CustomerFormValues = z.infer<typeof customerSchema>;

function CustomerForm({
  customer,
  onClose,
}: {
  customer?: Customer;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [serverError, setServerError] = useState("");
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CustomerFormValues>({
    resolver: zodResolver(customerSchema),
    defaultValues: {
      fullName: customer?.full_name ?? "",
      phone: customer?.phone ?? "",
      email: customer?.email ?? "",
      notes: "",
    },
  });
  const mutation = useMutation({
    mutationFn: async (values: CustomerFormValues) => {
      const query = customer
        ? supabase
            .from("customers")
            .update({
              full_name: values.fullName,
              phone: values.phone,
              email: values.email || null,
              notes: values.notes || null,
            })
            .eq("id", customer.id)
        : supabase
            .from("customers")
            .insert({
              full_name: values.fullName,
              phone: values.phone,
              email: values.email || null,
              notes: values.notes || null,
            });
      const { error } = await query;
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["customers"] });
      onClose();
    },
    onError: () =>
      setServerError("No se pudo guardar el cliente. Revisa permisos y datos."),
  });
  return (
    <div className="modal-backdrop">
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="customer-title"
      >
        <div className="modal-head">
          <div>
            <span className="eyebrow">
              {customer ? "EDITAR CLIENTE" : "NUEVO CLIENTE"}
            </span>
            <h2 id="customer-title">
              {customer ? "Editar cliente" : "Registrar cliente"}
            </h2>
          </div>
          <button className="modal-close" onClick={onClose} aria-label="Cerrar">
            ×
          </button>
        </div>
        {serverError && <ErrorMessage message={serverError} />}
        <form
          className="booking-form"
          onSubmit={(event) =>
            void handleSubmit((values) => mutation.mutate(values))(event)
          }
        >
          <div className="form-grid">
            <label className="field">
              <span>Nombre completo</span>
              <input
                {...register("fullName")}
                placeholder="Nombre del cliente"
              />
              {errors.fullName && (
                <small className="field-error">{errors.fullName.message}</small>
              )}
            </label>
            <label className="field">
              <span>Teléfono</span>
              <input {...register("phone")} placeholder="999 999 999" />
              {errors.phone && (
                <small className="field-error">{errors.phone.message}</small>
              )}
            </label>
            <label className="field">
              <span>Correo (opcional)</span>
              <input
                type="email"
                {...register("email")}
                placeholder="cliente@correo.com"
              />
              {errors.email && (
                <small className="field-error">{errors.email.message}</small>
              )}
            </label>
            <label className="field">
              <span>Notas (opcional)</span>
              <input
                {...register("notes")}
                placeholder="Preferencias o notas"
              />
            </label>
          </div>
          <div className="modal-actions">
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" loading={mutation.isPending}>
              {customer ? "Actualizar cliente" : "Guardar cliente"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
