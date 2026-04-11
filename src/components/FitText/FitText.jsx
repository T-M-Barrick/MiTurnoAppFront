import { useRef, useLayoutEffect } from 'react'

/**
 * Renderiza children en una sola línea.
 * El contenedor primero intenta crecer (fit-content en el padre).
 * Solo si sigue desbordando achica font-size + letter-spacing hasta que entre.
 *
 * Props:
 *   maxSize — tamaño máximo en px (default: 14)
 *   minSize — tamaño mínimo en px, no achica más allá (default: 11)
 */
export default function FitText({ children, maxSize = 14, minSize = 11 }) {
  const ref = useRef(null)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return

    // Reinicia al tamaño máximo
    el.style.fontSize = `${maxSize}px`
    el.style.letterSpacing = '0'

    // Solo achica si realmente desborda
    let size = maxSize
    while (el.scrollWidth > el.offsetWidth && size > minSize) {
      size -= 0.5
      el.style.fontSize = `${size}px`
      // Junta levemente las letras a medida que achica (máx -0.03em)
      const tight = Math.min((maxSize - size) * 0.006, 0.03)
      el.style.letterSpacing = `-${tight}em`
    }
  })

  return (
    <span
      ref={ref}
      style={{ display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', width: '100%' }}
    >
      {children}
    </span>
  )
}
