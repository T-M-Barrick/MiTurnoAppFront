import { useLayoutEffect } from 'react'

const BASE_PX = 13
const MIN_PX  = 10

/**
 * Achica el font-size de todos los .btn dentro del contenedor referenciado
 * hasta que el texto quepa sin desbordarse. Usa ResizeObserver para
 * reaccionar a cambios de ancho (responsive).
 */
export function useShrinkBtnText(ref) {
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return

    const shrink = () => {
      el.querySelectorAll('.btn').forEach((btn) => {
        btn.style.fontSize = BASE_PX + 'px'
        let size = BASE_PX
        while (btn.scrollWidth > btn.offsetWidth && size > MIN_PX) {
          size -= 0.5
          btn.style.fontSize = size + 'px'
        }
      })
    }

    shrink()
    const ro = new ResizeObserver(shrink)
    ro.observe(el)
    return () => ro.disconnect()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
}
