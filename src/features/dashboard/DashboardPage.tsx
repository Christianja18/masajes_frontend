import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import {
  ArrowUpRight,
  CalendarCheck2,
  CircleDollarSign,
  Clock3,
  MapPin,
  Plus,
  TrendingUp,
  WalletCards,
} from "lucide-react";
import { Link } from "react-router-dom";
import type { ReactNode } from "react";
import { supabase } from "../../lib/supabase";
import type { Booking } from "../../types/domain";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorMessage,
  formatCurrency,
} from "../../shared/ui";

async function getDashboardData() {
  const today = new Date();
  const start = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
  ).toISOString();
  const end = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate() + 1,
  ).toISOString();
  const [bookings, register, movements] = await Promise.all([
    supabase
      .from("bookings")
      .select(
        "id, customer_id, therapist_id, service_id, guest_name, guest_phone, starts_at, ends_at, status, location_type, address, address_reference, customer:customers(full_name), therapist:therapists(full_name), service:services(name, duration_minutes, price)",
      )
      .gte("starts_at", start)
      .lt("starts_at", end)
      .order("starts_at"),
    supabase
      .from("cash_registers")
      .select("id, opening_amount, status, opened_at")
      .eq("status", "open")
      .maybeSingle(),
    supabase
      .from("cash_movements")
      .select("id, movement_type, category, amount, description, created_at")
      .gte("created_at", start)
      .lt("created_at", end),
  ]);
  if (bookings.error) throw bookings.error;
  if (register.error) throw register.error;
  if (movements.error) throw movements.error;
  const rows = movements.data ?? [];
  const sales = rows
    .filter(
      (item) => item.category === "sale" && item.movement_type === "income",
    )
    .reduce((sum, item) => sum + Number(item.amount), 0);
  const expenses = rows
    .filter((item) => item.movement_type === "expense")
    .reduce((sum, item) => sum + Number(item.amount), 0);
  return {
    bookings: (bookings.data ?? []) as unknown as Booking[],
    register: register.data,
    sales,
    expenses,
  };
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

export function DashboardPage() {
  const queryClient = useQueryClient();
  useEffect(() => {
    const channel = supabase
      .channel("dashboard-bookings-live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "bookings" },
        () => {
          void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
          void queryClient.invalidateQueries({ queryKey: ["bookings"] });
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [queryClient]);
  const { data, isLoading, error } = useQuery({
    queryKey: ["dashboard"],
    queryFn: getDashboardData,
  });
  if (isLoading)
    return (
      <PageHeading title="Resumen" subtitle="Cargando actividad de hoy…">
        <div className="loading-grid">
          <div />
          <div />
          <div />
          <div />
        </div>
      </PageHeading>
    );
  if (error)
    return (
      <PageHeading title="Resumen" subtitle="No pudimos cargar los datos">
        <ErrorMessage message="Verifica que tu usuario tenga perfil y permisos en Supabase." />
      </PageHeading>
    );
  const bookings = data?.bookings ?? [];
  return (
    <PageHeading
      title="Resumen"
      subtitle={new Intl.DateTimeFormat("es-PE", {
        dateStyle: "full",
        timeZone: "America/Lima",
      }).format(new Date())}
    >
      <div className="heading-actions">
        <Link to="/reservas">
          <Button>
            <Plus size={17} /> Nueva reserva
          </Button>
        </Link>
      </div>
      <div className="stats-grid">
        <StatCard
          icon={<CalendarCheck2 />}
          label="Reservas de hoy"
          value={String(bookings.length)}
          note="Agenda del día"
          tone="mint"
        />
        <StatCard
          icon={<CircleDollarSign />}
          label="Ingresos de hoy"
          value={formatCurrency(data?.sales)}
          note="Pagos registrados"
          tone="violet"
        />
        <StatCard
          icon={<TrendingUp />}
          label="Gastos de hoy"
          value={formatCurrency(data?.expenses)}
          note="Incluye movilidad"
          tone="peach"
        />
        <StatCard
          icon={<WalletCards />}
          label="Estado de caja"
          value={data?.register ? "Abierta" : "Cerrada"}
          note={
            data?.register ? "Operación disponible" : "Abre caja para operar"
          }
          tone="blue"
        />
      </div>
      <div className="dashboard-columns">
        <Card>
          <div className="card-heading">
            <div>
              <span className="eyebrow">AGENDA</span>
              <h3>Próximas reservas</h3>
            </div>
            <Link className="text-link" to="/reservas">
              Ver agenda <ArrowUpRight size={15} />
            </Link>
          </div>
          {bookings.length === 0 ? (
            <EmptyState
              title="Día despejado"
              text="Todavía no hay reservas para hoy."
            />
          ) : (
            <div className="booking-list">
              {bookings.slice(0, 5).map((booking) => (
                <BookingRow key={booking.id} booking={booking} />
              ))}
            </div>
          )}
        </Card>
        <Card>
          <div className="card-heading">
            <div>
              <span className="eyebrow">CAJA</span>
              <h3>Resumen de operación</h3>
            </div>
            <Link className="text-link" to="/caja">
              Ver caja <ArrowUpRight size={15} />
            </Link>
          </div>
          <div className="cash-summary">
            <div>
              <span>Saldo inicial</span>
              <strong>
                {formatCurrency(Number(data?.register?.opening_amount ?? 0))}
              </strong>
            </div>
            <div>
              <span>Ingresos</span>
              <strong className="positive">
                +{formatCurrency(data?.sales)}
              </strong>
            </div>
            <div>
              <span>Gastos</span>
              <strong className="negative">
                -{formatCurrency(data?.expenses)}
              </strong>
            </div>
            <div className="cash-total">
              <span>Movimiento neto</span>
              <strong>
                {formatCurrency((data?.sales ?? 0) - (data?.expenses ?? 0))}
              </strong>
            </div>
          </div>
        </Card>
      </div>
    </PageHeading>
  );
}
function PageHeading({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children?: ReactNode;
}) {
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>{title}</h1>
          <p>{subtitle}</p>
        </div>
      </div>
      {children}
    </>
  );
}
function StatCard({
  icon,
  label,
  value,
  note,
  tone,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  note: string;
  tone: string;
}) {
  return (
    <Card className="stat-card">
      <div className={`stat-icon ${tone}`}>{icon}</div>
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
        <small>{note}</small>
      </div>
    </Card>
  );
}
function BookingRow({ booking }: { booking: Booking }) {
  const person =
    booking.customer?.full_name || booking.guest_name || "Cliente sin nombre";
  return (
    <div className="booking-row">
      <div className="time-block">
        <Clock3 size={15} />
        <strong>
          {new Intl.DateTimeFormat("es-PE", {
            timeStyle: "short",
            timeZone: "America/Lima",
          }).format(new Date(booking.starts_at))}
        </strong>
      </div>
      <div className="booking-info">
        <strong>{person}</strong>
        <span>
          {booking.service?.name || "Servicio"} ·{" "}
          {booking.therapist?.full_name || "Masajista"}
        </span>
      </div>
      <div className="booking-location">
        {booking.location_type === "customer_home" ? (
          <>
            <MapPin size={14} /> Domicilio
          </>
        ) : (
          "Local"
        )}
      </div>
      <Badge tone={statusTone[booking.status]}>
        {statusLabel[booking.status]}
      </Badge>
    </div>
  );
}
