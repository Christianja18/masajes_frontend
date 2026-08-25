import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, UserRound } from "lucide-react";
import { useState } from "react";
import { supabase } from "../../lib/supabase";
import {
  getUserRoleLabel,
  userRoleLabels,
  type StaffProfile,
  type UserRole,
} from "../../types/domain";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorMessage,
  IconButton,
  Pagination,
} from "../../shared/ui";

const roles: UserRole[] = ["admin", "manager", "receptionist", "therapist"];

async function getStaff(): Promise<StaffProfile[]> {
  const { data, error } = await supabase.rpc("list_staff_profiles");
  if (error) throw error;
  return (data ?? []) as StaffProfile[];
}

export function UsersPage() {
  const [editing, setEditing] = useState<StaffProfile | null>(null);
  const [page, setPage] = useState(1);
  const { data, isLoading, error } = useQuery({
    queryKey: ["staff-profiles"],
    queryFn: getStaff,
  });
  const staff = data ?? [];
  const pageSize = 10;
  const pageCount = Math.ceil(staff.length / pageSize);
  const visibleStaff = staff.slice((page - 1) * pageSize, page * pageSize);

  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">EQUIPO</span>
          <h1>Usuarios y masajistas</h1>
          <p>Activa accesos y asigna el rol de masajista al personal.</p>
        </div>
      </div>
      {error && (
        <ErrorMessage message="No pudimos cargar los usuarios del equipo." />
      )}
      {isLoading ? (
        <div className="table-loading">Cargando usuarios…</div>
      ) : staff.length === 0 ? (
        <Card>
          <EmptyState
            title="No hay usuarios registrados"
            text="Cuando alguien ingrese con Google aparecerá aquí."
          />
        </Card>
      ) : (
        <Card className="table-card">
          <div className="responsive-table">
            <table>
              <thead>
                <tr>
                  <th>Usuario</th>
                  <th>Correo</th>
                  <th>Rol</th>
                  <th>Estado</th>
                  <th aria-label="Acciones" />
                </tr>
              </thead>
              <tbody>
                {visibleStaff.map((member) => (
                  <tr key={member.id}>
                    <td>
                      <span className="inline-icon">
                        <span className="avatar avatar-small">
                          <UserRound size={15} />
                        </span>
                        <strong>{member.full_name}</strong>
                      </span>
                    </td>
                    <td>{member.email || "—"}</td>
                    <td>
                      <Badge
                        tone={member.role === "therapist" ? "info" : "neutral"}
                      >
                        {getUserRoleLabel(member.role)}
                      </Badge>
                    </td>
                    <td>
                      <Badge tone={member.active ? "success" : "danger"}>
                        {member.active ? "Activo" : "Inactivo"}
                      </Badge>
                    </td>
                    <td>
                      <IconButton
                        label="Editar acceso"
                        onClick={() => setEditing(member)}
                      >
                        <Pencil size={15} />
                      </IconButton>
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
      {editing && (
        <AccessForm member={editing} onClose={() => setEditing(null)} />
      )}
    </>
  );
}

function AccessForm({
  member,
  onClose,
}: {
  member: StaffProfile;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [role, setRole] = useState<UserRole>(member.role);
  const [active, setActive] = useState(member.active);
  const [serverError, setServerError] = useState("");
  const mutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("profiles")
        .update({ role, active })
        .eq("id", member.id);
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["staff-profiles"] });
      onClose();
    },
    onError: () => setServerError("No se pudo actualizar el acceso."),
  });

  return (
    <div className="modal-backdrop">
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="access-title"
      >
        <div className="modal-head">
          <div>
            <span className="eyebrow">ACCESO DEL EQUIPO</span>
            <h2 id="access-title">{member.full_name}</h2>
          </div>
          <button className="modal-close" onClick={onClose} aria-label="Cerrar">
            ×
          </button>
        </div>
        <p className="muted">{member.email || "Correo no disponible"}</p>
        {serverError && <ErrorMessage message={serverError} />}
        <div className="form-grid">
          <label className="field">
            <span>Rol</span>
            <select
              value={role}
              onChange={(event) => setRole(event.target.value as UserRole)}
            >
              {roles.map((value) => (
                <option key={value} value={value}>
                  {userRoleLabels[value]}
                </option>
              ))}
            </select>
          </label>
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={active}
              onChange={(event) => setActive(event.target.checked)}
            />
            Acceso activo
          </label>
        </div>
        {role === "therapist" && (
          <p className="form-hint">
            Se creará o actualizará su ficha de masajista y verá solo sus
            reservas.
          </p>
        )}
        <div className="modal-actions">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            type="button"
            loading={mutation.isPending}
            onClick={() => {
              setServerError("");
              mutation.mutate();
            }}
          >
            Guardar cambios
          </Button>
        </div>
      </div>
    </div>
  );
}
