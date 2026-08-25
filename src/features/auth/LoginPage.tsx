import { useState, type FormEvent } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { Eye, EyeOff, Globe2, LockKeyhole, Mail, Sparkles } from "lucide-react";
import { useAuth } from "./AuthContext";
import { Button, ErrorMessage } from "../../shared/ui";
import { isSupabaseConfigured } from "../../lib/supabase";

export function LoginPage() {
  const { user, signIn, signInWithGoogle } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  if (user) return <Navigate to="/" replace />;
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      await signIn(email, password);
      navigate("/");
    } catch {
      setError(
        "Correo o contraseña incorrectos. Revisa tus datos e inténtalo otra vez.",
      );
    } finally {
      setLoading(false);
    }
  }
  async function continueWithGoogle() {
    setError("");
    setLoading(true);
    try {
      await signInWithGoogle();
    } catch {
      setError("No se pudo iniciar sesión con Google. Inténtalo otra vez.");
      setLoading(false);
    }
  }
  return (
    <main className="auth-page">
      <div className="auth-visual">
        <div className="auth-brand">
          <div className="brand-mark">M</div>
          <span>Serena</span>
        </div>
        <div className="auth-visual-content">
          <Sparkles size={22} />
          <h1>Un espacio más tranquilo para gestionar tu día.</h1>
          <p>Organiza reservas, caja y atención desde un solo lugar.</p>
        </div>
        <span className="auth-copyright">
          Gestión simple para centros de bienestar
        </span>
      </div>
      <section className="auth-panel">
        <div className="auth-form-wrap">
          <div className="mobile-auth-logo">
            <div className="brand-mark">M</div>
            <strong>Serena</strong>
          </div>
          <span className="eyebrow">PANEL DE GESTIÓN</span>
          <h2>Bienvenido de vuelta</h2>
          <p className="muted">Ingresa tus credenciales para continuar.</p>
          {!isSupabaseConfigured && (
            <ErrorMessage message="Configura VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY en .env" />
          )}
          {error && <ErrorMessage message={error} />}
          <form onSubmit={(event) => void submit(event)} className="auth-form">
            <label>
              Correo electrónico
              <div className="input-icon">
                <Mail size={18} />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="tu@centro.com"
                  autoComplete="email"
                />
              </div>
            </label>
            <label>
              Contraseña
              <div className="input-icon">
                <LockKeyhole size={18} />
                <input
                  type={show ? "text" : "password"}
                  required
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  className="input-action"
                  onClick={() => setShow(!show)}
                  aria-label={
                    show ? "Ocultar contraseña" : "Mostrar contraseña"
                  }
                >
                  {show ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </label>
            <div className="form-options">
              <label className="checkbox-label">
                <input type="checkbox" /> Recordarme
              </label>
              <button type="button" className="link-button">
                ¿Olvidaste tu contraseña?
              </button>
            </div>
            <Button
              type="submit"
              loading={loading}
              disabled={!isSupabaseConfigured}
            >
              Ingresar al panel
            </Button>
            <div className="auth-divider">
              <span>o continúa con</span>
            </div>
            <Button
              type="button"
              variant="secondary"
              onClick={() => void continueWithGoogle()}
              disabled={!isSupabaseConfigured || loading}
            >
              <Globe2 size={17} /> Continuar con Google
            </Button>
          </form>
        </div>
      </section>
    </main>
  );
}
