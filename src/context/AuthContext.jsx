import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { authService } from '../services/authService'
import { usuarioService } from '../services/usuarioService'
import { empresaService } from '../services/empresaService'
import { sucursalService } from '../services/sucursalService'
import { setAuthErrorHandler } from '../services/api'

const AuthContext = createContext()

const SESSION_KEY          = 'miturno_user'
const EMPRESA_NOTIF_KEY    = 'miturno_empresa_notifs'
const EMPRESA_PANEL_KEY    = 'miturno_empresa_panel'
const SUCURSAL_PANEL_KEY   = 'miturno_sucursal_panel'
const SUCURSAL_NOTIF_KEY   = 'miturno_sucursal_notifs'
const POLL_INTERVAL       = 5 * 60 * 1000 // 5 minutos

/**
 * Mergea dos listas de notificaciones.
 * - Las notificaciones de `incoming` son fuente de verdad para los IDs que contienen
 *   (permite que el estado `leida` se actualice cuando viene del back).
 * - Las notificaciones de `existing` que NO están en `incoming` se preservan
 *   (para no perder las acumuladas por polling).
 * El resultado queda ordenado por id descendente (más reciente primero).
 */
function mergeNotificaciones(existing, incoming) {
  if (!incoming || incoming.length === 0) return existing ?? []
  const incomingMap = new Map(incoming.map((n) => [n.id, n]))
  const soloExisting = (existing ?? []).filter((n) => !incomingMap.has(n.id))
  return [...incoming, ...soloExisting].sort((a, b) => b.id - a.id)
}

export function AuthProvider({ children }) {
  const [user,    setUser]    = useState(null)
  const [loading, setLoading] = useState(true)

  // ── Notificaciones de usuario ──────────────────────────────────────────────
  // Ref que permite al polling leer siempre el valor más reciente sin recrear el intervalo.
  const userNotifsRef = useRef(null)

  // ── Panel de empresa ───────────────────────────────────────────────────────
  // Guarda la respuesta de getPanel() para que todas las páginas de empresa
  // conozcan el # de sucursales, rol propio, etc. sin volver a fetchear.
  // Estructura: { empresaId: string, panel: { sucursales, rol, nombre, ... } }
  const [empresaPanel, setEmpresaPanelState] = useState(() => {
    try {
      const cached = sessionStorage.getItem(EMPRESA_PANEL_KEY)
      return cached ? JSON.parse(cached) : null
    } catch { return null }
  })

  // Panel de sucursal para GERENTE_SUCURSAL/EMPLEADO (SucursalHomeOut)
  // Estructura: { sucursalId: string, panel: { cantidad_sucursales, ... } }
  const [sucursalPanel, setSucursalPanelState] = useState(() => {
    try {
      const cached = sessionStorage.getItem(SUCURSAL_PANEL_KEY)
      return cached ? JSON.parse(cached) : null
    } catch { return null }
  })

  // ── Notificaciones de empresa ──────────────────────────────────────────────
  // Estructura: { empresaId, notificaciones: [...], ultimo_cursor_id }
  const [empresaNotifs, setEmpresaNotifsState] = useState(() => {
    try {
      const cached = sessionStorage.getItem(EMPRESA_NOTIF_KEY)
      return cached ? JSON.parse(cached) : null
    } catch { return null }
  })
  const empresaNotifsRef = useRef(empresaNotifs)

  useEffect(() => {
    empresaNotifsRef.current = empresaNotifs
  }, [empresaNotifs])

  // ── Notificaciones de sucursal ─────────────────────────────────────────────
  // Estructura: { sucursalId, notificaciones: [...], ultimo_cursor_id }
  const [sucursalNotifs, setSucursalNotifsState] = useState(() => {
    try {
      const cached = sessionStorage.getItem(SUCURSAL_NOTIF_KEY)
      return cached ? JSON.parse(cached) : null
    } catch { return null }
  })
  const sucursalNotifsRef = useRef(sucursalNotifs)

  useEffect(() => {
    sucursalNotifsRef.current = sucursalNotifs
  }, [sucursalNotifs])

  // Registra el handler global de AUTH_ERROR: limpia sesión.
  useEffect(() => {
    setAuthErrorHandler(() => {
      setUser(null)
      userNotifsRef.current = null
      sessionStorage.removeItem(SESSION_KEY)
      sessionStorage.removeItem(EMPRESA_NOTIF_KEY)
    })
  }, [])

  // Al montar, intenta restaurar la sesión.
  // Las notificaciones del /me se mergean con las del cache para no perder las acumuladas.
  useEffect(() => {
    const restore = async () => {
      const cached = sessionStorage.getItem(SESSION_KEY)
      if (cached) {
        try {
          const parsed = JSON.parse(cached)
          setUser(parsed)
          userNotifsRef.current = parsed?.notificaciones?.notificaciones ?? null
        } catch { /* ignorar caché corrupta */ }
      }

      try {
        const userData = await usuarioService.getMe()
        if (userData) {
          const incomingNotifs = userData?.notificaciones?.notificaciones ?? []
          const existingNotifs = userNotifsRef.current ?? []
          const merged = mergeNotificaciones(existingNotifs, incomingNotifs)
          const updated = {
            ...userData,
            notificaciones: { ...userData.notificaciones, notificaciones: merged },
          }
          setUser(updated)
          userNotifsRef.current = merged
          sessionStorage.setItem(SESSION_KEY, JSON.stringify(updated))
        } else {
          setUser(null)
          userNotifsRef.current = null
          sessionStorage.removeItem(SESSION_KEY)
        }
      } catch {
        setUser(null)
        userNotifsRef.current = null
        sessionStorage.removeItem(SESSION_KEY)
      } finally {
        setLoading(false)
      }
    }
    restore()
  }, [])

  // Polling de notificaciones de usuario cada 5 minutos.
  // Corre durante toda la sesión. Usa /nuevas?id_posterior=X (array directo).
  // id_posterior es requerido por el back — se saltea si no hay notificaciones cargadas.
  useEffect(() => {
    const poll = setInterval(async () => {
      if (!userNotifsRef.current) return
      const topId = userNotifsRef.current[0]?.id ?? null
      if (!topId) return
      try {
        const nuevas = await usuarioService.getNotificacionesNuevas(topId)
        if (!nuevas || nuevas.length === 0) return

        setUser((prev) => {
          if (!prev) return prev
          const prevList = prev.notificaciones?.notificaciones ?? []
          const merged   = [...nuevas, ...prevList]
          const updated  = {
            ...prev,
            notificaciones: { ...prev.notificaciones, notificaciones: merged },
          }
          userNotifsRef.current = merged
          sessionStorage.setItem(SESSION_KEY, JSON.stringify(updated))
          return updated
        })
      } catch { /* polling silencioso */ }
    }, POLL_INTERVAL)

    return () => clearInterval(poll)
  }, [])

  // Polling de notificaciones de empresa cada 5 minutos.
  // Solo actúa si hay una sesión de empresa activa (empresaNotifsRef.current !== null).
  // Cuando el usuario vuelve a modo usuario, clearEmpresaNotifs() pone la ref en null
  // y el polling queda inactivo automáticamente sin necesidad de recrear el intervalo.
  useEffect(() => {
    const poll = setInterval(async () => {
      const current = empresaNotifsRef.current
      if (!current) return // no hay sesión de empresa activa
      const topId = current.notificaciones?.[0]?.id ?? null
      if (!topId) return // id_posterior es requerido por el back
      try {
        const { empresaId } = current
        const nuevas = await empresaService.getNotificacionesNuevas(empresaId, topId)
        if (!nuevas || nuevas.length === 0) return

        setEmpresaNotifsState((prev) => {
          if (!prev) return prev
          const merged  = [...nuevas, ...(prev.notificaciones ?? [])]
          const updated = { ...prev, notificaciones: merged }
          empresaNotifsRef.current = updated
          sessionStorage.setItem(EMPRESA_NOTIF_KEY, JSON.stringify(updated))
          return updated
        })
      } catch { /* polling silencioso */ }
    }, POLL_INTERVAL)

    return () => clearInterval(poll)
  }, [])

  // Polling de notificaciones de sucursal cada 5 minutos (GERENTE_SUCURSAL/EMPLEADO).
  useEffect(() => {
    const poll = setInterval(async () => {
      const current = sucursalNotifsRef.current
      if (!current) return
      const topId = current.notificaciones?.[0]?.id ?? null
      if (!topId) return
      try {
        const { sucursalId } = current
        const nuevas = await sucursalService.getNotificacionesNuevas(sucursalId, topId)
        if (!nuevas || nuevas.length === 0) return

        setSucursalNotifsState((prev) => {
          if (!prev) return prev
          const merged  = [...nuevas, ...(prev.notificaciones ?? [])]
          const updated = { ...prev, notificaciones: merged }
          sucursalNotifsRef.current = updated
          sessionStorage.setItem(SUCURSAL_NOTIF_KEY, JSON.stringify(updated))
          return updated
        })
      } catch { /* polling silencioso */ }
    }, POLL_INTERVAL)

    return () => clearInterval(poll)
  }, [])

  // Login: POST /auth/login → luego GET /usuarios/me
  const login = async (email, password) => {
    await authService.login(email, password)
    const userData = await usuarioService.getMe()
    setUser(userData)
    userNotifsRef.current = userData?.notificaciones?.notificaciones ?? null
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(userData))
    return userData
  }

  // Logout: limpia sesión de usuario, empresa y sucursal
  const logout = async () => {
    try { await authService.logout() } catch { /* ignorar error de red */ }
    setUser(null)
    userNotifsRef.current = null
    sessionStorage.removeItem(SESSION_KEY)
    setEmpresaNotifsState(null)
    empresaNotifsRef.current = null
    sessionStorage.removeItem(EMPRESA_NOTIF_KEY)
    setEmpresaPanelState(null)
    sessionStorage.removeItem(EMPRESA_PANEL_KEY)
    setSucursalPanelState(null)
    sessionStorage.removeItem(SUCURSAL_PANEL_KEY)
    setSucursalNotifsState(null)
    sucursalNotifsRef.current = null
    sessionStorage.removeItem(SUCURSAL_NOTIF_KEY)
  }

  // Actualiza el usuario en estado y sessionStorage.
  // Si newData contiene notificaciones (ej: viene de un /me fresco), las mergea
  // para no perder las acumuladas por polling.
  const updateUser = (newData) => {
    setUser((prev) => {
      const incomingNotifs = newData?.notificaciones?.notificaciones ?? null
      let notificaciones   = prev?.notificaciones

      if (incomingNotifs !== null) {
        const existingNotifs = prev?.notificaciones?.notificaciones ?? []
        const merged = mergeNotificaciones(existingNotifs, incomingNotifs)
        notificaciones = {
          ...prev?.notificaciones,
          ...newData.notificaciones,
          notificaciones: merged,
        }
      }

      const updated = { ...prev, ...newData, notificaciones }
      userNotifsRef.current = updated?.notificaciones?.notificaciones ?? null
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(updated))
      return updated
    })
  }

  // Marca una notificación de usuario como leída en estado y sessionStorage.
  const markNotifLeida = (notifId) => {
    setUser((prev) => {
      if (!prev) return prev
      const lista = prev.notificaciones?.notificaciones ?? []
      if (!lista.find((n) => n.id === notifId && !n.leida)) return prev
      const updated = {
        ...prev,
        notificaciones: {
          ...prev.notificaciones,
          notificaciones: lista.map((n) => (n.id === notifId ? { ...n, leida: true } : n)),
        },
      }
      userNotifsRef.current = updated.notificaciones.notificaciones
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(updated))
      return updated
    })
  }

  // ── Funciones para el modo empresa ────────────────────────────────────────

  // Guarda el panel de sucursal al entrar al home de sucursal (GERENTE_SUCURSAL/EMPLEADO).
  const setSucursalPanel = (sucursalId, panelData) => {
    const data = { sucursalId: String(sucursalId), panel: panelData }
    setSucursalPanelState(data)
    sessionStorage.setItem(SUCURSAL_PANEL_KEY, JSON.stringify(data))
  }

  // Guarda el panel completo de la empresa al entrar al home (o al fetchear).
  // El panel incluye sucursales, rol propio, nombre, etc.
  const setEmpresaPanel = (empresaId, panelData) => {
    const data = { empresaId: String(empresaId), panel: panelData }
    setEmpresaPanelState(data)
    sessionStorage.setItem(EMPRESA_PANEL_KEY, JSON.stringify(data))
  }

  // Guarda las notificaciones de empresa al entrar al home de empresa.
  // Si ya había notificaciones de la misma empresa (ej: polling acumuló algo),
  // las mergea para no perderlas.
  const setEmpresaNotifs = (empresaId, notificacionesOut) => {
    const incoming = notificacionesOut?.notificaciones ?? []
    const existing = empresaNotifsRef.current?.empresaId === String(empresaId)
      ? empresaNotifsRef.current?.notificaciones ?? []
      : []
    const merged = mergeNotificaciones(existing, incoming)
    const data = {
      empresaId: String(empresaId),
      notificaciones: merged,
      ultimo_cursor_id: notificacionesOut?.ultimo_cursor_id ?? null,
    }
    setEmpresaNotifsState(data)
    empresaNotifsRef.current = data
    sessionStorage.setItem(EMPRESA_NOTIF_KEY, JSON.stringify(data))
  }

  // Marca una notificación de empresa como leída en estado y sessionStorage.
  const markEmpresaNotifLeida = (notifId) => {
    setEmpresaNotifsState((prev) => {
      if (!prev) return prev
      const lista = prev.notificaciones ?? []
      if (!lista.find((n) => n.id === notifId && !n.leida)) return prev
      const updated = {
        ...prev,
        notificaciones: lista.map((n) => (n.id === notifId ? { ...n, leida: true } : n)),
      }
      empresaNotifsRef.current = updated
      sessionStorage.setItem(EMPRESA_NOTIF_KEY, JSON.stringify(updated))
      return updated
    })
  }

  // Agrega notificaciones nuevas llegadas por polling de empresa al estado.
  const addEmpresaNuevasNotifs = (nuevas) => {
    if (!nuevas || nuevas.length === 0) return
    setEmpresaNotifsState((prev) => {
      if (!prev) return prev
      const merged = [...nuevas, ...(prev.notificaciones ?? [])]
      const updated = { ...prev, notificaciones: merged }
      empresaNotifsRef.current = updated
      sessionStorage.setItem(EMPRESA_NOTIF_KEY, JSON.stringify(updated))
      return updated
    })
  }

  // Guarda las notificaciones de sucursal al entrar al home de sucursal.
  const setSucursalNotifs = (sucursalId, notificacionesOut) => {
    const incoming = notificacionesOut?.notificaciones ?? []
    const existing = sucursalNotifsRef.current?.sucursalId === String(sucursalId)
      ? sucursalNotifsRef.current?.notificaciones ?? []
      : []
    const merged = mergeNotificaciones(existing, incoming)
    const data = {
      sucursalId: String(sucursalId),
      notificaciones: merged,
      ultimo_cursor_id: notificacionesOut?.ultimo_cursor_id ?? null,
    }
    setSucursalNotifsState(data)
    sucursalNotifsRef.current = data
    sessionStorage.setItem(SUCURSAL_NOTIF_KEY, JSON.stringify(data))
  }

  // Marca una notificación de sucursal como leída en estado y sessionStorage.
  const markSucursalNotifLeida = (notifId) => {
    setSucursalNotifsState((prev) => {
      if (!prev) return prev
      const lista = prev.notificaciones ?? []
      if (!lista.find((n) => n.id === notifId && !n.leida)) return prev
      const updated = {
        ...prev,
        notificaciones: lista.map((n) => (n.id === notifId ? { ...n, leida: true } : n)),
      }
      sucursalNotifsRef.current = updated
      sessionStorage.setItem(SUCURSAL_NOTIF_KEY, JSON.stringify(updated))
      return updated
    })
  }

  // Descarta la sesión de empresa completa (notificaciones + panel) al salir.
  const clearEmpresaNotifs = () => {
    setEmpresaNotifsState(null)
    empresaNotifsRef.current = null
    sessionStorage.removeItem(EMPRESA_NOTIF_KEY)
    setEmpresaPanelState(null)
    sessionStorage.removeItem(EMPRESA_PANEL_KEY)
    setSucursalPanelState(null)
    sessionStorage.removeItem(SUCURSAL_PANEL_KEY)
    setSucursalNotifsState(null)
    sucursalNotifsRef.current = null
    sessionStorage.removeItem(SUCURSAL_NOTIF_KEY)
  }

  // Cantidad de sucursales activas de la empresa actual.
  // GERENTE_SUCURSAL/EMPLEADO: viene de sucursalPanel (SucursalHomeOut.cantidad_sucursales).
  // PROPIETARIO/GERENTE_EMPRESA: se cuenta desde empresaPanel.sucursales filtrando las activas.
  // null si no hay sesión de empresa activa.
  const cantidadSucursales = sucursalPanel?.panel?.cantidad_sucursales
    ?? (empresaPanel?.panel?.sucursales
      ? empresaPanel.panel.sucursales.filter(s => s.activa !== false).length
      : null)

  return (
    <AuthContext.Provider value={{
      user, loading, login, logout, updateUser, setUser,
      markNotifLeida,
      empresaNotifs, setEmpresaNotifs, markEmpresaNotifLeida,
      addEmpresaNuevasNotifs, clearEmpresaNotifs,
      empresaNotifsRef,
      empresaPanel, setEmpresaPanel,
      sucursalPanel, setSucursalPanel,
      sucursalNotifs, setSucursalNotifs, markSucursalNotifLeida,
      sucursalNotifsRef,
      cantidadSucursales,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
