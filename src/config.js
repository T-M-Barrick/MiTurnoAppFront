// URL base del backend. En producción, configurar VITE_API_BASE en el entorno.
// En desarrollo: cadena vacía → las peticiones van al mismo origen (127.0.0.1:5501)
// y Vite las proxea al back (127.0.0.1:8000). Así la cookie funciona sin problemas de SameSite.
// En producción: VITE_API_BASE debe apuntar a la URL del back (ej: https://api.miturno.com)
export const API_BASE = import.meta.env.VITE_API_BASE || ''
