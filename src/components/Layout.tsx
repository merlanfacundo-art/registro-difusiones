import { type ReactNode, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { puedeEscribir } from '../types';

export function Layout({ children }: { children: ReactNode }) {
  const { usuario, logout } = useAuth();
  const [menuAbierto, setMenuAbierto] = useState(false);
  if (!usuario) return null;

  const escritura = puedeEscribir(usuario);

  const links = (
    <>
      {escritura && <NavLink to="/actividades" onClick={() => setMenuAbierto(false)}>Nueva actividad</NavLink>}
      {escritura && <NavLink to="/carga" onClick={() => setMenuAbierto(false)}>Cargar respuestas</NavLink>}
      <NavLink to="/consulta" onClick={() => setMenuAbierto(false)}>Consultar</NavLink>
      {escritura && <NavLink to="/cierre" onClick={() => setMenuAbierto(false)}>Cierre post-actividad</NavLink>}
      <NavLink to="/resumen" onClick={() => setMenuAbierto(false)}>Resumen mensual</NavLink>
    </>
  );

  return (
    <div>
      <header className="app-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <strong style={{ color: 'var(--color-primario)' }}>Registro de Difusiones</strong>
          {/* Botón hamburguesa: solo visible en mobile vía CSS (.menu-toggle) */}
          <button
            className="secundario menu-toggle"
            onClick={() => setMenuAbierto((v) => !v)}
            aria-label="Abrir menú"
          >
            ☰
          </button>
          <div className="nav-desktop" style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <nav style={{ display: 'flex', gap: '1rem' }}>{links}</nav>
            <span style={{ fontSize: '0.85rem', color: '#555' }}>{usuario.nombre}</span>
            <button className="secundario" onClick={logout}>Salir</button>
          </div>
        </div>
        {/* Menú mobile: se despliega debajo del header cuando está abierto */}
        {menuAbierto && (
          <div className="nav-mobile">
            <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>{links}</nav>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.75rem' }}>
              <span style={{ fontSize: '0.85rem', color: '#555' }}>{usuario.nombre}</span>
              <button className="secundario" onClick={logout}>Salir</button>
            </div>
          </div>
        )}
      </header>
      <main style={{ padding: '1.5rem' }}>{children}</main>
    </div>
  );
}
