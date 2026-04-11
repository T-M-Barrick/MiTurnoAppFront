import FitText from '../FitText/FitText'
import './BookingRow.css'

/**
 * Fila del modal de confirmación de turno.
 * Muestra un ícono con fondo coloreado a la izquierda y contenido a la derecha.
 *
 * Props:
 *   color      — "blue" | "red" | "indigo" | "orange" | "green"
 *   icon       — elemento SVG
 *   modifier   — clase CSS extra para el contenedor (ej: "booking-row--service")
 *   fitText    — bool, si true achica el texto si desborda el ancho disponible
 *   children   — contenido de la fila
 */
export default function BookingRow({ color, icon, modifier = '', fitText = false, children }) {
  return (
    <div className={`booking-row${modifier ? ` ${modifier}` : ''}`}>
      {icon !== null && icon !== undefined && (
        <div className={`booking-row__icon booking-row__icon--${color}`}>
          {icon}
        </div>
      )}
      {fitText ? <FitText>{children}</FitText> : children}
    </div>
  )
}
