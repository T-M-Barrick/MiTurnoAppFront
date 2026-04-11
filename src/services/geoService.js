import { api } from './api'

export const geoService = {
  // GET /georef/provincias → lista de provincias [{id, nombre}]
  getProvincias: () =>
    api.get('/georef/provincias'),

  // GET /georef/departamentos?provincia=X → lista de departamentos/municipios
  getDepartamentos: (provincia) =>
    api.get(`/georef/departamentos?provincia=${encodeURIComponent(provincia)}`),

  // GET /georef/localidades?provincia=X&municipio=Y → lista de localidades
  getLocalidades: (provincia, municipio) =>
    api.get(
      `/georef/localidades?provincia=${encodeURIComponent(provincia)}&municipio=${encodeURIComponent(municipio)}`
    ),

  // GET /georef/coordenadas?... → {lat, lng} (y opcionalmente calle)
  // Si se pasan calle y altura → búsqueda precisa
  // Si solo se pasa localidad → centro de la localidad
  getCoordenadas: (params) => {
    const qs = new URLSearchParams(
      Object.fromEntries(Object.entries(params).filter(([, v]) => v != null && v !== ''))
    ).toString()
    return api.get(`/georef/coordenadas?${qs}`)
  },
}
