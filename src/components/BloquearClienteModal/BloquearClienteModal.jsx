import { useState, useEffect, useLayoutEffect, useRef } from 'react'
import { sucursalService } from '../../services/sucursalService'
import './BloquearClienteModal.css'

/**
 * Modal para bloquear un cliente de la sucursal.
 * Paso 1: buscar y seleccionar cliente.
 * Paso 2: sub-modal encima con datos del cliente y motivo opcional.
 *
 * Props:
 *   sucursalId  — id de la sucursal
 *   onClose     — cerrar el modal
 *   onBloqueado — callback(BlockClienteOut) tras bloquear exitosamente
 *   onError     — callback(errorObj) para mostrar ErrorModal
 */

/**
 * Ítem de resultado de búsqueda.
 * Reduce el font-size si el texto no entra, hasta un mínimo, luego elipsis.
 */
function ResultItem({ cliente, formatDni, onSelect, onError }) {
  const nombreRef = useRef(null)
  const nombre = `${cliente.apellido}, ${cliente.nombre}`

  useLayoutEffect(() => {
    const el = nombreRef.current
    if (!el) return
    el.style.fontSize = '14px'
    if (el.scrollWidth > el.clientWidth) el.style.fontSize = '11px'
  }, [nombre])

  const handleClick = () => {
    if (cliente.bloqueado) {
      // Muestra el error sin llamar al back
      onError?.({ code: 'CLIENTE_ALREADY_BLOCKED' })
    } else {
      onSelect(cliente)
    }
  }

  return (
    <li
      className={`blkmodal__item${cliente.bloqueado ? ' blkmodal__item--ya-bloqueado' : ''}`}
      onClick={handleClick}
    >
      {/* Columna izquierda: nombre + DNI + email */}
      <div className="blkmodal__item-content">
        <span className="blkmodal__item-nombre" ref={nombreRef}>{nombre}</span>
        {cliente.dni && (
          <div className="blkmodal__item-sub">
            <span className="blkmodal__item-dni-icon">🪪</span> {formatDni(cliente.dni)}
          </div>
        )}
        {cliente.email && (
          <div className="blkmodal__item-sub">
            📧 {cliente.email}
          </div>
        )}
      </div>
      {/* Badge a la derecha, centrado verticalmente por el flex del li */}
      {cliente.bloqueado && <span className="blkmodal__item-badge">Bloqueado</span>}
    </li>
  )
}

export default function BloquearClienteModal({ sucursalId, resetKey = 0, onClose, onBloqueado, onError }) {
  const [searchInput,   setSearchInput]   = useState('')
  const showHint = searchInput.length > 0 && searchInput.length < 3
  const [resultados,    setResultados]    = useState(null)
  const [loadingSearch, setLoadingSearch] = useState(false)
  const [seleccionado,  setSeleccionado]  = useState(null)
  const [motivo,        setMotivo]        = useState('')
  const [loading,       setLoading]       = useState(false)

  const clienteNombreRef = useRef(null)
  const formatDni = (dni) => dni?.replace(/\B(?=(\d{3})+(?!\d))/g, '.') ?? ''

  const clienteTexto = seleccionado
    ? `${seleccionado.apellido}, ${seleccionado.nombre}${seleccionado.dni ? ` (DNI ${formatDni(seleccionado.dni)})` : ''}`
    : ''

  // Al aceptar el éxito el padre incrementa resetKey → cierra el sub-modal
  useEffect(() => {
    if (resetKey > 0) { setSeleccionado(null); setMotivo('') }
  }, [resetKey])

  // Reduce el font-size del nombre si no entra, hasta un mínimo, luego elipsis
  useLayoutEffect(() => {
    const el = clienteNombreRef.current
    if (!el) return
    el.style.fontSize = '14px'
    if (el.scrollWidth > el.clientWidth) el.style.fontSize = '11px'
  }, [clienteTexto])

  const handleBuscar = async () => {
    const q = searchInput.trim()
    if (q.length < 3) return
    setLoadingSearch(true)
    setResultados(null)
    try {
      const data = await sucursalService.getClientes(sucursalId, { busqueda: q })
      setResultados(data.clientes ?? [])
    } catch (err) {
      onError?.(err)
    } finally {
      setLoadingSearch(false)
    }
  }

  const handleBloquear = async () => {
    if (!seleccionado) return
    setLoading(true)
    try {
      const data = await sucursalService.bloquearCliente(
        sucursalId,
        seleccionado.id,
        { motivo: motivo.trim() || null }
      )
      // Marca el cliente como bloqueado en los resultados de búsqueda
      setResultados((prev) => prev?.map((c) =>
        c.id === seleccionado.id ? { ...c, bloqueado: true } : c
      ) ?? null)
      onBloqueado?.(data)
    } catch (err) {
      onError?.(err)
    } finally {
      setLoading(false)
    }
  }

  const handleCancelarMotivo = () => {
    setSeleccionado(null)
    setMotivo('')
  }

  return (
    <>
      {/* ═══ MODAL PRINCIPAL: búsqueda de cliente ═══ */}
      <div className="tdmodal-overlay">
        <div className="tdmodal blkmodal" onClick={(e) => e.stopPropagation()}>
          <div className="tdmodal__handle" />

          <div className="tdmodal__header">
            <h3>Buscar cliente</h3>
            <button className="btn-icon" onClick={onClose} aria-label="Cerrar">✕</button>
          </div>

          <div className="tdmodal__body">
            {/* ── Buscador ── */}
            <div className={`blkmodal__search${showHint ? ' blkmodal__search--hint' : ''}`}>
              <div className="hp-search__bar">
                <span
                  className="hp-search__icon hp-search__icon--btn"
                  onClick={handleBuscar}
                  role="button"
                  aria-label="Buscar"
                >🔍</span>
                <input
                  type="search"
                  className="hp-search__input"
                  placeholder="Buscar por nombre, apellido, DNI o email"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleBuscar()}
                  autoFocus
                />
              </div>
              {showHint && (
                <p className="blkmodal__hint blkmodal__hint--error">Ingresá al menos 3 caracteres y presioná Enter para buscar</p>
              )}
            </div>

            {loadingSearch && (
              <div className="loading-inline"><div className="spinner" /></div>
            )}

            {!loadingSearch && resultados?.length === 0 && (
              <p className="blkmodal__empty">Sin resultados para esa búsqueda.</p>
            )}

            {!loadingSearch && resultados && resultados.length > 0 && (
              <ul className="blkmodal__list">
                {resultados.map((c) => (
                  <ResultItem
                    key={c.id}
                    cliente={c}
                    formatDni={formatDni}
                    onSelect={setSeleccionado}
                    onError={onError}
                  />
                ))}
              </ul>
            )}
          </div>

          <div className="tdmodal__actions">
            <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          </div>
        </div>
      </div>

      {/* ═══ SUB-MODAL: motivo (aparece encima cuando se selecciona un cliente) ═══ */}
      {seleccionado && (
        <div className="tdmodal-overlay blksumodal-overlay">
          <div className="tdmodal blkmodal" onClick={(e) => e.stopPropagation()}>
            <div className="tdmodal__handle" />

            <div className="tdmodal__header">
              <h3>Bloquear cliente</h3>
              <button className="btn-icon" onClick={handleCancelarMotivo} aria-label="Cerrar" disabled={loading}>✕</button>
            </div>

            <div className="tdmodal__body blksumodal__body">
              {/* Datos del cliente dentro del modal */}
              <p className="blksumodal__cliente" ref={clienteNombreRef}>{clienteTexto}</p>

              <label className="tdsumodal__motivo-label" htmlFor="blk-motivo">
                Motivo <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>(opcional)</span>
              </label>
              <textarea
                id="blk-motivo"
                className="tdsumodal__motivo-input"
                placeholder="Describí el motivo del bloqueo…"
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                maxLength={255}
                rows={3}
                disabled={loading}
                autoFocus
              />
              <p className="blkmodal__chars">{motivo.length}/255</p>
            </div>

            <div className="tdmodal__actions">
              <button className="btn btn-ghost" onClick={handleCancelarMotivo} disabled={loading}>Cancelar</button>
              <button className="btn btn-danger" onClick={handleBloquear} disabled={loading}>
                {loading ? <span className="spinner spinner-sm" /> : 'Bloquear'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
