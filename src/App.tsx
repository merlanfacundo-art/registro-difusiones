import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './auth/AuthContext';
import { Login } from './pages/Login';
import { Layout } from './components/Layout';
import { CargaRespuestas } from './components/CargaRespuestas';
import { AltaActividad } from './components/AltaActividad';
import { Cierre } from './components/Cierre';
import { Consulta } from './components/Consulta';
import { Proximamente } from './components/Proximamente';
import { puedeEscribir } from './types';

function Rutas() {
  const { usuario } = useAuth();

  if (!usuario) return <Login />;

  const escritura = puedeEscribir(usuario);
  // Ruta de entrada por defecto según el permiso: quien no puede cargar
  // (Responsable Política) arranca en Consulta, no en un formulario que no puede usar.
  const rutaPorDefecto = escritura ? '/carga' : '/consulta';

  return (
    <Layout>
      <Routes>
        <Route
          path="/carga"
          element={escritura ? <CargaRespuestas /> : <Navigate to="/consulta" replace />}
        />
        <Route
          path="/actividades"
          element={escritura ? <AltaActividad /> : <Navigate to="/consulta" replace />}
        />
        <Route path="/consulta" element={<Consulta />} />
        <Route
          path="/cierre"
          element={escritura ? <Cierre /> : <Navigate to="/consulta" replace />}
        />
        <Route path="/resumen" element={<Proximamente titulo="Resumen mensual (vista wide)" />} />
        <Route path="*" element={<Navigate to={rutaPorDefecto} replace />} />
      </Routes>
    </Layout>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Rutas />
      </AuthProvider>
    </BrowserRouter>
  );
}
