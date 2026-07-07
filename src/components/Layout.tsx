import { type ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { puedeEscribir } from '../types';

export function Layout({ children }: { children: ReactNode }) {
  const { usuario, logout } = useAuth();
  if (!usuario) return null;

  const escritura = puedeEscribir(usuario);

  return (
    <div>
      <header
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '1rem 1.5rem',
          borderBottom: '1px solid var(--color-borde)',
        }}
      >
        <strong style={{ color: 'var(--color-primario)' }}>Registro de Difusiones</strong>
        <nav style={{ display: 'flex', gap: '1rem' }}>
          {escritura && <NavLink to="/carga">Cargar respuestas</NavLink>}
          <NavLink to="/consulta">Consultar</NavLink>
          {escritura && <NavLink to="/cierre">Cierre post-actividad</NavLink>}
          <NavLink to="/resumen">Resumen mensual</NavLink>
        </nav>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <span style={{ fontSize: '0.85rem', color: '#555' }}>{usuario.nombre}</span>
          <button className="secundario" onClick={logout}>Salir</button>
        </div>
      </header>
      <main style={{ padding: '1.5rem' }}>{children}</main>
    </div>
  );
}
