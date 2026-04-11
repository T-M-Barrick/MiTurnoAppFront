import { useState, useEffect, useRef, useCallback, forwardRef, useImperativeHandle } from 'react'
import MapaPicker from '../MapaPicker/MapaPicker'
import { geoService } from '../../services/geoService'
import CustomSelect from '../CustomSelect/CustomSelect'
import './DireccionFormItem.css'

/**
 * Componente reutilizable para un ítem de dirección dentro de un formulario.
 * Usa forwardRef + useImperativeHandle para exponer getData() y validate().
 *
 * Props:
 *   initial   — DireccionOut existente o null si es nueva
 *   provincias — array de provincias [{id, nombre}]
 *   index     — índice base 0 (para mostrar "Dirección N")
 *   canRemove — booleano: muestra botón de eliminar
 *   onRemove  — función al hacer clic en eliminar
 *   disabled  — deshabilita todos los campos
 */
const DireccionFormItem = forwardRef(function DireccionFormItem(
  { initial, provincias, index, canRemove, onRemove, disabled, showHeader = true },
  ref
) {
  // Campos del formulario
  const [provincia, setProvincia]   = useState(initial?.provincia   ?? '')
  const [municipio, setMunicipio]   = useState(initial?.departamento ?? '')
  const [localidad, setLocalidad]   = useState(initial?.localidad    ?? '')
  const [calle, setCalle]           = useState(initial?.calle        ?? '')
  const [altura, setAltura]         = useState(initial?.altura       ?? '')
  const [aclaracion, setAclaracion] = useState(initial?.aclaracion   ?? '')

  // Coordenadas del mapa
  const [mapLat, setMapLat] = useState(initial?.lat ?? null)
  const [mapLng, setMapLng] = useState(initial?.lng ?? null)
  const [mapZoom, setMapZoom] = useState(16)

  // Estado de validez de coordenadas
  const [coordsValidas, setCoordsValidas] = useState(
    initial?.lat != null && initial?.lng != null
  )

  // Datos geo cargados del back
  const [municipios, setMunicipios]   = useState([])
  const [localidades, setLocalidades] = useState([])
  const [geoStatus, setGeoStatus]     = useState('')

  // Estado del botón Buscar
  const [buscando, setBuscando] = useState(false)

  // Errores de validación locales
  const [errors, setErrors] = useState({})

  // Evita limpiar campos al cargar datos iniciales desde props
  const isInitialLoad = useRef(true)

  // --- Efecto de montaje: carga municipios y localidades para datos iniciales ---
  useEffect(() => {
    const cargarDatosIniciales = async () => {
      if (initial?.provincia) {
        try {
          const muns = await geoService.getDepartamentos(initial.provincia)
          setMunicipios(muns)
          if (initial?.departamento) {
            try {
              const locs = await geoService.getLocalidades(initial.provincia, initial.departamento)
              if (locs.length > 0) {
                setLocalidades(locs)
              }
              // Si locs está vacío, localidad ya fue seteada con municipio en el estado inicial
            } catch {
              // Error silencioso — el campo queda cargado con el valor inicial
            }
          }
        } catch {
          // Error silencioso
        }
      }
      // Marca que la carga inicial terminó para habilitar los effects reactivos
      isInitialLoad.current = false
    }

    cargarDatosIniciales()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // --- Effect: provincia cambia → limpia campos dependientes y carga municipios ---
  useEffect(() => {
    if (isInitialLoad.current) return
    setMunicipio('')
    setLocalidad('')
    setCalle('')
    setAltura('')
    setMunicipios([])
    setLocalidades([])
    setMapLat(null)
    setMapLng(null)
    setCoordsValidas(false)
    setGeoStatus('')
    if (!provincia) return
    geoService.getDepartamentos(provincia)
      .then(setMunicipios)
      .catch(() => {})
  }, [provincia]) // eslint-disable-line react-hooks/exhaustive-deps

  // --- Effect: municipio cambia → limpia campos dependientes y carga localidades ---
  useEffect(() => {
    if (isInitialLoad.current) return
    setLocalidad('')
    setCalle('')
    setAltura('')
    setLocalidades([])
    setMapLat(null)
    setMapLng(null)
    setCoordsValidas(false)
    setGeoStatus('')
    if (!municipio) return
    geoService.getLocalidades(provincia, municipio)
      .then((data) => {
        if (data.length === 0) {
          setLocalidades([])
          setLocalidad(municipio) // el municipio actúa como localidad si no hay datos
        } else {
          setLocalidades(data)
        }
      })
      .catch(() => {})
  }, [municipio]) // eslint-disable-line react-hooks/exhaustive-deps

  // --- Effect: localidad cambia → limpia calle/altura y geocodifica para obtener coordenadas del centro ---
  useEffect(() => {
    if (isInitialLoad.current) return
    setCalle('')
    setAltura('')
    if (!localidad || !municipio || !provincia) return
    setMapLat(null)
    setMapLng(null)
    setCoordsValidas(false)
    setGeoStatus('Buscando ubicación…')
    geoService.getCoordenadas({ provincia, municipio, localidad })
      .then((res) => {
        setMapLat(parseFloat(res.lat))
        setMapLng(parseFloat(res.lng))
        setMapZoom(16)
        setCoordsValidas(true)
        setGeoStatus('✅ Ubicación encontrada. Podés mover el marcador para ajustarla.')
      })
      .catch(() => {
        // Fallback: mapa centrado en Argentina para que el usuario ubique manualmente
        setMapLat(-34.6083)
        setMapLng(-64.1936)
        setMapZoom(5)
        setCoordsValidas(false)
        setGeoStatus('⚠️ No se encontró la ubicación automáticamente. Ingresá calle y altura o mové el pin en el mapa.')
      })
  }, [localidad]) // eslint-disable-line react-hooks/exhaustive-deps

  // --- Buscar dirección exacta al presionar el botón ---
  const handleBuscar = async () => {
    if (!calle.trim() || !localidad) return
    setBuscando(true)
    setGeoStatus('Buscando dirección exacta…')
    try {
      const res = await geoService.getCoordenadas({ provincia, municipio, localidad, calle, altura })
      setMapLat(parseFloat(res.lat))
      setMapLng(parseFloat(res.lng))
      if (res.calle) setCalle(res.calle)
      setMapZoom(16)
      setCoordsValidas(true)
      setGeoStatus('✅ Dirección encontrada.')
    } catch {
      setGeoStatus('⚠️ Dirección no encontrada. Ajustá el marcador en el mapa.')
    } finally {
      setBuscando(false)
    }
  }

  // --- Callback: el usuario mueve el marcador en el mapa → geocodificación inversa ---
  const handleMapChange = useCallback(async (lat, lng) => {
    setMapLat(lat)
    setMapLng(lng)
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1`,
        { headers: { 'Accept-Language': 'es', 'User-Agent': 'MiTurnoApp/1.0' } }
      )
      const data = await res.json()
      if (data?.address?.road) {
        setCalle(data.address.road)
        setAltura(data.address.house_number ?? '')
      }
      // El usuario interactuó con el mapa: coords válidas independientemente del reverse geo
      setCoordsValidas(true)
    } catch {
      // Error de red silencioso
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // --- Helper: limpia un error específico al editar el campo ---
  const clearError = (field) => setErrors((prev) => ({ ...prev, [field]: null }))

  // --- Expone getData() y validate() al componente padre vía ref ---
  useImperativeHandle(ref, () => ({
    // Retorna los datos del formulario en el formato esperado por el back
    getData: () => ({
      id:          initial?.id ?? 0,
      calle:       calle.trim(),
      altura:      altura.trim() || null,
      localidad,
      departamento: municipio,
      provincia,
      pais:        'Argentina',
      lat:         mapLat,
      lng:         mapLng,
      aclaracion:  aclaracion.trim() || null,
    }),

    // Valida todos los campos requeridos y actualiza los errores visuales
    validate: () => {
      const e = {}
      if (!provincia)      e.provincia  = 'Seleccioná una provincia'
      if (!municipio)      e.municipio  = 'Seleccioná un municipio'
      if (!localidad)      e.localidad  = 'Seleccioná una localidad'
      if (!calle.trim())   e.calle      = 'La calle es obligatoria'
      if (!coordsValidas)  e.coordenadas = 'Ajustá el marcador en el mapa a tu ubicación exacta'
      setErrors(e)
      return Object.keys(e).length === 0
    },
  }))

  return (
    <div className={`dir-item${showHeader ? '' : ' dir-item--plain'}`}>
      {/* Encabezado con título y botón de eliminar — solo en modo múltiple */}
      {showHeader && (
        <div className="dir-item__header">
          <span className="dir-item__title">Dirección {index + 1}</span>
          {canRemove && (
            <button
              type="button"
              className="dir-item__remove"
              onClick={onRemove}
              disabled={disabled}
              aria-label={`Eliminar dirección ${index + 1}`}
            >
              ✕ Eliminar
            </button>
          )}
        </div>
      )}

      {/* Provincia */}
      <div className="form-group">
        <label>Provincia <span className="reg-required">*</span></label>
        <CustomSelect
          options={[
            { value: '', label: '— Seleccioná una provincia —' },
            ...provincias.map((p) => ({ value: p.nombre, label: p.nombre })),
          ]}
          value={provincia}
          onChange={(val) => { setProvincia(val); clearError('provincia') }}
          width="100%"
          disabled={disabled}
          className={errors.provincia ? 'error' : ''}
          dropdownMaxHeight={272}
        />
        {errors.provincia && <p className="form-error">{errors.provincia}</p>}
      </div>

      {/* Municipio / Departamento */}
      <div className="form-group">
        <label>Municipio / Departamento <span className="reg-required">*</span></label>
        <CustomSelect
          options={[
            { value: '', label: '— Seleccioná un municipio —' },
            ...municipios.map((m) => ({ value: m.nombre, label: m.nombre })),
          ]}
          value={municipio}
          onChange={(val) => { setMunicipio(val); clearError('municipio') }}
          width="100%"
          disabled={!provincia || disabled}
          className={errors.municipio ? 'error' : ''}
          dropdownMaxHeight={272}
        />
        {errors.municipio && <p className="form-error">{errors.municipio}</p>}
      </div>

      {/* Localidad */}
      <div className="form-group">
        <label>Localidad <span className="reg-required">*</span></label>
        <CustomSelect
          options={[
            { value: '', label: '— Seleccioná una localidad —' },
            ...localidades.map((l) => ({ value: l.nombre, label: l.nombre })),
          ]}
          value={localidad}
          onChange={(val) => { setLocalidad(val); clearError('localidad') }}
          width="100%"
          disabled={!municipio || disabled}
          className={errors.localidad ? 'error' : ''}
          dropdownMaxHeight={272}
        />
        {errors.localidad && <p className="form-error">{errors.localidad}</p>}
      </div>

      {/* Calle + Altura + Botón Buscar */}
      <div className="dir-item__calle-row">
        <div className="form-group dir-item__calle-group">
          <label htmlFor={`dir-calle-${index}`}>Calle <span className="reg-required">*</span></label>
          <input
            id={`dir-calle-${index}`}
            type="text"
            placeholder="Av. Corrientes"
            value={calle}
            onChange={(e) => { setCalle(e.target.value); clearError('calle') }}
            className={errors.calle ? 'error' : ''}
            disabled={!localidad || disabled}
          />
          {errors.calle && <p className="form-error">{errors.calle}</p>}
        </div>
        <div className="form-group dir-item__altura-group">
          <label htmlFor={`dir-altura-${index}`}>Altura</label>
          <div className="dir-item__altura-row">
            <input
              id={`dir-altura-${index}`}
              type="text"
              placeholder="1234"
              value={altura}
              onChange={(e) => setAltura(e.target.value)}
              disabled={!localidad || disabled}
              inputMode="numeric"
            />
            <button
              type="button"
              className="btn dir-item__btn-buscar"
              onClick={handleBuscar}
              disabled={!calle.trim() || !localidad || disabled || buscando}
              title="Buscar dirección"
              aria-label="Buscar dirección"
            >
              {buscando
                ? <span className="spinner spinner-sm" />
                : (
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="11" cy="11" r="8" />
                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                  </svg>
                )
              }
            </button>
          </div>
        </div>
      </div>

      {/* Estado de geocodificación */}
      {geoStatus && (
        <p className="reg-geo-status">{geoStatus}</p>
      )}

      {/* Mapa — aparece cuando tenemos coordenadas */}
      {mapLat && mapLng && (
        <MapaPicker
          lat={mapLat}
          lng={mapLng}
          onChange={handleMapChange}
          zoom={mapZoom}
        />
      )}

      {errors.coordenadas && (
        <p className="form-error" style={{ marginTop: 8 }}>{errors.coordenadas}</p>
      )}

      {/* Aclaración (piso, depto, etc.) */}
      <div className="form-group" style={{ marginTop: 12 }}>
        <label htmlFor={`dir-aclaracion-${index}`}>
          Aclaración
        </label>
        <input
          id={`dir-aclaracion-${index}`}
          type="text"
          placeholder="Piso 3, Depto A"
          value={aclaracion}
          onChange={(e) => setAclaracion(e.target.value)}
          disabled={disabled}
        />
      </div>
    </div>
  )
})

export default DireccionFormItem
