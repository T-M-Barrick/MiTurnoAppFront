import { useState, useRef, useEffect } from 'react'
import './CustomSelect.css'

/**
 * Dropdown custom totalmente controlado por CSS.
 * Reemplaza <select> nativo para tener control exacto sobre tamaño y alineación.
 *
 * Props:
 *   options   — array de { value, label }
 *   value     — valor seleccionado actual
 *   onChange  — (value: string) => void
 *   width     — ancho del botón en px (default: 42)
 *   height    — alto del botón en px (default: null, crece con el contenido)
 *   disabled  — boolean
 *   className — clase extra para el botón trigger
 */
export default function CustomSelect({ options = [], value, onChange, width = 42, height = null, disabled = false, className = '', dropdownMaxHeight = 168 }) {
  const [open,      setOpen]      = useState(false)
  const [menuStyle, setMenuStyle] = useState({})
  const ref = useRef(null)

  // Cierra al hacer click fuera
  useEffect(() => {
    if (!open) return
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  // Cierra con Escape
  useEffect(() => {
    if (!open) return
    const handler = (e) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open])

  const selectedLabel = options.find(o => o.value === value)?.label ?? value

  const handleSelect = (val) => {
    onChange?.(val)
    setOpen(false)
  }

  // Calcula posición fixed del menú para escapar cualquier overflow:hidden del padre
  const handleToggle = () => {
    if (disabled) return
    if (!open && ref.current) {
      const rect      = ref.current.getBoundingClientRect()
      const spaceDown = window.innerHeight - rect.bottom
      const goUp      = spaceDown < dropdownMaxHeight + 8

      setMenuStyle({
        position:  'fixed',
        left:      rect.left,
        minWidth:  rect.width,
        zIndex:    9999,
        maxHeight: dropdownMaxHeight,
        ...(goUp
          ? { bottom: window.innerHeight - rect.top + 4 }
          : { top:    rect.bottom + 4 }
        ),
      })
    }
    setOpen(o => !o)
  }

  const triggerStyle = { width, ...(height ? { height, boxSizing: 'border-box' } : {}) }

  return (
    <div className={`cselect${disabled ? ' cselect--disabled' : ''}`} ref={ref} style={{ width }}>
      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        className={`cselect__trigger${open ? ' cselect__trigger--open' : ''}${disabled ? ' cselect__trigger--disabled' : ''} ${className}`}
        onClick={handleToggle}
        onKeyDown={(e) => { if (!disabled && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); handleToggle() } }}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-disabled={disabled}
        style={triggerStyle}
      >
        <span className="cselect__value">{selectedLabel}</span>
        <svg className="cselect__arrow" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </div>

      {open && (
        <ul className="cselect__dropdown" role="listbox" style={menuStyle}>
          {options.map(opt => (
            <li
              key={opt.value}
              role="option"
              aria-selected={opt.value === value}
              className={`cselect__option${opt.value === value ? ' cselect__option--selected' : ''}`}
              onMouseDown={() => handleSelect(opt.value)}
            >
              {opt.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
