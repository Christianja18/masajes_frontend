import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  BrowserRouter,
  Navigate,
  Outlet,
  Route,
  Routes,
} from "react-router-dom";
import { AuthProvider, useAuth } from "./features/auth/AuthContext";
import { LoginPage } from "./features/auth/LoginPage";
import { AppShell } from "./app/AppShell";
import { DashboardPage } from "./features/dashboard/DashboardPage";
import { BookingsPage } from "./features/bookings/BookingsPage";
import { CatalogPage } from "./features/catalog/CatalogPage";
import { CustomersPage } from "./features/customers/CustomersPage";
import { CashPage } from "./features/cash/CashPage";
import { SalesPage } from "./features/sales/SalesPage";
import { PackagesPage } from "./features/packages/PackagesPage";
import { PromotionsPage } from "./features/promotions/PromotionsPage";
import { SchedulesPage } from "./features/schedules/SchedulesPage";
import { UsersPage } from "./features/users/UsersPage";
import { Button } from "./shared/ui";
import "./App.css";

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: 1 } },
});
function ProtectedLayout() {
  const { user, loading, profile, signOut } = useAuth();
  async function returnToLogin() {
    try {
      await signOut();
    } finally {
      window.location.replace("/login");
    }
  }
  if (loading)
    return <div className="screen-loading">Cargando tu espacio…</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (!profile)
    return (
      <div className="screen-loading">
        <strong>Perfil no configurado</strong>
        <span>Solicita al administrador crear tu perfil en Supabase.</span>
        <Button variant="secondary" onClick={() => void returnToLogin()}>
          Volver al login
        </Button>
      </div>
    );
  if (!profile.active)
    return (
      <div className="screen-loading">
        <strong>Acceso desactivado</strong>
        <span>Solicita al administrador que reactive tu cuenta.</span>
        <Button variant="secondary" onClick={() => void returnToLogin()}>
          Volver al login
        </Button>
      </div>
    );
  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}
export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route element={<ProtectedLayout />}>
              <Route index element={<DashboardPage />} />
              <Route path="reservas" element={<BookingsPage />} />
              <Route path="clientes" element={<CustomersPage />} />
              <Route path="catalogo" element={<CatalogPage />} />
              <Route path="caja" element={<CashPage />} />
              <Route path="ventas" element={<SalesPage />} />
              <Route path="paquetes" element={<PackagesPage />} />
              <Route path="promociones" element={<PromotionsPage />} />
              <Route path="horarios" element={<SchedulesPage />} />
              <Route path="usuarios" element={<UsersPage />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
