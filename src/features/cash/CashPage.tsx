import { useQuery } from "@tanstack/react-query";
import {
  ArrowDownLeft,
  ArrowUpRight,
  CarFront,
  Plus,
  WalletCards,
} from "lucide-react";
import { supabase } from "../../lib/supabase";
import { useState } from "react";
import { CashActions } from "./CashActions";
import type { CashMovement, CashRegister } from "../../types/domain";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorMessage,
  formatCurrency,
  Pagination,
} from "../../shared/ui";
async function getCash(page: number, pageSize: number) {
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  const [register, movements] = await Promise.all([
    supabase
      .from("cash_registers")
      .select("id, opening_amount, status, opened_at")
      .eq("status", "open")
      .maybeSingle(),
    supabase
      .from("cash_movements")
      .select("id, movement_type, category, amount, description, created_at", {
        count: "exact",
      })
      .order("created_at", { ascending: false })
      .range(from, to),
  ]);
  if (register.error) throw register.error;
  if (movements.error) throw movements.error;
  return {
    register: register.data as CashRegister | null,
    movements: (movements.data ?? []) as CashMovement[],
    totalMovements: movements.count ?? 0,
  };
}
export function CashPage() {
  const [action, setAction] = useState<
    "open" | "close" | "movement" | "mobility" | null
  >(null);
  const [page, setPage] = useState(1);
  const pageSize = 6;
  const { data, isLoading, error } = useQuery({
    queryKey: ["cash", page],
    queryFn: () => getCash(page, pageSize),
  });
  const income =
    data?.movements
      .filter((m) => m.movement_type === "income")
      .reduce((s, m) => s + Number(m.amount), 0) ?? 0;
  const expense =
    data?.movements
      .filter((m) => m.movement_type === "expense")
      .reduce((s, m) => s + Number(m.amount), 0) ?? 0;
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">CONTROL FINANCIERO</span>
          <h1>Caja y movilidad</h1>
          <p>Controla ingresos y gastos del turno.</p>
        </div>
        <div className="heading-actions">
          <Button variant="secondary" onClick={() => setAction("mobility")}>
            <CarFront size={17} /> Registrar movilidad
          </Button>
          <Button onClick={() => setAction("movement")}>
            <Plus size={17} /> Movimiento
          </Button>
        </div>
      </div>
      {error && <ErrorMessage message="No pudimos cargar la caja." />}
      {!isLoading && !data?.register && (
        <div className="error-box">
          <strong>Caja cerrada.</strong> Abre una caja para registrar pagos y
          gastos. <Button onClick={() => setAction("open")}>Abrir caja</Button>
        </div>
      )}
      {isLoading ? (
        <div className="loading-grid">
          <div />
          <div />
          <div />
        </div>
      ) : (
        <>
          <div className="cash-top-grid">
            <Card className="cash-main-card">
              <div className="cash-main-head">
                <div className="stat-icon blue">
                  <WalletCards />
                </div>
                <div>
                  <span>CAJA ACTUAL</span>
                  <strong>
                    {data?.register ? "Caja abierta" : "Caja cerrada"}
                  </strong>
                </div>
                <Badge tone={data?.register ? "success" : "warning"}>
                  {data?.register ? "Operativa" : "Requiere apertura"}
                </Badge>
              </div>
              <div className="cash-balance">
                {formatCurrency(
                  Number(data?.register?.opening_amount ?? 0) +
                    income -
                    expense,
                )}
              </div>
              <span className="muted">Saldo estimado del turno</span>
              {data?.register && (
                <Button variant="secondary" onClick={() => setAction("close")}>
                  Cerrar caja
                </Button>
              )}
            </Card>
            <Card className="mini-finance">
              <div>
                <ArrowUpRight size={18} />
                <span>Ingresos</span>
                <strong>{formatCurrency(income)}</strong>
              </div>
              <div>
                <ArrowDownLeft size={18} />
                <span>Gastos</span>
                <strong>{formatCurrency(expense)}</strong>
              </div>
            </Card>
          </div>
          <Card className="table-card">
            <div className="card-heading">
              <div>
                <span className="eyebrow">MOVIMIENTOS RECIENTES</span>
                <h3>Actividad de caja</h3>
              </div>
            </div>
            {data?.movements.length ? (
              <div className="responsive-table">
                <table>
                  <thead>
                    <tr>
                      <th>Tipo</th>
                      <th>Detalle</th>
                      <th>Monto</th>
                      <th>Fecha</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data?.movements ?? []).map((movement) => (
                      <tr key={movement.id}>
                        <td>
                          <Badge
                            tone={
                              movement.movement_type === "income"
                                ? "success"
                                : "danger"
                            }
                          >
                            {movement.movement_type === "income"
                              ? "Ingreso"
                              : "Gasto"}
                          </Badge>
                        </td>
                        <td>
                          {movement.category === "mobility" ? (
                            <span className="inline-icon">
                              <CarFront size={15} /> Movilidad
                            </span>
                          ) : (
                            movement.description || movement.category
                          )}
                        </td>
                        <td
                          className={
                            movement.movement_type === "income"
                              ? "positive"
                              : "negative"
                          }
                        >
                          {movement.movement_type === "income" ? "+" : "-"}
                          {formatCurrency(movement.amount)}
                        </td>
                        <td>
                          {new Intl.DateTimeFormat("es-PE", {
                            dateStyle: "short",
                            timeStyle: "short",
                            timeZone: "America/Lima",
                          }).format(new Date(movement.created_at))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState
                title="Sin movimientos"
                text="La actividad de caja aparecerá aquí."
              />
            )}
            <Pagination
              page={page}
              pageCount={Math.ceil((data?.totalMovements ?? 0) / pageSize)}
              onPageChange={setPage}
            />
          </Card>
        </>
      )}
      {action && (
        <CashActions action={action} onClose={() => setAction(null)} />
      )}
    </>
  );
}
