import { API_BASE } from '../config'

/**
 * Callback global invocado cuando el back responde con AUTH_ERROR.
 * El AuthProvider lo registra al montar para limpiar sesión y redirigir al index.
 */
let onAuthError = null
export function setAuthErrorHandler(fn) { onAuthError = fn }

/**
 * Wrapper base para todas las peticiones al back.
 * Incluye automáticamente las cookies (credentials: 'include').
 * Lanza el objeto de error JSON del back para que cada servicio lo maneje.
 */
async function request(method, path, body) {
  const options = {
    method,
    credentials: 'include', // necesario para enviar/recibir cookies httponly
    headers: {},
  }

  if (body !== undefined) {
    options.headers['Content-Type'] = 'application/json'
    options.body = JSON.stringify(body)
  }

  let res
  try {
    res = await fetch(`${API_BASE}${path}`, options)
  } catch {
    // Error de red (sin conexión, CORS, etc.)
    throw { code: 'NETWORK_ERROR' }
  }

  // 204 No Content — éxito sin cuerpo
  if (res.status === 204) return null

  // Error del back → lanzar el objeto JSON para que ErrorModal lo muestre
  if (!res.ok) {
    let errorBody
    try { errorBody = await res.json() } catch { errorBody = { code: 'INTERNAL_ERROR' } }
    // Sesión expirada: notificar al AuthContext y no propagar el error
    if (errorBody?.code === 'AUTH_ERROR') { onAuthError?.(); return null }
    throw errorBody
  }

  // Respuesta exitosa con cuerpo
  try {
    return await res.json()
  } catch {
    return null
  }
}

/**
 * Sube un archivo usando multipart/form-data.
 * No establece Content-Type — el browser lo hace automáticamente con el boundary correcto.
 * Si file es null, envía FormData vacío (el back interpreta esto como eliminar el archivo).
 */
async function uploadFile(method, path, file) {
  const formData = new FormData()
  if (file) formData.append('file', file)

  const options = {
    method,
    credentials: 'include',
    body: formData,
    // Sin headers: el browser establece Content-Type multipart/form-data con boundary
  }

  let res
  try {
    res = await fetch(`${API_BASE}${path}`, options)
  } catch {
    throw { code: 'NETWORK_ERROR' }
  }

  if (res.status === 204) return null

  if (!res.ok) {
    let errorBody
    try { errorBody = await res.json() } catch { errorBody = { code: 'INTERNAL_ERROR' } }
    if (errorBody?.code === 'AUTH_ERROR') { onAuthError?.(); return null }
    throw errorBody
  }

  try {
    return await res.json()
  } catch {
    return null
  }
}

export const api = {
  get:    (path)        => request('GET',    path),
  post:   (path, body)  => request('POST',   path, body),
  patch:  (path, body)  => request('PATCH',  path, body),
  // delete acepta body opcional para endpoints que lo requieren (ej: eliminar múltiples recursos)
  delete: (path, body)  => request('DELETE', path, body),
  // uploadFile para multipart/form-data (logos, imágenes)
  uploadFile: (path, file) => uploadFile('PATCH', path, file),
}
