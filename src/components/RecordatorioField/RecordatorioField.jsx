import CustomSelect from '../CustomSelect/CustomSelect'
import './RecordatorioField.css'

/**
 * Bloque de recordatorio reutilizable: toggle + campo horas + campo minutos.
 *
 * Props:
 *   enabled          — boolean: si el recordatorio está activo
 *   hours            — string: horas (ej. "2")
 *   minutes          — '00' | '30': minutos
 *   onEnabledChange  — (bool) => void
 *   onHoursChange    — (string) => void
 *   onMinutesChange  — (string) => void
 *   disabled         — boolean: bloquea los inputs mientras se guarda
 *   error            — string | null: mensaje de error de validación
 */
export default function RecordatorioField({
  enabled,
  hours,
  minutes,
  onEnabledChange,
  onHoursChange,
  onMinutesChange,
  disabled = false,
  error = null,
}) {
  return (
    <div className="recfield">
      <div className="recfield__row">
        {/* Toggle on/off */}
        <label className="recfield__toggle">
          <input
            type="checkbox"
            className="recfield__toggle-input"
            checked={enabled}
            onChange={(e) => {
              onEnabledChange(e.target.checked)
              if (!e.target.checked) {
                onHoursChange('')
                onMinutesChange('00')
              }
            }}
            disabled={disabled}
          />
          <span className="recfield__toggle-track" />
        </label>

        {/* Campo horas */}
        <div className="recfield__field">
          <input
            type="text"
            inputMode="numeric"
            maxLength={2}
            placeholder="0"
            className={`recfield__input${error ? ' recfield__input--error' : ''}`}
            value={hours}
            onChange={(e) => onHoursChange(e.target.value.replace(/\D/g, '').slice(0, 2))}
            disabled={disabled || !enabled}
          />
          <span className="recfield__unit">horas</span>
        </div>

        {/* Campo minutos */}
        <div className="recfield__field">
          <CustomSelect
            options={[{ value: '00', label: '00' }, { value: '30', label: '30' }]}
            value={minutes}
            onChange={onMinutesChange}
            width={44}
            height={37}
            disabled={disabled || !enabled}
            className={error ? 'recfield__input--error' : ''}
          />
          <span className="recfield__unit">minutos</span>
        </div>


      </div>

      {error && <p className="recfield__error">{error}</p>}
    </div>
  )
}
