import { api } from './api'

export const usuarioService = {
  // GET /usuarios/me → retorna UserLoginOut
  getMe: () =>
    api.get('/usuarios/me'),

  // POST /usuarios/ → registro de nuevo usuario
  register: (data) =>
    api.post('/usuarios/', data),

  // GET /usuarios/turnos/estados → lista de {id, estado} cada 5 minutos
  getEstadosTurnos: () =>
    api.get('/usuarios/turnos/estados'),

  // PATCH /usuarios/turnos/{id}/estado → cambia el estado de un turno
  updateEstadoTurno: (turnoId, data) =>
    api.patch(`/usuarios/turnos/${turnoId}/estado`, data),

  // PATCH /usuarios/turnos/{id}/recordatorio → cambia el recordatorio
  updateRecordatorioTurno: (turnoId, minutosAntes) =>
    api.patch(`/usuarios/turnos/${turnoId}/recordatorio`, { minutos_antes: minutosAntes }),

  // DELETE /usuarios/turnos/{id} → elimina un turno (solo estados terminales)
  deleteTurno: (turnoId) =>
    api.delete(`/usuarios/turnos/${turnoId}`),

  // GET /usuarios/sucursales?busqueda=X&lat=Y&lng=Z → busca empresas/sucursales
  buscarSucursales: (busqueda, lat, lng) => {
    const params = new URLSearchParams({
      busqueda,
      lat: String(lat),
      lng: String(lng),
    })
    return api.get(`/usuarios/sucursales?${params}`)
  },

  // POST /usuarios/sucursales/{id}/favoritos → agrega a favoritos
  addFavorito: (sucursalId) =>
    api.post(`/usuarios/sucursales/${sucursalId}/favoritos`),

  // DELETE /usuarios/sucursales/{id}/favoritos → quita de favoritos
  deleteFavorito: (sucursalId) =>
    api.delete(`/usuarios/sucursales/${sucursalId}/favoritos`),

  // GET /usuarios/mis-empresas → roles del usuario en empresas/sucursales
  getMisEmpresas: () =>
    api.get('/usuarios/mis-empresas'),

  // PATCH /usuarios/me → actualiza datos del usuario
  update: (data) => api.patch('/usuarios/me', data),


  // POST /usuarios/turnos → reserva un turno (ReservaTurnoOpcionesUserIn)
  reservarTurno: (opciones) =>
    api.post('/usuarios/turnos', { opciones }),

  // GET /usuarios/turnos/historial → historial paginado por cursor (más reciente primero)
  getHistorial: ({ fechaHoraUltima, idUltimo, limite = 50 } = {}) => {
    const params = new URLSearchParams({ limite: String(limite) })
    if (fechaHoraUltima) params.set('fecha_hora_ultima', fechaHoraUltima)
    if (idUltimo)        params.set('id_ultimo',          String(idUltimo))
    return api.get(`/usuarios/turnos/historial?${params}`)
  },

  // GET /usuarios/notificaciones → lista paginada por cursor (leidas=bool, id_ultimo, limite 1-100)
  getNotificaciones: ({ leidas, idUltimo, limite = 20 } = {}) => {
    const params = new URLSearchParams({ limite: String(limite) })
    if (leidas !== undefined && leidas !== null) params.set('leidas', String(leidas))
    if (idUltimo) params.set('id_ultimo', String(idUltimo))
    return api.get(`/usuarios/notificaciones?${params}`)
  },

  // PATCH /usuarios/notificaciones/{id}/leida → marca una notificación como leída (204)
  markNotificacionLeida: (notifId) =>
    api.patch(`/usuarios/notificaciones/${notifId}/leida`),

  // GET /usuarios/notificaciones/nuevas?id_posterior=X
  // Devuelve notificaciones con id > id_posterior (para polling cada 5 min)
  getNotificacionesNuevas: (idPosterior) =>
    api.get(`/usuarios/notificaciones/nuevas?id_posterior=${idPosterior}`),
}
