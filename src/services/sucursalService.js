import { api } from './api'

export const sucursalService = {
  // GET /sucursales/{id}/panel — datos del home de sucursal (para GERENTE_SUCURSAL/EMPLEADO)
  getSucursalPanel: (sucursalId) => api.get(`/sucursales/${sucursalId}/panel`),

  // POST /sucursales/ — crea una nueva sucursal para la empresa del usuario
  createSucursal: (data) => api.post('/sucursales/', data),

  // GET /sucursales/{id}/servicios — lista de servicios de una sucursal (panel admin)
  getServicios: (sucursalId) => api.get(`/sucursales/${sucursalId}/servicios`),

  // GET /sucursales/{id}/servicios/reserva?usuario=bool — servicios para reserva
  // usuario=true: modo usuario público | usuario=false: modo empresa (cliente_email opcional para verificar bloqueo)
  getServiciosParaReserva: (sucursalId, usuario, clienteEmail = null) => {
    const params = new URLSearchParams({ usuario: String(usuario) })
    if (clienteEmail) params.set('cliente_email', clienteEmail)
    return api.get(`/sucursales/${sucursalId}/servicios/reserva?${params}`)
  },

  // POST /sucursales/{id}/servicios — crea un nuevo servicio base con su primera versión
  createServicio: (sucursalId, data) => api.post(`/sucursales/${sucursalId}/servicios`, data),

  // PATCH /sucursales/{id}/servicios/{servicioBaseId} — actualiza datos base del servicio
  updateServicioBase: (sucursalId, servicioBaseId, data) =>
    api.patch(`/sucursales/${sucursalId}/servicios/${servicioBaseId}`, data),

  // DELETE /sucursales/{id}/servicios — elimina un servicio base (requiere body con lista de ids)
  deleteServicioBase: (sucursalId, servicioBaseId) =>
    api.delete(`/sucursales/${sucursalId}/servicios`, { servicios_base: [servicioBaseId] }),

  // PATCH /sucursales/{id}/servicios/{servicioBaseId}/versiones/{servicioId} — actualiza una versión del servicio
  updateServicioVersion: (sucursalId, servicioBaseId, servicioId, data) =>
    api.patch(
      `/sucursales/${sucursalId}/servicios/${servicioBaseId}/versiones/${servicioId}`,
      data
    ),

  // POST /sucursales/{id}/servicios/{servicioBaseId}/versiones — crea una nueva versión
  createVersion: (sucursalId, servicioBaseId, data) =>
    api.post(`/sucursales/${sucursalId}/servicios/${servicioBaseId}/versiones`, data),

  // DELETE /sucursales/{id}/servicios/{servicioBaseId}/versiones/{servicioId} — elimina una versión
  deleteVersion: (sucursalId, servicioBaseId, servicioId) =>
    api.delete(`/sucursales/${sucursalId}/servicios/${servicioBaseId}/versiones/${servicioId}`),

  // POST /sucursales/{id}/servicios/{servicioBaseId}/excepciones — crea una excepción de fecha (bloqueo)
  createExcepcion: (sucursalId, servicioBaseId, data) =>
    api.post(`/sucursales/${sucursalId}/servicios/${servicioBaseId}/excepciones`, data),

  // PATCH /sucursales/{id}/servicios/{servicioBaseId}/excepciones/{excepcionId} — edita un bloqueo
  updateExcepcion: (sucursalId, servicioBaseId, excepcionId, data) =>
    api.patch(`/sucursales/${sucursalId}/servicios/${servicioBaseId}/excepciones/${excepcionId}`, data),

  // DELETE /sucursales/{id}/servicios/{servicioBaseId}/excepciones/{excepcionId} — elimina un bloqueo
  deleteExcepcion: (sucursalId, servicioBaseId, excepcionId) =>
    api.delete(`/sucursales/${sucursalId}/servicios/${servicioBaseId}/excepciones/${excepcionId}`),

  // PATCH /sucursales/{id} — actualiza datos de la sucursal (nombre, reserva, telefonos, direccion)
  updatePerfil: (sucursalId, data) => api.patch(`/sucursales/${sucursalId}`, data),

  // PATCH /sucursales/{id}/desactivar — desactiva la sucursal (solo propietario)
  desactivarSucursal: (sucursalId) => api.patch(`/sucursales/${sucursalId}/desactivar`),

  // PATCH /sucursales/{id}/reactivar — reactiva la sucursal (solo propietario)
  reactivarSucursal: (sucursalId) => api.patch(`/sucursales/${sucursalId}/reactivar`),

  // GET /sucursales/{id}/turnos → lista de turnos activos de la sucursal
  getTurnos: (sucursalId) =>
    api.get(`/sucursales/${sucursalId}/turnos`),

  // GET /sucursales/{id}/turnos/estados → lista de {id, estado} para polling
  getEstadosTurnos: (sucursalId) =>
    api.get(`/sucursales/${sucursalId}/turnos/estados`),

  // PATCH /sucursales/{id}/turnos/{turnoId}/estado → cambia estado del turno
  updateEstadoTurno: (sucursalId, turnoId, data) =>
    api.patch(`/sucursales/${sucursalId}/turnos/${turnoId}/estado`, data),

  // DELETE /sucursales/{id}/turnos → mueve al historial los turnos indicados
  deleteTurnos: (sucursalId, turnoIds) =>
    api.delete(`/sucursales/${sucursalId}/turnos`, { turnos: turnoIds }),

  // GET /sucursales/{id}/turnos/historial — historial paginado por cursor
  getHistorial: (sucursalId, { fechaHoraUltima, idUltimo, limite = 50 } = {}) => {
    const params = new URLSearchParams({ limite: String(limite) })
    if (fechaHoraUltima) params.set('fecha_hora_ultima', fechaHoraUltima)
    if (idUltimo)        params.set('id_ultimo', String(idUltimo))
    return api.get(`/sucursales/${sucursalId}/turnos/historial?${params}`)
  },

  // GET /sucursales/{id}/clientes — lista/busqueda paginada por cursor
  getClientes: (sucursalId, { busqueda, activo, idUltimo, limite = 50 } = {}) => {
    const params = new URLSearchParams({ limite: String(limite) })
    if (busqueda)              params.set('busqueda', busqueda)
    if (activo !== undefined && activo !== null) params.set('activo', String(activo))
    if (idUltimo)              params.set('id_ultimo', String(idUltimo))
    return api.get(`/sucursales/${sucursalId}/clientes?${params}`)
  },

  // POST /sucursales/{id}/clientes — crea un cliente
  createCliente: (sucursalId, data) =>
    api.post(`/sucursales/${sucursalId}/clientes`, data),

  // PATCH /sucursales/{id}/clientes/{clienteId} — actualiza datos del cliente
  updateCliente: (sucursalId, clienteId, data) =>
    api.patch(`/sucursales/${sucursalId}/clientes/${clienteId}`, data),

  // PATCH /sucursales/{id}/clientes/{clienteId}/desactivar — desactiva el cliente
  desactivarCliente: (sucursalId, clienteId) =>
    api.patch(`/sucursales/${sucursalId}/clientes/${clienteId}/desactivar`),

  // PATCH /sucursales/{id}/clientes/{clienteId}/reactivar — reactiva el cliente
  reactivarCliente: (sucursalId, clienteId) =>
    api.patch(`/sucursales/${sucursalId}/clientes/${clienteId}/reactivar`),

  // GET /sucursales/{id}/miembros — lista de miembros de la sucursal
  getMiembrosSucursal: (sucursalId) =>
    api.get(`/sucursales/${sucursalId}/miembros`),

  // POST /sucursales/{id}/miembros/{targetId} — agrega miembro de empresa a esta sucursal
  addMiembroSucursal: (sucursalId, targetId, data) =>
    api.post(`/sucursales/${sucursalId}/miembros/${targetId}`, data),

  // PATCH /sucursales/{id}/miembros/{targetId} — modifica rol de un miembro en la sucursal
  updateMiembroRolSucursal: (sucursalId, targetId, data) =>
    api.patch(`/sucursales/${sucursalId}/miembros/${targetId}`, data),

  // DELETE /sucursales/{id}/miembros/{targetId} — elimina miembro de la sucursal (204)
  deleteMiembroSucursal: (sucursalId, targetId) =>
    api.delete(`/sucursales/${sucursalId}/miembros/${targetId}`),

  // POST /sucursales/{id}/turnos — reserva un turno para un cliente desde la empresa
  reservarTurnoCliente: (sucursalId, data) =>
    api.post(`/sucursales/${sucursalId}/turnos`, data),

  // GET /sucursales/{id}/bloqueos — lista de clientes bloqueados
  getBloqueos: (sucursalId) =>
    api.get(`/sucursales/${sucursalId}/bloqueos`),

  // POST /sucursales/{id}/bloqueos/{clienteId} — bloquea un cliente, body: { motivo }
  bloquearCliente: (sucursalId, clienteId, data) =>
    api.post(`/sucursales/${sucursalId}/bloqueos/${clienteId}`, data),

  // DELETE /sucursales/{id}/bloqueos/{clienteId} — desbloquea un cliente (204)
  desbloquearCliente: (sucursalId, clienteId) =>
    api.delete(`/sucursales/${sucursalId}/bloqueos/${clienteId}`),

  // GET /sucursales/{id}/notificaciones → lista paginada por cursor (leidas=bool, id_ultimo, limite 1-100)
  getNotificaciones: (sucursalId, { leidas, idUltimo, limite = 20 } = {}) => {
    const params = new URLSearchParams({ limite: String(limite) })
    if (leidas !== undefined && leidas !== null) params.set('leidas', String(leidas))
    if (idUltimo) params.set('id_ultimo', String(idUltimo))
    return api.get(`/sucursales/${sucursalId}/notificaciones?${params}`)
  },

  // PATCH /sucursales/{id}/notificaciones/{notifId}/leida → marca una notificación como leída (204)
  markNotificacionLeida: (sucursalId, notifId) =>
    api.patch(`/sucursales/${sucursalId}/notificaciones/${notifId}/leida`),

  // GET /sucursales/{id}/notificaciones/nuevas?id_posterior=X
  // Devuelve notificaciones con id > id_posterior (para polling cada 5 min)
  getNotificacionesNuevas: (sucursalId, idPosterior) =>
    api.get(`/sucursales/${sucursalId}/notificaciones/nuevas?id_posterior=${idPosterior}`),
}
