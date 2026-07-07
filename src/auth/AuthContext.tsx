import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import type { Usuario } from '../types';

interface AuthState {
  usuario: Usuario | null;
  cargando: boolean;
  error: string | null;
  login: (email: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

const STORAGE_KEY = 'registro-difusiones:usuario';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Restaura la sesión guardada al recargar la página, evitando
  // tener que loguearse de nuevo en cada visita.
  useEffect(() => {
    const guardado = localStorage.getItem(STORAGE_KEY);
    if (guardado) setUsuario(JSON.parse(guardado));
  }, []);

  async function login(email: string) {
    setCargando(true);
    setError(null);
    try {
      const res = await fetch(`/api/usuarios?email=${encodeURIComponent(email)}`);
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'No se pudo validar el email');
      }
      const data: Usuario = await res.json();
      setUsuario(data);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error desconocido');
    } finally {
      setCargando(false);
    }
  }

  function logout() {
    setUsuario(null);
    localStorage.removeItem(STORAGE_KEY);
  }

  return (
    <AuthContext.Provider value={{ usuario, cargando, error, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider');
  return ctx;
}
