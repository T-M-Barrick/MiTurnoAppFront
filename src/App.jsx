import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import { ThemeProvider } from './context/ThemeContext'
import { AuthProvider, useAuth } from './context/AuthContext'
import Login from './pages/Login/Login'
import Registro from './pages/Registro/Registro'
import HomeUsuario from './pages/HomeUsuario/HomeUsuario'
import CrearEmpresa from './pages/CrearEmpresa/CrearEmpresa'
import VerificarEmail from './pages/VerificarEmail/VerificarEmail'
import PerfilUsuario from './pages/PerfilUsuario/PerfilUsuario'
import MisEmpresas from './pages/MisEmpresas/MisEmpresas'
import HomeEmpresa from './pages/HomeEmpresa/HomeEmpresa'
import Servicios from './pages/Servicios/Servicios'
import PerfilEmpresa from './pages/PerfilEmpresa/PerfilEmpresa'
import PerfilSucursal from './pages/PerfilSucursal/PerfilSucursal'
import Favoritos from './pages/Favoritos/Favoritos'
import Historial from './pages/Historial/Historial'
import Notificaciones from './pages/Notificaciones/Notificaciones'
import TurnosSucursal from './pages/TurnosSucursal/TurnosSucursal'
import HistorialSucursal from './pages/HistorialSucursal/HistorialSucursal'
import Clientes from './pages/Clientes/Clientes'
import ClientesBloqueados from './pages/ClientesBloqueados/ClientesBloqueados'
import Miembros from './pages/Miembros/Miembros'
import OlvideContrasena from './pages/OlvideContrasena/OlvideContrasena'
import ResetearContrasena from './pages/ResetearContrasena/ResetearContrasena'
import AceptarInvitacion from './pages/AceptarInvitacion/AceptarInvitacion'
import CrearSucursal from './pages/CrearSucursal/CrearSucursal'
import PerfilesSucursales from './pages/PerfilesSucursales/PerfilesSucursales'
import HomeSucursal from './pages/HomeSucursal/HomeSucursal'
import MiembrosSucursal from './pages/MiembrosSucursal/MiembrosSucursal'
import PerfilSucursalGestion from './pages/PerfilSucursalGestion/PerfilSucursalGestion'

// Ruta protegida: redirige al login si no hay sesión activa
function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="loading-screen"><div className="spinner" /></div>
  return user ? children : <Navigate to="/" replace />
}

// Ruta pública: redirige al home si ya hay sesión activa
function PublicRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="loading-screen"><div className="spinner" /></div>
  return !user ? children : <Navigate to="/home" replace />
}

// HashRouter evita errores 404 al refrescar cuando se sirven archivos estáticos
export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <HashRouter>
          <Routes>
            <Route path="/" element={<PublicRoute><Login /></PublicRoute>} />
            <Route path="/registro" element={<PublicRoute><Registro /></PublicRoute>} />
            <Route path="/home" element={<ProtectedRoute><HomeUsuario /></ProtectedRoute>} />
            <Route path="/crear-empresa" element={<ProtectedRoute><CrearEmpresa /></ProtectedRoute>} />
            <Route path="/verificar-email" element={<VerificarEmail />} />
            <Route path="/aceptar-invitacion" element={<AceptarInvitacion />} />
            <Route path="/olvide-contrasena" element={<PublicRoute><OlvideContrasena /></PublicRoute>} />
            <Route path="/resetear-contrasena" element={<PublicRoute><ResetearContrasena /></PublicRoute>} />
            <Route path="/perfil" element={<ProtectedRoute><PerfilUsuario /></ProtectedRoute>} />
            <Route path="/mis-empresas" element={<ProtectedRoute><MisEmpresas /></ProtectedRoute>} />
            <Route path="/empresa/:id" element={<ProtectedRoute><HomeEmpresa /></ProtectedRoute>} />
            <Route path="/empresa/:id/servicios" element={<ProtectedRoute><Servicios /></ProtectedRoute>} />
            <Route path="/empresa/:id/perfil" element={<ProtectedRoute><PerfilEmpresa /></ProtectedRoute>} />
            <Route path="/sucursal/:id" element={<ProtectedRoute><PerfilSucursal /></ProtectedRoute>} />
            <Route path="/sucursal/:id/panel" element={<ProtectedRoute><HomeSucursal /></ProtectedRoute>} />
            <Route path="/sucursal/:id/turnos" element={<ProtectedRoute><TurnosSucursal /></ProtectedRoute>} />
            <Route path="/sucursal/:id/historial" element={<ProtectedRoute><HistorialSucursal /></ProtectedRoute>} />
            <Route path="/sucursal/:id/clientes" element={<ProtectedRoute><Clientes /></ProtectedRoute>} />
            <Route path="/sucursal/:id/clientes-bloqueados" element={<ProtectedRoute><ClientesBloqueados /></ProtectedRoute>} />
            <Route path="/sucursal/:id/servicios" element={<ProtectedRoute><Servicios /></ProtectedRoute>} />
            <Route path="/sucursal/:id/miembros" element={<ProtectedRoute><MiembrosSucursal /></ProtectedRoute>} />
            <Route path="/sucursal/:id/perfil" element={<ProtectedRoute><PerfilSucursalGestion /></ProtectedRoute>} />
            <Route path="/favoritos" element={<ProtectedRoute><Favoritos /></ProtectedRoute>} />
            <Route path="/historial" element={<ProtectedRoute><Historial /></ProtectedRoute>} />
            <Route path="/notificaciones" element={<ProtectedRoute><Notificaciones /></ProtectedRoute>} />
            <Route path="/empresa/:id/notificaciones" element={<ProtectedRoute><Notificaciones /></ProtectedRoute>} />
            <Route path="/sucursal/:id/notificaciones" element={<ProtectedRoute><Notificaciones /></ProtectedRoute>} />
            <Route path="/empresa/:id/turnos" element={<ProtectedRoute><TurnosSucursal /></ProtectedRoute>} />
            <Route path="/empresa/:id/historial" element={<ProtectedRoute><HistorialSucursal /></ProtectedRoute>} />
            <Route path="/empresa/:id/clientes" element={<ProtectedRoute><Clientes /></ProtectedRoute>} />
            <Route path="/empresa/:id/clientes-bloqueados" element={<ProtectedRoute><ClientesBloqueados /></ProtectedRoute>} />
            <Route path="/empresa/:id/miembros" element={<ProtectedRoute><Miembros /></ProtectedRoute>} />
            <Route path="/empresa/:id/crear-sucursal" element={<ProtectedRoute><CrearSucursal /></ProtectedRoute>} />
            <Route path="/empresa/:id/perfiles-sucursales" element={<ProtectedRoute><PerfilesSucursales /></ProtectedRoute>} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </HashRouter>
      </AuthProvider>
    </ThemeProvider>
  )
}
