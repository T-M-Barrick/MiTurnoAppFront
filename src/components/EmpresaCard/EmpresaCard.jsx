import { useRef, useLayoutEffect, useState } from 'react'
import './EmpresaCard.css'

const STAR_POINTS = "12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"

/**
 * Estrella individual: full, half o empty.
 * Usa clipPath con id único para evitar conflictos entre múltiples tarjetas.
 */
function StarIcon({ type, id }) {
  if (type === 'full') {
    return (
      <svg className="ecard__star" viewBox="0 0 24 24" aria-hidden="true">
        <polygon points={STAR_POINTS} fill="currentColor" stroke="currentColor" strokeWidth="0.5"/>
      </svg>
    )
  }

  if (type === 'half') {
    const clipId = `ec-star-${id}`
    return (
      <svg className="ecard__star" viewBox="0 0 24 24" aria-hidden="true">
        <defs>
          <clipPath id={clipId}>
            <rect x="0" y="0" width="12" height="24"/>
          </clipPath>
        </defs>
        <polygon points={STAR_POINTS} fill="none" stroke="currentColor" strokeWidth="1.5"/>
        <polygon points={STAR_POINTS} fill="currentColor" stroke="none" clipPath={`url(#${clipId})`}/>
      </svg>
    )
  }

  return (
    <svg className="ecard__star" viewBox="0 0 24 24" aria-hidden="true">
      <polygon points={STAR_POINTS} fill="none" stroke="currentColor" strokeWidth="1.5"/>
    </svg>
  )
}

/**
 * Fila de 5 estrellas + número debajo. value: 0.0–5.0 con 1 decimal.
 */
function StarRating({ value, cardId }) {
  const stars = Array.from({ length: 5 }, (_, i) => {
    const pos = i + 1
    if (value >= pos)       return 'full'
    if (value >= pos - 0.5) return 'half'
    return 'empty'
  })

  return (
    <div className="ecard__rating" aria-label={`Calificación ${value.toFixed(1)} de 5`}>
      <div className="ecard__stars">
        {stars.map((type, idx) => (
          <StarIcon key={idx} type={type} id={`${cardId}-${idx}`} />
        ))}
      </div>
      <span className="ecard__stars-num">{value.toFixed(1)}</span>
    </div>
  )
}

/**
 * Pin oficial de Google Maps 2020 — paths y colores originales de la marca.
 */
function MapsIcon() {
  return (
    <svg
      className="ecard__maps-icon"
      viewBox="14.32 4.87961494 37.85626587 52.79038506"
      aria-hidden="true"
    >
      <path d="m37.34 7.82c-1.68-.53-3.48-.82-5.34-.82-5.43 0-10.29 2.45-13.54 6.31l8.35 7.02z" fill="#1a73e8"/>
      <path d="m18.46 13.31a17.615 17.615 0 0 0 -4.14 11.36c0 3.32.66 6.02 1.75 8.43l10.74-12.77z" fill="#ea4335"/>
      <path d="m32 17.92a6.764 6.764 0 0 1 5.16 11.13l10.52-12.51a17.684 17.684 0 0 0 -10.35-8.71l-10.51 12.51a6.74 6.74 0 0 1 5.18-2.42" fill="#4285f4"/>
      <path d="m32 31.44c-3.73 0-6.76-3.03-6.76-6.76a6.7 6.7 0 0 1 1.58-4.34l-10.75 12.77c1.84 4.07 4.89 7.34 8.03 11.46l13.06-15.52a6.752 6.752 0 0 1 -5.16 2.39" fill="#fbbc04"/>
      <path d="m36.9 48.8c5.9-9.22 12.77-13.41 12.77-24.13 0-2.94-.72-5.71-1.99-8.15l-23.57 28.05c1 1.31 2.01 2.7 2.99 4.24 3.58 5.54 2.59 8.86 4.9 8.86s1.32-3.33 4.9-8.87" fill="#34a853"/>
    </svg>
  )
}

/**
 * Tarjeta de resultado de búsqueda de empresas/sucursales.
 *
 * Props:
 *   sucursal          — objeto SucursalOut del back
 *   onClick           — callback () => void
 *   isFavorito        — boolean
 *   onToggleFavorito  — callback (sucursalId) => void
 */
export default function EmpresaCard({ sucursal, onClick, isFavorito = false, onToggleFavorito, href }) {
  const rubros = [sucursal.rubro, sucursal.rubro2].filter(Boolean).join(' · ')

  // Calificación: el back la envía sobre 10; se muestra sobre 5 con 1 decimal redondeado
  const cal5 = sucursal.calificacion != null
    ? Math.round((sucursal.calificacion / 2) * 10) / 10
    : null

  // Texto de dirección — versión completa y versión corta (sin departamento)
  const dir = sucursal.direccion
  const calleAltura = dir ? [dir.calle, dir.altura].filter(Boolean).join(' ') : null
  const hasDept = dir && dir.departamento && dir.departamento !== dir.localidad
  const dirFull  = dir ? [calleAltura, dir.localidad, hasDept ? dir.departamento : null].filter(Boolean).join(', ') : null
  const dirShort = dir ? [calleAltura, dir.localidad].filter(Boolean).join(', ') : null

  // Muestra dept si entra; si desborda cae a versión corta
  const [showDept, setShowDept] = useState(true)
  const dirRef = useRef(null)

  useLayoutEffect(() => {
    const el = dirRef.current
    if (!el || !hasDept) return
    if (el.scrollWidth > el.offsetWidth) setShowDept(false)
    else setShowDept(true)
  })

  const dirTexto = (showDept ? dirFull : dirShort)

  // URL de Google Maps usando coordenadas lat/lng
  const mapsUrl = dir?.lat != null && dir?.lng != null
    ? `https://www.google.com/maps?q=${dir.lat},${dir.lng}`
    : null

  const handleFavClick = (e) => {
    e.preventDefault()
    e.stopPropagation()
    onToggleFavorito?.(sucursal.id)
  }

  const handleMapsClick = (e) => {
    e.stopPropagation() // evita abrir la empresa al hacer click en el link de maps
  }

  return (
    <a
      href={href}
      className="ecard"
      onClick={onClick}
      tabIndex={0}
    >
      {/* Columna izquierda: solo logo */}
      <div className="ecard__left">
        <div className="ecard__logo">
          {sucursal.logo_url
            ? <img src={sucursal.logo_url} alt={sucursal.nombre} loading="lazy" />
            : <span>{sucursal.nombre.charAt(0).toUpperCase()}</span>}
        </div>
      </div>

      {/* Columna derecha: datos principales */}
      <div className={`ecard__info${cal5 == null ? ' ecard__info--sin-cal' : ''}`}>
        <div className="ecard__nombre">{sucursal.nombre}</div>

        {cal5 != null && <StarRating value={cal5} cardId={sucursal.id} />}

        {rubros && <div className="ecard__rubro">{rubros}</div>}

        {dirTexto && (
          <div className="ecard__dir">
            <span className="ecard__dir-icon" aria-hidden="true">📍</span>
            <span className="ecard__dir-text" ref={dirRef}>{dirTexto}</span>
            {mapsUrl && (
              <a
                href={mapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="ecard__maps-link"
                onClick={handleMapsClick}
                aria-label="Ver en Google Maps"
              >
                <MapsIcon />
              </a>
            )}
          </div>
        )}
      </div>

      {/* Botón de favorito */}
      <button
        className={`ecard__fav${isFavorito ? ' ecard__fav--on' : ''}`}
        onClick={handleFavClick}
        aria-label={isFavorito ? 'Quitar de favoritos' : 'Agregar a favoritos'}
        aria-pressed={isFavorito}
        type="button"
      >
        <svg width="20" height="20" viewBox="0 0 24 24"
          fill={isFavorito ? 'currentColor' : 'none'}
          stroke="currentColor" strokeWidth="1.8"
          strokeLinecap="round" strokeLinejoin="round">
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
        </svg>
      </button>
    </a>
  )
}
