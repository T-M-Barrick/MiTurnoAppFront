import { api } from './api'

export const empresaService = {
  // POST /empresas/ — crea una empresa nueva (requiere sesión activa)
  create: (data) => api.post('/empresas/', data),

  // GET /empresas/{id}/panel — datos del home de empresa
  getPanel: (empresaId) => api.get(`/empresas/${empresaId}/panel`),

  // GET /empresas/{id}/perfil — datos del perfil editable de la empresa
  getPerfil: (empresaId) => api.get(`/empresas/${empresaId}/perfil`),

  // PATCH /empresas/{id} — actualiza datos de la empresa (nombre, cuit, rubro, rubro2)
  update: (empresaId, data) => api.patch(`/empresas/${empresaId}`, data),

  // PATCH /empresas/{id}/logo — sube o elimina el logo (multipart). file=null para eliminar.
  uploadLogo: (empresaId, file) => api.uploadFile(`/empresas/${empresaId}/logo`, file),

  // GET /empresas/{id}/miembros — miembros de la empresa y sus sucursales
  getMiembros: (empresaId) => api.get(`/empresas/${empresaId}/miembros`),

  // PATCH /empresas/{id}/miembros/{targetId} — modifica el rol de un miembro
  updateMiembroRol: (empresaId, targetId, data) =>
    api.patch(`/empresas/${empresaId}/miembros/${targetId}`, data),

  // PATCH /empresas/{id}/miembros/me — el propietario modifica su propio rol
  updateMiRol: (empresaId, data) =>
    api.patch(`/empresas/${empresaId}/miembros/me`, data),

  // DELETE /empresas/{id}/miembros/me — el usuario abandona la empresa
  leaveEmpresa: (empresaId) =>
    api.delete(`/empresas/${empresaId}/miembros/me`),

  // DELETE /empresas/{id}/miembros/{targetId} — elimina un miembro de la empresa (204)
  deleteMiembro: (empresaId, targetId) =>
    api.delete(`/empresas/${empresaId}/miembros/${targetId}`),

  // GET /empresas/{id}/notificaciones → lista paginada por cursor (leidas=bool, id_ultimo, limite 1-100)
  getNotificaciones: (empresaId, { leidas, idUltimo, limite = 20 } = {}) => {
    const params = new URLSearchParams({ limite: String(limite) })
    if (leidas !== undefined && leidas !== null) params.set('leidas', String(leidas))
    if (idUltimo) params.set('id_ultimo', String(idUltimo))
    return api.get(`/empresas/${empresaId}/notificaciones?${params}`)
  },

  // PATCH /empresas/{id}/notificaciones/{notifId}/leida → marca una notificación como leída (204)
  markNotificacionLeida: (empresaId, notifId) =>
    api.patch(`/empresas/${empresaId}/notificaciones/${notifId}/leida`),

  // GET /empresas/{id}/notificaciones/nuevas?id_posterior=X
  // Devuelve notificaciones con id > id_posterior (para polling cada 5 min)
  getNotificacionesNuevas: (empresaId, idPosterior) =>
    api.get(`/empresas/${empresaId}/notificaciones/nuevas?id_posterior=${idPosterior}`),
}
