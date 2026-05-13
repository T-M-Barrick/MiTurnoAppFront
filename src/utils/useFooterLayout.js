import { useState, useLayoutEffect } from 'react'

// Mide el ancho mínimo del botón: texto + padding real + borde.
//
// Por qué host + clon sin position:
//   • position:fixed/absolute en el clon blockifica display:inline-flex → flex.
//     Para un flex-container con position:fixed y width:auto el navegador puede
//     resolver el ancho contra el viewport (no shrink-to-fit), dando maxMin enorme.
//   • Manteniendo position:static en el clon, display:inline-flex NO se blockifica.
//     Para inline-flex, width:auto siempre resuelve al max-content (contenido real).
//
// El host es fixed para sacarlo del flujo; el clon vive dentro del host como
// elemento de bloque inline, completamente desacoplado del cascade problemático.
function measureMinWidth(btn) {
  const style = window.getComputedStyle(btn)
  const padL  = parseFloat(style.paddingLeft)
  const padR  = parseFloat(style.paddingRight)

  const clone = btn.cloneNode(true)
  Object.assign(clone.style, {
    // Sin position → queda static → inline-flex no se blockifica → width:auto = contenido
    width:        'auto',
    minWidth:     '0',
    maxWidth:     'none',
    paddingLeft:  `${padL}px`,
    paddingRight: `${padR}px`,
    whiteSpace:   'nowrap',
    flex:         'none',
  })

  const host = document.createElement('div')
  Object.assign(host.style, {
    position:   'fixed',
    top:        '-9999px',
    left:       '-9999px',
    width:      '9999px',   // ancho generoso para que el inline-flex tenga espacio
    visibility: 'hidden',
  })

  host.appendChild(clone)
  document.body.appendChild(host)
  const w = clone.offsetWidth
  document.body.removeChild(host)
  return w
}

/**
 * Observa el ancho del footer y devuelve el modo de layout de los botones.
 * Agrega la clase 'footer-managed' al footer.
 *
 * Umbral unificado: ¿caben k botones lado a lado, cada uno al menos a maxMin?
 *   fits(k) = (avail - gap*(k-1)) / k >= maxMin
 *
 * Comportamiento (n = cantidad de botones):
 *   n=2: row → column (2/1)
 *   n=3: row → split (2-3 / 1) → column (3/2/1)
 *   n=4: row → split (2-3-4 / 1) → 2x2 (3-4 / 1-2) → column (4/3/2/1)
 *
 * El order:1 del primer botón en split lo aplica CSS (.--split > .btn:first-child).
 *
 * @param {React.RefObject} footerRef
 */
export function useFooterLayout(footerRef) {
  const [mode, setMode] = useState('row')

  useLayoutEffect(() => {
    const footer = footerRef.current
    if (!footer) return

    footer.classList.add('footer-managed')

    const getBtns = () => Array.from(footer.querySelectorAll(':scope > .btn'))

    let minWidths = null
    let lastCount = 0

    const update = () => {
      const btns = getBtns()
      if (!btns.length) return

      // Re-mide si cambió la cantidad de botones
      if (!minWidths || btns.length !== lastCount) {
        lastCount = btns.length
        minWidths  = btns.map(measureMinWidth)
      }

      const maxMin = Math.max(...minWidths)
      const n      = btns.length
      const style  = window.getComputedStyle(footer)
      const padH   = parseFloat(style.paddingLeft) + parseFloat(style.paddingRight)
      const gap    = parseFloat(style.gap) || parseFloat(style.columnGap) || 0
      const avail  = footer.clientWidth - padH

      // ¿Caben k botones lado a lado encogidos hasta maxMin?
      const fits = k => (avail - gap * (k - 1)) / k >= maxMin

      // ── ROW: todos los n caben ────────────────────────────────────────────
      if (fits(n)) { setMode('row'); return }

      // ── SPLIT (n≥3): los n-1 botones superiores caben → btn[0] va abajo ──
      if (n >= 3 && fits(n - 1)) { setMode('split'); return }

      // ── 2×2 (n=4): 2 botones superiores caben → btn[0]+btn[1] van abajo ──
      if (n === 4 && fits(2)) { setMode('2x2'); return }

      setMode('column')
    }

    update()
    const ro = new ResizeObserver(update)
    ro.observe(footer)
    // Re-evalúa cuando se agrega o elimina un botón (ej: "Reservar turno" con bloqueado)
    const mo = new MutationObserver(update)
    mo.observe(footer, { childList: true })
    return () => { ro.disconnect(); mo.disconnect() }
  }, [footerRef])

  return mode
}
