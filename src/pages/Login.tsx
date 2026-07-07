import { useState, type FormEvent } from 'react';
import { useAuth } from '../auth/AuthContext';

export function Login() {
  const { login, cargando, error } = useAuth();
  const [email, setEmail] = useState('');

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (email.trim()) login(email.trim());
  }

  return (
    <div style={{ display: 'flex', justifyContent: 'center', marginTop: '4rem' }}>
      <form onSubmit={handleSubmit} className="card" style={{ width: 360 }}>
        <h1 style={{ fontSize: '1.3rem', color: 'var(--color-primario)' }}>
          Registro de Difusiones
        </h1>
        <p style={{ color: '#555', fontSize: '0.9rem' }}>
          Ingresá con el email registrado en el equipo.
        </p>
        <input
          type="email"
          placeholder="tu email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={{ width: '100%', marginBottom: '0.75rem' }}
          required
        />
        {error && <p className="badge-acento" style={{ fontSize: '0.85rem' }}>{error}</p>}
        <button type="submit" disabled={cargando} style={{ width: '100%' }}>
          {cargando ? 'Verificando...' : 'Entrar'}
        </button>
      </form>
    </div>
  );
}
