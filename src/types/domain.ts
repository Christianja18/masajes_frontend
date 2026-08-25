export type UserRole = "admin" | "manager" | "receptionist" | "therapist";
export const userRoleLabels: Record<UserRole, string> = {
  admin: "Administrador",
  manager: "Gerente",
  receptionist: "Recepcionista",
  therapist: "Masajista",
};

export function getUserRoleLabel(role: UserRole | null | undefined) {
  return role ? userRoleLabels[role] : "Sin rol";
}
export type BookingStatus =
  | "pending"
  | "confirmed"
  | "in_progress"
  | "completed"
  | "cancelled"
  | "no_show";

export interface Profile {
  id: string;
  full_name: string;
  phone: string | null;
  role: UserRole;
  active: boolean;
}

export interface StaffProfile extends Profile {
  email: string | null;
}

export interface Booking {
  id: string;
  customer_id: string | null;
  therapist_id: string;
  service_id: string;
  customer_package_id: string | null;
  guest_name: string | null;
  guest_phone: string | null;
  starts_at: string;
  ends_at: string;
  status: BookingStatus;
  location_type: "on_site" | "customer_home";
  address: string | null;
  address_reference: string | null;
  customer: { full_name: string } | null;
  therapist: { full_name: string } | null;
  service: { name: string; duration_minutes: number; price: number } | null;
  customer_package: { package: { name: string } | null } | null;
}

export interface Service {
  id: string;
  name: string;
  duration_minutes: number;
  price: number;
  active: boolean;
}
export interface Therapist {
  id: string;
  full_name: string;
  phone: string | null;
  active: boolean;
}
export interface Customer {
  id: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  active: boolean;
}
export interface CashRegister {
  id: string;
  opening_amount: number;
  status: "open" | "closed";
  opened_at: string;
}
export interface CashMovement {
  id: string;
  movement_type: "income" | "expense";
  category: string;
  amount: number;
  description: string | null;
  created_at: string;
}
