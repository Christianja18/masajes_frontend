/* eslint-disable react-refresh/only-export-components */
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { ChevronLeft, ChevronRight, LoaderCircle } from "lucide-react";

export function Button({
  children,
  loading,
  variant = "primary",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  loading?: boolean;
  variant?: "primary" | "secondary" | "ghost" | "danger";
}) {
  return (
    <button
      className={`button button-${variant}`}
      disabled={loading || props.disabled}
      {...props}
    >
      {loading && <LoaderCircle size={16} className="spin" />}
      {children}
    </button>
  );
}

export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <section className={`card ${className}`}>{children}</section>;
}

export function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "success" | "warning" | "danger" | "info";
}) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}

export function IconButton({
  label,
  children,
  variant = "ghost",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  label: string;
  variant?: "ghost" | "danger";
}) {
  return (
    <button
      className={`icon-action icon-action-${variant}`}
      aria-label={label}
      title={label}
      {...props}
    >
      {children}
    </button>
  );
}

export function Pagination({
  page,
  pageCount,
  onPageChange,
}: {
  page: number;
  pageCount: number;
  onPageChange: (page: number) => void;
}) {
  if (pageCount <= 0) return null;
  return (
    <nav className="pagination" aria-label="Paginación">
      <button
        className="icon-action"
        aria-label="Página anterior"
        disabled={page === 1}
        onClick={() => onPageChange(page - 1)}
      >
        <ChevronLeft size={16} />
      </button>
      <span>
        Página {page} de {pageCount}
      </span>
      <button
        className="icon-action"
        aria-label="Página siguiente"
        disabled={page === pageCount}
        onClick={() => onPageChange(page + 1)}
      >
        <ChevronRight size={16} />
      </button>
    </nav>
  );
}

export function EmptyState({ title, text }: { title: string; text: string }) {
  return (
    <div className="empty-state">
      <div className="empty-icon">○</div>
      <strong>{title}</strong>
      <span>{text}</span>
    </div>
  );
}

export function ErrorMessage({ message }: { message: string }) {
  return (
    <div className="error-box" role="alert">
      {message}
    </div>
  );
}

export function formatCurrency(value: number | string | null | undefined) {
  return new Intl.NumberFormat("es-PE", {
    style: "currency",
    currency: "PEN",
  }).format(Number(value ?? 0));
}
export function formatDate(value: string) {
  return new Intl.DateTimeFormat("es-PE", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Lima",
  }).format(new Date(value));
}
