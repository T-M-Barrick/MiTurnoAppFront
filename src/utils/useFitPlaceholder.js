import { useLayoutEffect, useEffect, useRef } from 'react'

const BASE_PX = 15  // tamaño máximo (coincide con font-size base del input)
const MIN_PX  = 10  // no bajar de este tamaño
const STEP    = 0.5 // paso de reducción en px
// El span se mide en posición fija off-screen; el kerning sub-pixel acumula
// ~0.4 px por carácter de diferencia respecto al rendering real del input.
// Con 40+ caracteres eso equivale a 16-18 px de deriva → margen conservador.
const MARGIN  = 20

/**
 * Ajusta el font-size del placeholder de un input para que siempre entre en
 * el ancho disponible sin cortarse.
 *
 * Usa un <span> oculto con la misma fuente del input y reduce font-size en
 * pasos de 0.5px midiendo con getBoundingClientRect() hasta que el texto
 * entre exactamente — igual que FitText.jsx pero para placeholders.
 *
 * Sin array de dependencias: corre en cada render para detectar inputs que
 * aparecen de forma condicional (ej: después de un loading state).
 */
export function useFitPlaceholder(inputRef, placeholder) {
  const spanRef = useRef(null)

  useLayoutEffect(() => {
    const input = inputRef.current
    if (!input || !placeholder) return

    // Crea el span de medición una sola vez y lo mantiene en el DOM
    if (!spanRef.current) {
      const span = document.createElement('span')
      span.setAttribute('aria-hidden', 'true')
      span.style.cssText = [
        'position:fixed',
        'top:-9999px',
        'left:-9999px',
        'visibility:hidden',
        'white-space:nowrap',
        'pointer-events:none',
      ].join(';')
      document.body.appendChild(span)
      spanRef.current = span
    }
    const span = spanRef.current

    function fit() {
      const style  = window.getComputedStyle(input)
      const pLeft  = parseFloat(style.paddingLeft)  || 0
      const pRight = parseFloat(style.paddingRight) || 0
      const avail  = input.clientWidth - pLeft - pRight - MARGIN

      if (avail <= 0) return

      // Aplica la fuente exacta del input al span
      span.style.fontFamily    = style.fontFamily
      span.style.fontWeight    = style.fontWeight
      span.style.fontStyle     = style.fontStyle
      span.style.letterSpacing = style.letterSpacing
      span.textContent         = placeholder

      // Arranca al tamaño base y baja de a STEP hasta que entre
      let size = BASE_PX
      span.style.fontSize = `${size}px`

      while (span.getBoundingClientRect().width > avail && size > MIN_PX) {
        size = Math.max(size - STEP, MIN_PX)
        span.style.fontSize = `${size}px`
      }

      input.style.setProperty('--ph-size', `${size}px`)
    }

    fit()

    const ro = new ResizeObserver(fit)
    ro.observe(input)
    return () => ro.disconnect()
  })

  // Elimina el span del DOM cuando el componente se desmonta
  useEffect(() => {
    return () => {
      if (spanRef.current) {
        document.body.removeChild(spanRef.current)
        spanRef.current = null
      }
    }
  }, [])
}
