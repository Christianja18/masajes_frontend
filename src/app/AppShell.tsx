import { useState, type ReactNode } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  LayoutDashboard,
  LogOut,
  Menu,
  Settings2,
  Users,
  WalletCards,
  ReceiptText,
  Gift,
  Clock3,
  Percent,
  X,
} from "lucide-react";
import { useAuth } from "../features/auth/AuthContext";
import { getUserRoleLabel, type UserRole } from "../types/domain";

const links = [
  {
    to: "/",
    label: "Resumen",
    icon: LayoutDashboard,
    roles: ["admin", "manager", "receptionist", "therapist"],
  },
  {
    to: "/reservas",
    label: "Reservas",
    icon: CalendarDays,
    roles: ["admin", "manager", "receptionist", "therapist"],
  },
  {
    to: "/clientes",
    label: "Clientes",
    icon: Users,
    roles: ["admin", "manager", "receptionist"],
  },
  {
    to: "/catalogo",
    label: "Servicios",
    icon: Settings2,
    roles: ["admin", "manager", "receptionist"],
  },
  {
    to: "/caja",
    label: "Caja y movilidad",
    icon: WalletCards,
    roles: ["admin", "manager", "receptionist"],
  },
  {
    to: "/ventas",
    label: "Ventas y pagos",
    icon: ReceiptText,
    roles: ["admin", "manager", "receptionist"],
  },
  {
    to: "/paquetes",
    label: "Paquetes",
    icon: Gift,
    roles: ["admin", "manager", "receptionist"],
  },
  {
    to: "/promociones",
    label: "Promociones",
    icon: Percent,
    roles: ["admin", "manager", "receptionist"],
  },
  {
    to: "/horarios",
    label: "Horarios",
    icon: Clock3,
    roles: ["admin", "manager", "receptionist"],
  },
  {
    to: "/usuarios",
    label: "Equipo",
    icon: Users,
    roles: ["admin", "manager"],
  },
];

export function AppShell({ children }: { children: ReactNode }) {
  const { profile, signOut } = useAuth();
  const visibleLinks = links.filter(({ roles }) =>
    roles.includes(profile?.role as UserRole),
  );
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  async function logout() {
    await signOut();
    navigate("/login");
  }
  return (
    <div className={`app-layout ${collapsed ? "sidebar-collapsed" : ""}`}>
      <aside className={`sidebar ${mobileOpen ? "mobile-open" : ""}`}>
        <div className="brand">
          <div className="brand-mark">M</div>
          <div className="brand-copy">
            <strong>Serena</strong>
            <span>Centro de masajes</span>
          </div>
          <button
            className="icon-button mobile-close"
            onClick={() => setMobileOpen(false)}
            aria-label="Cerrar menú"
          >
            <X size={20} />
          </button>
        </div>
        <nav className="main-nav" aria-label="Navegación principal">
          {visibleLinks.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              onClick={() => setMobileOpen(false)}
            >
              <Icon size={19} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="user-mini">
            <div className="avatar">
              {(profile?.full_name || "U").slice(0, 1).toUpperCase()}
            </div>
            <div>
              <strong>{profile?.full_name || "Usuario"}</strong>
              <span>{getUserRoleLabel(profile?.role)}</span>
            </div>
          </div>
          <button className="logout-button" onClick={() => void logout()}>
            <LogOut size={18} />
            <span>Cerrar sesión</span>
          </button>
        </div>
      </aside>
      <main className="main-content">
        <header className="topbar">
          <button
            className="icon-button mobile-menu"
            onClick={() => setMobileOpen(true)}
            aria-label="Abrir menú"
          >
            <Menu size={22} />
          </button>
          <button
            className="collapse-button icon-button"
            onClick={() => setCollapsed(!collapsed)}
            aria-label="Contraer menú"
          >
            {collapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
          </button>
          <div className="topbar-spacer" />
          <span className="role-pill">{getUserRoleLabel(profile?.role)}</span>
          <div className="avatar avatar-small">
            {(profile?.full_name || "U").slice(0, 1).toUpperCase()}
          </div>
        </header>
        <div className="page-container">{children}</div>
      </main>
    </div>
  );
}
