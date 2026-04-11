import { useEffect, useRef, useState } from 'react'
import './MapaPicker.css'

/**
 * Mapa de Leaflet (cargado desde CDN en index.html como window.L).
 * Muestra un marcador draggable en las coordenadas dadas.
 * Al clickear el mapa o arrastrar el marcador, llama a onChange(lat, lng).
 *
 * Props:
 *   lat      — latitud inicial (número o string)
 *   lng      — longitud inicial (número o string)
 *   onChange — callback (lat: number, lng: number) => void
 */
// zoom: nivel de zoom inicial (16 = calle, 5 = país)
export default function MapaPicker({ lat, lng, onChange, zoom = 16 }) {
  const containerRef = useRef(null)
  const mapRef       = useRef(null)
  const markerRef    = useRef(null)
  const [mapaError, setMapaError] = useState(null)

  // Inicializa el mapa una sola vez cuando el componente monta (siempre tiene lat/lng)
  useEffect(() => {
    const L = window.L
    if (!L) { setMapaError('Leaflet no está disponible. Verificá tu conexión.'); return }
    if (!containerRef.current) return

    const parsedLat = parseFloat(lat)
    const parsedLng = parseFloat(lng)

    // Fix para íconos de marcador que no cargan en Vite (rutas rotas en el bundle)
    delete L.Icon.Default.prototype._getIconUrl
    L.Icon.Default.mergeOptions({
      iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
      iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
      shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    })

    const map = L.map(containerRef.current).setView([parsedLat, parsedLng], zoom)

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map)

    // Marcador draggable
    const marker = L.marker([parsedLat, parsedLng], { draggable: true }).addTo(map)

    marker.on('dragend', () => {
      const pos = marker.getLatLng()
      onChange(pos.lat, pos.lng)
    })

    // Click en el mapa mueve el marcador
    map.on('click', (e) => {
      marker.setLatLng(e.latlng)
      onChange(e.latlng.lat, e.latlng.lng)
    })

    mapRef.current    = map
    markerRef.current = marker

    // Forzar recalculo de tamaño por si el contenedor no tenía dimensiones al montar
    setTimeout(() => { map.invalidateSize() }, 150)

    // Cleanup al desmontar
    return () => {
      map.remove()
      mapRef.current    = null
      markerRef.current = null
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps — init solo una vez

  // Actualiza posición del marcador cuando lat/lng cambian externamente
  useEffect(() => {
    if (!mapRef.current || !markerRef.current) return
    const pos = [parseFloat(lat), parseFloat(lng)]
    markerRef.current.setLatLng(pos)
    mapRef.current.flyTo(pos, 16, { animate: true, duration: 0.6 })
  }, [lat, lng])

  if (mapaError) return (
    <div className="mapa-wrapper">
      <div className="mapa-error">{mapaError}</div>
    </div>
  )

  return (
    <div className="mapa-wrapper">
      <div ref={containerRef} className="mapa-container" />
      <p className="mapa-hint">
        📍 Hacé clic en el mapa o arrastrá el marcador para ajustar la ubicación exacta
      </p>
    </div>
  )
}
