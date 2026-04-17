import { useState } from 'react'
import { useLocation, useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { empresaService } from '../../services/empresaService'
import { sucursalService } from '../../services/sucursalService'
import { usuarioService } from '../../services/usuarioService'
import { getNotifTitle, getNotifBody, getNotifIcon, formatNotifTime } from '../../utils/notifUtils'
import AppTopBar from '../../components/AppTopBar/AppTopBar'
import UserTopBarRight from '../../components/UserTopBarRight/UserTopBarRight'
import ErrorModal from '../../components/ErrorModal/ErrorModal'
import CustomSelect from '../../components/CustomSelect/CustomSelect'
import './Notificaciones.css'

// Opciones de cantidad para cargar más (máx 100 por llamada según el back)
const LIMIT_OPTIONS = [20, 50, 100]

/**
 * Página completa de notificaciones.
 *
 * Rutas:
 *   /notificaciones               → contexto de usuario
 *   /empresa/:id/notificaciones   → contexto de empresa o sucursal
 *
 * Al abrir, muestra las notificaciones que ya están en sesión (pasadas por
 * navigation state desde el dropdown "Ver todas"). NO hace un GET automático al montar.
 * El botón "Cargar más" hace el GET al back con cursor para obtener notificaciones más antiguas.
 */
export default function Notificaciones() {
  const location = useLocation()
  const params   = useParams()
  const navigate = useNavigate()
  const { markNotifLeida, markEmpresaNotifLeida, empresaPanel } = useAuth()

  // Determina el contexto desde el state de navegación o desde la URL
  const stateContext = location.state?.notifContext
  const notifContext = stateContext ?? (
    params.id
      ? { type: 'empresa', id: params.id }
      : { type: 'usuario' }
  )

  // Datos iniciales desde el estado de navegación (pasados por el dropdown)
  const initialNotifs  = location.state?.notificaciones ?? []
  const initialCursor  = location.state?.ultimoCursorId  ?? null

  // Nunca hace GET al montar — solo muestra lo que está en sesión
  const [notificaciones, setNotificaciones] = useState(initialNotifs)
  const [ultimoCursorId, setUltimoCursorId] = useState(initialCursor)
  const [loadingMore, setLoadingMore]       = useState(false)
  const [limiteMas, setLimiteMas]           = useState(20)
  const [backError, setBackError]           = useState(null)
  // Hay más si el cursor inicial no es null (el back devolvió el máximo de items)
  const [hayMas, setHayMas]                 = useState(initialCursor !== null)

  // Llama al endpoint correcto según el contexto para obtener más notificaciones antiguas
  const handleCargarMas = async () => {
    if (!ultimoCursorId) return
    setLoadingMore(true)
    try {
      const { type, id } = notifContext
      let result

      if (type === 'usuario') {
        result = await usuarioService.getNotificaciones({
          idUltimo: ultimoCursorId,
          limite:   limiteMas,
        })
      } else if (type === 'empresa') {
        result = await empresaService.getNotificaciones(id, {
          idUltimo: ultimoCursorId,
          limite:   limiteMas,
        })
      } else if (type === 'sucursal') {
        result = await sucursalService.getNotificaciones(id, {
          idUltimo: ultimoCursorId,
          limite:   limiteMas,
        })
      }

      const nuevas  = result?.notificaciones ?? []
      const cursor2 = result?.ultimo_cursor_id ?? null

      // Filtra por tipo en contexto usuario
      setNotificaciones((prev) => [...prev, ...nuevas])
      setUltimoCursorId(cursor2)
      // Si el back devolvió menos items que el límite, no hay más
      setHayMas(!!cursor2 && nuevas.length >= limiteMas)
    } catch (err) {
      setBackError(err)
    } finally {
      setLoadingMore(false)
    }
  }

  // Marca como leída en el back y actualiza el estado local (optimista).
  // En modo usuario también actualiza el AuthContext para que la campana
  // en la topbar refleje el cambio sin esperar un re-render del padre.
  const handleMarkLeida = async (notif) => {
    if (notif.leida) return
    setNotificaciones((prev) =>
      prev.map((n) => (n.id === notif.id ? { ...n, leida: true } : n))
    )
    try {
      const { type, id } = notifContext
      if (type === 'usuario')       await usuarioService.markNotificacionLeida(notif.id)
      else if (type === 'empresa')  await empresaService.markNotificacionLeida(id, notif.id)
      else if (type === 'sucursal') await sucursalService.markNotificacionLeida(id, notif.id)
      // Sincroniza la fuente de verdad en AuthContext para que la campana refleje el cambio
      if (notifContext.type === 'usuario')        markNotifLeida(notif.id)
      else if (notifContext.type === 'empresa' ||
               notifContext.type === 'sucursal')  markEmpresaNotifLeida(notif.id)
    } catch {
      setNotificaciones((prev) =>
        prev.map((n) => (n.id === notif.id ? { ...n, leida: false } : n))
      )
    }
  }

  // Click en item: marcar leída y navegar al turno o miembro correspondiente.
  // Si el ítem ya no existe en el destino, la página simplemente no abre nada.
  const handleNotifClick = async (notif) => {
    await handleMarkLeida(notif)
    const turnoId   = notif.extra_data?.turno_id
    const usuarioId = notif.extra_data?.usuario_id
    const tipo      = notif.tipo
    const { type, id } = notifContext

    // Notificaciones de turno
    if (turnoId) {
      if (type === 'usuario')       navigate('/home',                 { state: { openTurnoId: turnoId } })
      else if (type === 'empresa')  navigate(`/empresa/${id}/turnos`, { state: { openTurnoId: turnoId } })
      else if (type === 'sucursal') navigate(`/sucursal/${id}`,       { state: { openTurnoId: turnoId } })
      return
    }

    // Notificaciones de miembro
    if (usuarioId && (tipo === 'MIEMBRO_NUEVO_EMPRESA' || tipo === 'MIEMBRO_NUEVO_SUCURSAL')) {
      if (type === 'empresa') navigate(`/empresa/${id}/miembros`, { state: { openUsuarioId: usuarioId } })
    }
  }

  // Botón de volver según el contexto
  const handleBack = () => {
    const { type, id } = notifContext
    if (type === 'empresa' || type === 'sucursal') navigate(`/empresa/${id}`)
    else navigate('/home')
  }

  const backBtn = (
    <button
      className="app-topbar__icon-btn"
      onClick={handleBack}
      aria-label="Volver"
    >
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white"
        strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <polyline points="15 18 9 12 15 6"/>
      </svg>
    </button>
  )

  const unreadCount = notificaciones.filter((n) => !n.leida).length
  const { type: ctxType, id: ctxId } = notifContext

  // Cantidad de sucursales del panel de empresa — para mapear el rol de GERENTE_EMPRESA correctamente
  const cantidadSucursales = empresaPanel?.panel?.sucursales?.length ?? undefined

  return (
    <div className="notif-page">

      {/* ═══ TOPBAR ═══ */}
      <AppTopBar
        left={backBtn}
        right={
          ctxType === 'empresa' || ctxType === 'sucursal'
            ? <UserTopBarRight empresaId={ctxId} />
            : <UserTopBarRight />
        }
      />

      {/* ═══ CONTENIDO SCROLLABLE ═══ */}
      <main className="notif-page__main">
        <div className="notif-page__inner">

          {/* Cabecera */}
          <div className="notif-page__header">
            <h1 className="notif-page__title">🔔 Notificaciones</h1>
            {unreadCount > 0 && (
              <span className="notif-page__badge">{unreadCount} sin leer</span>
            )}
          </div>

          {/* Sin notificaciones */}
          {notificaciones.length === 0 && (
            <div className="empty-state">
              <div className="empty-state-icon">🔔</div>
              <h3>Sin notificaciones</h3>
              <p>No tenés notificaciones en esta sesión.</p>
            </div>
          )}

          {/* Lista */}
          {notificaciones.length > 0 && (
            <ul className="notif-list" role="list">
              {notificaciones.map((notif) => (
                <li
                  key={notif.id}
                  className={`notif-item${notif.leida ? ' notif-item--read' : ''}`}
                >
                  <button
                    className="notif-item__btn"
                    onClick={() => handleNotifClick(notif)}
                  >
                    {/* Indicador de no leída */}
                    <span className="notif-item__dot-col">
                      {!notif.leida && <span className="notif-item__dot" />}
                    </span>

                    {/* Ícono */}
                    <span className="notif-item__icon" aria-hidden="true">
                      {getNotifIcon(notif.tipo)}
                    </span>

                    {/* Contenido */}
                    <span className="notif-item__content">
                      <span className="notif-item__head">
                        <span className="notif-item__title">
                          {getNotifTitle(notif.tipo)}
                        </span>
                        <span className="notif-item__time">
                          {formatNotifTime(notif.created_at)}
                        </span>
                      </span>
                      <p className="notif-item__body">
                        {getNotifBody(notif.tipo, notif.extra_data, cantidadSucursales)}
                      </p>
                    </span>
                  </button>

                  {/* Botón de marcar como leída (check) */}
                  {!notif.leida && (
                    <button
                      className="notif-item__mark-btn"
                      onClick={() => handleMarkLeida(notif)}
                      title="Marcar como leída"
                      aria-label="Marcar como leída"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                        stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
                        strokeLinejoin="round" aria-hidden="true">
                        <polyline points="20 6 9 17 4 12"/>
                      </svg>
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}

          {/* Cargar más — solo si hay cursor disponible */}
          {notificaciones.length > 0 && hayMas && (
            <div className="notif-page__load-more">
              <div className="notif-page__load-select-wrap">
                <CustomSelect
                  options={LIMIT_OPTIONS.map((opt) => ({ value: String(opt), label: String(opt) }))}
                  value={String(limiteMas)}
                  onChange={(val) => setLimiteMas(Number(val))}
                  width={55}
                  height={39}
                  disabled={loadingMore}
                />
              </div>
              <button
                className="btn notif-page__load-btn"
                onClick={handleCargarMas}
                disabled={loadingMore || !ultimoCursorId}
              >
                {loadingMore
                  ? <><span className="spinner spinner-sm" /> Cargando…</>
                  : 'Cargar más'
                }
              </button>
            </div>
          )}

        </div>
      </main>

      <ErrorModal error={backError} onClose={() => setBackError(null)} />
    </div>
  )
}
