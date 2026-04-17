import { useState, useRef, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { empresaService } from '../../services/empresaService'
import NotificationBell from '../NotificationBell/NotificationBell'
import './UserTopBarRight.css'

/**
 * Campana + avatar con dropdown — reutilizable en todas las páginas de usuario logueado.
 *
 * Props:
 *   empresaId — activa el modo empresa: muestra datos/acciones de empresa en el dropdown.
 *   empresa   — datos de empresa (nombre, logo). En HomeEmpresa se pasa el panel completo.
 *               Las notificaciones NO se leen de esta prop — siempre vienen de AuthContext.
 */
export default function UserTopBarRight({ empresaId, empresa: empresaProp } = {}) {
  const { user, logout, markNotifLeida, empresaNotifs, markEmpresaNotifLeida, addEmpresaNuevasNotifs, clearEmpresaNotifs, empresaPanel } = useAuth()
  const navigate = useNavigate()
  const [profileOpen, setProfileOpen] = useState(false)
  const profileRef = useRef(null)
  // Datos de empresa para mostrar avatar/nombre (sin notificaciones)
  const [empresaData, setEmpresaData] = useState(empresaProp ?? null)
  // Email de empresa — viene de getPerfil, que siempre lo tiene
  const [empresaEmail, setEmpresaEmail] = useState(empresaProp?.email ?? null)

  // Ref que siempre refleja el valor más reciente de empresaProp.
  const empresaPropRef = useRef(empresaProp)
  useEffect(() => { empresaPropRef.current = empresaProp }, [empresaProp])

  // Carga datos de empresa para el avatar cuando se provee empresaId pero no el prop empresa.
  // Si durante el fetch llega empresaProp, descarta el resultado para no sobreescribir.
  useEffect(() => {
    if (!empresaId || empresaProp) return
    empresaService.getPerfil(empresaId)
      .then((data) => {
        if (!empresaPropRef.current) setEmpresaData(data)
        setEmpresaEmail(data.email)
      })
      .catch(() => {})
  }, [empresaId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Cuando el prop viene sin email (ej. HomeEmpresa pasa el panel), fetchea solo el email
  useEffect(() => {
    if (!empresaId || !empresaProp || empresaProp.email) return
    empresaService.getPerfil(empresaId)
      .then((data) => setEmpresaEmail(data.email))
      .catch(() => {})
  }, [empresaId, empresaProp]) // eslint-disable-line react-hooks/exhaustive-deps

  // Mantiene sincronizados los datos del avatar si el prop cambia
  useEffect(() => {
    if (empresaProp) setEmpresaData(empresaProp)
    if (empresaProp?.email) setEmpresaEmail(empresaProp.email)
  }, [empresaProp])

  // Cierra el dropdown al hacer click fuera
  useEffect(() => {
    const handleOutside = (e) => {
      if (profileRef.current && !profileRef.current.contains(e.target)) {
        setProfileOpen(false)
      }
    }
    document.addEventListener('mousedown', handleOutside)
    return () => document.removeEventListener('mousedown', handleOutside)
  }, [])

  const handleLogout = async () => {
    setProfileOpen(false)
    await logout()
    navigate('/', { replace: true })
  }

  const inicialesUsuario = user
    ? `${user.nombre?.[0] ?? ''}${user.apellido?.[0] ?? ''}`.toUpperCase()
    : ''

  // Notificaciones y contexto para el bell.
  // Modo empresa: lee de empresaNotifs en AuthContext (persiste entre páginas de empresa).
  // Modo usuario: lee de user.notificaciones en AuthContext (persiste toda la sesión).
  const notifList    = empresaId
    ? (empresaNotifs?.notificaciones ?? [])
    : (user?.notificaciones?.notificaciones ?? [])
  const notifCursor  = empresaId
    ? (empresaNotifs?.ultimo_cursor_id ?? null)
    : (user?.notificaciones?.ultimo_cursor_id ?? null)
  const notifContext = empresaId
    ? { type: 'empresa', id: empresaId }
    : { type: 'usuario' }

  // Callback para actualizar la fuente de verdad cuando se marca una notificación como leída.
  const handleNotifLeida = useCallback((notifId) => {
    if (!empresaId) markNotifLeida(notifId)
    else            markEmpresaNotifLeida(notifId)
  }, [empresaId, markNotifLeida, markEmpresaNotifLeida])

  // Callback para cuando el polling de empresa encuentra notificaciones nuevas.
  const handleNuevasNotifs = useCallback((nuevas) => {
    if (empresaId) addEmpresaNuevasNotifs(nuevas)
  }, [empresaId, addEmpresaNuevasNotifs])

  return (
    <div className="utr">
      {/* ── Campana de notificaciones ── */}
      <NotificationBell
        notificaciones={notifList}
        ultimoCursorId={notifCursor}
        notifContext={notifContext}
        onNotifLeida={handleNotifLeida}
        onNuevasNotifs={handleNuevasNotifs}
        cantidadSucursales={empresaId ? (empresaPanel?.panel?.sucursales?.length ?? undefined) : undefined}
      />

      {/* ── Avatar + dropdown ── */}
      <div className="utr__profile" ref={profileRef}>
        <button
          className="utr__avatar"
          onClick={() => setProfileOpen((v) => !v)}
          aria-label={empresaId ? 'Menú de empresa' : 'Menú de usuario'}
          aria-expanded={profileOpen}
        >
          {empresaId ? (
            empresaData?.logo_url
              ? <img src={empresaData.logo_url} alt={empresaData.nombre} className="utr__avatar-logo" />
              : (empresaData?.nombre?.[0]?.toUpperCase() ?? '?')
          ) : (
            inicialesUsuario || '👤'
          )}
        </button>

        {profileOpen && (
          <div className="utr__dropdown" role="menu">

            {empresaId ? (
              <>
                {/* ── Cabecera empresa ── */}
                <div className="utr__dropdown-user">
                  <span className="utr__dropdown-name">{empresaData?.nombre ?? '…'}</span>
                  {empresaEmail && (
                    <span className="utr__dropdown-email">{empresaEmail}</span>
                  )}
                </div>

                {/* ── Acciones empresa ── */}
                <a className="utr__dropdown-item" role="menuitem"
                  href={`#/empresa/${empresaId}/crear-sucursal`}
                  onClick={(e) => { if (e.ctrlKey || e.metaKey || e.shiftKey || e.button !== 0) return; e.preventDefault(); setProfileOpen(false); navigate(`/empresa/${empresaId}/crear-sucursal`) }}>
                  🏗️ Crear sucursal
                </a>
                <a className="utr__dropdown-item" role="menuitem"
                  href={`#/empresa/${empresaId}/perfil`}
                  onClick={(e) => { if (e.ctrlKey || e.metaKey || e.shiftKey || e.button !== 0) return; e.preventDefault(); setProfileOpen(false); navigate(`/empresa/${empresaId}/perfil`) }}>
                  🏢 Perfil de empresa
                </a>
                {(empresaPanel?.panel?.sucursales?.length ?? 0) >= 2 && (
                  <a className="utr__dropdown-item" role="menuitem"
                    href={`#/empresa/${empresaId}/perfiles-sucursales`}
                    onClick={(e) => { if (e.ctrlKey || e.metaKey || e.shiftKey || e.button !== 0) return; e.preventDefault(); setProfileOpen(false); navigate(`/empresa/${empresaId}/perfiles-sucursales`) }}>
                    🏪 Perfiles de sucursales
                  </a>
                )}

                {/* ── Cabecera usuario (secundaria) ── */}
                {user && (
                  <div className="utr__dropdown-user utr__dropdown-user--secondary">
                    <span className="utr__dropdown-name">{user.nombre} {user.apellido}</span>
                    <span className="utr__dropdown-email">{user.email}</span>
                  </div>
                )}

                {/* ── Acciones usuario ── */}
                <a className="utr__dropdown-item utr__dropdown-item--divided" role="menuitem"
                  href="#/mis-empresas"
                  onClick={(e) => { if (e.ctrlKey || e.metaKey || e.shiftKey || e.button !== 0) return; e.preventDefault(); setProfileOpen(false); clearEmpresaNotifs(); navigate('/mis-empresas') }}>
                  🏠 Volver al menú de usuario
                </a>
              </>
            ) : (
              <>
                {/* ── Cabecera usuario ── */}
                {user && (
                  <div className="utr__dropdown-user">
                    <span className="utr__dropdown-name">{user.nombre} {user.apellido}</span>
                    <span className="utr__dropdown-email">{user.email}</span>
                  </div>
                )}

                {/* ── Acciones usuario ── */}
                <a className="utr__dropdown-item" role="menuitem"
                  href="#/crear-empresa"
                  onClick={(e) => { if (e.ctrlKey || e.metaKey || e.shiftKey || e.button !== 0) return; e.preventDefault(); setProfileOpen(false); navigate('/crear-empresa') }}>
                  🏢 Crear empresa
                </a>
                <a className="utr__dropdown-item utr__dropdown-item--divided" role="menuitem"
                  href="#/perfil"
                  onClick={(e) => { if (e.ctrlKey || e.metaKey || e.shiftKey || e.button !== 0) return; e.preventDefault(); setProfileOpen(false); navigate('/perfil') }}>
                  👤 Perfil
                </a>
              </>
            )}
            <button className="utr__dropdown-item utr__dropdown-item--danger" role="menuitem"
              onClick={handleLogout}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                <polyline points="16 17 21 12 16 7"/>
                <line x1="21" y1="12" x2="9" y2="12"/>
              </svg>
              Cerrar sesión
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
