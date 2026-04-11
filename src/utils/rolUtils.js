/**
 * Utilidades para etiquetas y clases CSS de roles de empresa/sucursal.
 *
 * Convención de colores:
 *   Propietario      → verde
 *   Gerente empresa  → azul
 *   Gerente sucursal → índigo
 *   Empleado         → amarillo/marrón
 */

/**
 * Devuelve la etiqueta visible del rol según el contexto de la empresa.
 *
 * La distinción "de Empresa" / "de Sucursal" solo se muestra al propietario
 * o gerente de empresa cuando la empresa tiene 2 o más sucursales.
 * GERENTE_SUCURSAL siempre muestra "Gerente de Sucursal" porque su vínculo
 * a una sucursal específica es siempre relevante para quien lo ve.
 *
 * @param {string} rol           — valor del backend: 'PROPIETARIO' | 'GERENTE_EMPRESA' | 'GERENTE_SUCURSAL' | 'EMPLEADO'
 * @param {number} numSucursales — cantidad de sucursales de la empresa
 * @param {string} miRol         — rol del usuario que visualiza
 * @returns {string}
 */
export function getRolLabel(rol, numSucursales, miRol) {
  const puedeVerDistincion =
    numSucursales >= 2 &&
    (miRol === 'PROPIETARIO' || miRol === 'GERENTE_EMPRESA')

  if (rol === 'GERENTE_EMPRESA')  return puedeVerDistincion ? 'Gerente de Empresa' : 'Gerente'
  if (rol === 'GERENTE_SUCURSAL') return 'Gerente de Sucursal'
  if (rol === 'PROPIETARIO')      return 'Propietario'
  if (rol === 'EMPLEADO')         return 'Empleado'
  return rol
}
