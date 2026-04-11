import { api } from './api'

export const invitacionesService = {
  // POST /invitaciones/ — invita a un usuario a la empresa o sucursal (204 No Content)
  invitar: (data) => api.post('/invitaciones/', data),

  // POST /invitaciones/aceptar?token=XXX — acepta la invitación y devuelve { nombre, rol }
  aceptar: (token) => api.post(`/invitaciones/aceptar?token=${encodeURIComponent(token)}`),
}
