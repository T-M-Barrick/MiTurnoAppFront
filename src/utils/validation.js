/**
 * Validaciones del lado del cliente que replican las reglas Pydantic del back.
 * Cada función retorna un string con el error o null si es válido.
 */

// Email: formato válido, máx 255 caracteres
export function validateEmail(value) {
  if (!value || !value.trim()) return 'El email es obligatorio'
  if (value.length > 255) return 'El email no puede superar los 255 caracteres'
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!regex.test(value.trim())) return 'El email no tiene un formato válido'
  return null
}

// Contraseña: 8-128 chars, sin espacios, al menos una letra y un número
export function validatePassword(value) {
  if (!value) return 'La contraseña es obligatoria'
  if (value.includes(' ')) return 'La contraseña no puede contener espacios'
  if (value.length < 8) return 'La contraseña debe tener al menos 8 caracteres'
  if (value.length > 128) return 'La contraseña no puede superar los 128 caracteres'
  if (!/[A-Za-z]/.test(value)) return 'La contraseña debe contener al menos una letra'
  if (!/[0-9]/.test(value)) return 'La contraseña debe contener al menos un número'
  return null
}

// DNI: solo dígitos, 6 a 8 caracteres
export function validateDNI(value) {
  if (!value || !value.trim()) return 'El DNI es obligatorio'
  if (!/^[0-9]{6,8}$/.test(value.trim())) return 'El DNI debe contener entre 6 y 8 dígitos numéricos'
  return null
}

// Nombre y Apellido: 1 a `max` caracteres (back: 30 para usuario, 40 para empresa)
export function validateNombre(value, campo = 'El nombre', max = 30) {
  if (!value || !value.trim()) return `${campo} es obligatorio`
  if (value.trim().length > max) return `${campo} no puede superar los ${max} caracteres`
  return null
}

// Teléfono: formato +[1-9][0-9]{5,28}
export function validateTelefono(value) {
  if (!value || !value.trim()) return 'El teléfono es obligatorio'
  if (!/^\+[1-9][0-9]{5,28}$/.test(value.trim())) {
    return 'Formato inválido. Debe incluir el código de país. Ej: +5491112345678'
  }
  return null
}

// Recordatorio: múltiplo de 30, entre 30 y 1410 minutos (o null)
export function validateRecordatorio(value) {
  if (value === null || value === undefined || value === '') return null
  const n = parseInt(value, 10)
  if (isNaN(n)) return 'Valor inválido'
  if (n < 30 || n > 1410) return 'El recordatorio debe estar entre 30 y 1410 minutos'
  if (n % 30 !== 0) return 'El recordatorio debe ser múltiplo de 30 minutos'
  return null
}

// CUIT: exactamente 11 dígitos numéricos
export function validateCuit(value) {
  if (!value || !value.trim()) return 'El CUIT es obligatorio'
  if (!/^[0-9]{11}$/.test(value.trim())) return 'El CUIT debe contener exactamente 11 dígitos numéricos'
  return null
}

// Texto genérico con longitud mínima y máxima
export function validateTexto(value, min = 1, max = 255, campo = 'El campo') {
  if (!value || !value.trim()) return null // opcional por defecto
  if (value.trim().length < min) return `${campo} debe tener al menos ${min} caracter(es)`
  if (value.trim().length > max) return `${campo} no puede superar los ${max} caracteres`
  return null
}


/**
 * Hace scroll suave al primer campo con error visible en el DOM.
 * Busca en orden: input/select con clase .error, luego mensajes .form-error.
 * Llamar después de setErrors() para que el DOM esté actualizado.
 */
export function scrollToFirstError() {
  setTimeout(() => {
    const sel = '.form-group input.error, .form-group select.error, .form-group textarea.error, .form-error, .sm-field__error'
    const first = document.querySelector(sel)
    first?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, 50)
}
