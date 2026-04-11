// DateInput — input de fecha solo por calendario (no se puede tipear).
// El ícono del calendario se muestra en rojo.
// Props:
//   value    : '' | 'YYYY-MM-DD'
//   onChange : (e) => void  — igual que un input nativo type="date"
//   disabled : bool
//   min      : 'YYYY-MM-DD'
//   className: clases del input
import './DateInput.css'

/** Bloquea el tipeo directo, permitiendo solo abrir el calendario con clic. */
function blockTyping(e) {
  // Permite Tab (navegación), F-keys y atajos de sistema; bloquea todo lo demás
  if (e.key === 'Tab' || e.key === 'Escape' || e.metaKey || e.ctrlKey) return
  e.preventDefault()
}

export default function DateInput({ value, onChange, disabled, min, className, wrapperClassName }) {
  const isEmpty = !value

  return (
    <div className={`date-wrap${isEmpty ? ' date-wrap--empty' : ''}${wrapperClassName ? ` ${wrapperClassName}` : ''}`}>
      <input
        type="date"
        className={`date-wrap__input${className ? ` ${className}` : ''}`}
        value={value}
        onChange={onChange}
        onKeyDown={blockTyping}
        disabled={disabled}
        min={min}
      />
    </div>
  )
}
