import { api } from './api'

export const authService = {
  // POST /auth/login — el back setea la cookie httponly en la respuesta
  login: (email, password) =>
    api.post('/auth/login', { email, password }),

  // POST /auth/logout — el back invalida y borra la cookie
  logout: () =>
    api.post('/auth/logout'),

  // POST /auth/password/forgot/email — solicita email de reseteo (siempre 204)
  forgotPasswordEmail: (email) =>
    api.post('/auth/password/forgot/email', { email }),

  // POST /auth/password/reset/email — resetea la contraseña con token del email
  resetPasswordEmail: (token, new_password) =>
    api.post('/auth/password/reset/email', { token, new_password }),
}
