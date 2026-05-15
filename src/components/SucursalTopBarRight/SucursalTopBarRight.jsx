import { useState, useRef, useEffect, useCallback } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { sucursalService } from '../../services/sucursalService'
import NotificationBell from '../NotificationBell/NotificationBell'
import ConfirmModal from '../ConfirmModal/ConfirmModal'
import ErrorModal from '../ErrorModal/ErrorModal'
import './SucursalTopBarRight.css'

/**
 * Campana + avatar — versión para páginas de sucursal (GERENTE_SUCURSAL / EMPLEADO).
 * Lee sucursalNotifs de AuthContext igual que UserTopBarRight lee empresaNotifs.
 *
 * Props:
 *   sucursalId — id de la sucursal activa
 */
export default function SucursalTopBarRight({ sucursalId }) {
  const {
    user,
    logout,
    sucursalNotifs,
    markSucursalNotifLeida,
    clearEmpresaNotifs,
    sucursalPanel,
    setSucursalPanel,
    setSucursalNotifs,
  } = useAuth()
  const navigate    = useNavigate()
  const location    = useLocation()
  const [profileOpen,    setProfileOpen]    = useState(false)
  const [abandonarOpen,  setAbandonarOpen]  = useState(false)
  const [abandonLoading, setAbandonLoading] = useState(false)
  const [backError,      setBackError]      = useState(null)
  const profileRef  = useRef(null)

  // Datos del panel de sucursal
  const panel       = sucursalPanel?.sucursalId === String(sucursalId) ? sucursalPanel.panel : null
  const entidad     = panel?.cantidad_sucursales === 1 ? 'empresa' : 'sucursal'
  const emoji       = entidad === 'empresa' ? '🏢' : '🏪'
  const nombreDisplay = panel?.nombre_sucursal ?? 'Sucursal 1'
  const esEmpleado  = panel?.rol === 'EMPLEADO'

  // Si el panel no está en contexto, lo fetchea — excepto en /panel donde HomeSucursal ya lo hace
  const isHomeSucursal = location.pathname.endsWith('/panel')
  useEffect(() => {
    if (panel || !sucursalId || isHomeSucursal) return
    sucursalService.getSucursalPanel(sucursalId)
      .then((data) => {
        setSucursalPanel(sucursalId, data)
        setSucursalNotifs(sucursalId, data.notificaciones)
      })
      .catch(() => {})
  }, [sucursalId, panel, isHomeSucursal]) // eslint-disable-line react-hooks/exhaustive-deps

  // Email — fetcheado del perfil de sucursal
  const [email, setEmail] = useState(null)
  useEffect(() => {
    if (!sucursalId) return
    sucursalService.getPerfil(sucursalId)
      .then((data) => setEmail(data.email_sucursal ?? data.email_empresa ?? null))
      .catch(() => {})
  }, [sucursalId])

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

  const handleVolver = (e) => {
    if (e.ctrlKey || e.metaKey || e.shiftKey || e.button !== 0) return
    e.preventDefault()
    setProfileOpen(false)
    clearEmpresaNotifs()
    navigate('/mis-empresas')
  }

  const handleAbandonar = async () => {
    setAbandonLoading(true)
    try {
      await sucursalService.leaveSucursal(sucursalId)
      clearEmpresaNotifs()
      navigate('/mis-empresas')
    } catch (err) {
      setBackError(err)
      setAbandonarOpen(false)
    } finally {
      setAbandonLoading(false)
    }
  }

  // Notificaciones de sucursal
  const notifList   = sucursalNotifs?.notificaciones ?? []
  const notifCursor = sucursalNotifs?.ultimo_cursor_id ?? null

  const handleNotifLeida = useCallback((notifId) => {
    markSucursalNotifLeida(notifId)
  }, [markSucursalNotifLeida])

  return (
    <div className="utr">
      {/* ── Campana de notificaciones ── */}
      <NotificationBell
        notificaciones={notifList}
        ultimoCursorId={notifCursor}
        notifContext={{ type: 'sucursal', id: String(sucursalId) }}
        onNotifLeida={handleNotifLeida}
        cantidadSucursales={panel?.cantidad_sucursales}
      />

      {/* ── Avatar + dropdown ── */}
      <div className="utr__profile" ref={profileRef}>
        <button
          className="utr__avatar"
          onClick={() => setProfileOpen((v) => !v)}
          aria-label="Menú de sucursal"
          aria-expanded={profileOpen}
        >
          {panel?.logo_url
            ? <img src={panel.logo_url} alt={nombreDisplay} className="utr__avatar-logo" />
            : nombreDisplay[0].toUpperCase()
          }
        </button>

        {profileOpen && (
          <div className="utr__dropdown" role="menu">

            {/* ── Cabecera sucursal ── */}
            <div className="utr__dropdown-user">
              <span className="utr__dropdown-name">{nombreDisplay}</span>
              {email && (
                <span className="utr__dropdown-email">{email}</span>
              )}
            </div>

            {/* ── Perfil ── */}
            <a
              className="utr__dropdown-item"
              role="menuitem"
              href={`#/sucursal/${sucursalId}/perfil`}
              onClick={(e) => {
                if (e.ctrlKey || e.metaKey || e.shiftKey || e.button !== 0) return
                e.preventDefault()
                setProfileOpen(false)
                navigate(`/sucursal/${sucursalId}/perfil`)
              }}
            >
              {emoji} Perfil de {entidad}
            </a>

            {/* ── Abandonar empresa/sucursal (solo EMPLEADO) ── */}
            {esEmpleado && (
              <button
                className="utr__dropdown-item utr__dropdown-item--danger"
                role="menuitem"
                onClick={() => { setProfileOpen(false); setAbandonarOpen(true) }}
              >
                🚪 Abandonar {entidad}
              </button>
            )}

            {/* ── Cabecera usuario ── */}
            {user && (
              <div className="utr__dropdown-user utr__dropdown-user--secondary">
                <span className="utr__dropdown-name">{user.nombre} {user.apellido}</span>
                <span className="utr__dropdown-email">{user.email}</span>
              </div>
            )}

            {/* ── Volver a mis empresas ── */}
            <a
              className="utr__dropdown-item utr__dropdown-item--divided"
              role="menuitem"
              href="#/mis-empresas"
              onClick={handleVolver}
            >
              🏠 Volver al menú de usuario
            </a>

            {/* ── Cerrar sesión ── */}
            <button className="utr__dropdown-item utr__dropdown-item--danger" role="menuitem" onClick={handleLogout}>
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

      {abandonarOpen && (
        <ConfirmModal
          icon="🚪"
          message={`¿Confirmás que querés abandonar esta ${entidad}?`}
          confirmText="Abandonar"
          confirmVariant="btn-orange"
          loading={abandonLoading}
          onConfirm={handleAbandonar}
          onCancel={() => setAbandonarOpen(false)}
        />
      )}

      <ErrorModal error={backError} onClose={() => setBackError(null)} />
    </div>
  )
}
