import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { invitacionesService } from '../../services/invitacionesService'
import { parseBackendError } from '../../utils/errorMessages'
import '../../styles/ve-card.css'

// Mapeo de roles a texto legible en español
const getRolLabel = (rol, cantidadSucursales) => {
  if (rol === 'GERENTE_EMPRESA' && cantidadSucursales === 1) return 'Gerente'
  const labels = {
    PROPIETARIO:      'Propietario',
    GERENTE_EMPRESA:  'Gerente de Empresa',
    GERENTE_SUCURSAL: 'Gerente de Sucursal',
    EMPLEADO:         'Empleado',
  }
  return labels[rol] ?? rol
}

export default function AceptarInvitacion() {
  const navigate = useNavigate()
  const [status, setStatus] = useState('loading') // 'loading' | 'success' | 'error'
  const [datos, setDatos]   = useState(null)      // { nombre, rol }
  const [mensaje, setMensaje] = useState('')

  useEffect(() => {
    const params = new URLSearchParams(window.location.hash.split('?')[1] || '')
    const token  = params.get('token')

    if (!token) {
      setStatus('error')
      setMensaje('El enlace de invitación no es válido.')
      return
    }

    invitacionesService.aceptar(token)
      .then((data) => {
        setDatos(data)
        setStatus('success')
      })
      .catch((err) => {
        setStatus('error')
        setMensaje(parseBackendError(err))
      })
  }, [])

  return (
    <div className="ve-page">
      <div className="ve-card">
        <img src="/logo-miturno.png" alt="MiTurno" className="ve-logo" />

        {status === 'loading' && (
          <>
            <div className="spinner ve-spinner" />
            <p className="ve-text">Procesando invitación…</p>
          </>
        )}

        {status === 'success' && datos && (
          <>
            <div className="ve-icon ve-icon--ok">✓</div>
            <h1 className="ve-title">¡Bienvenido al equipo!</h1>
            <p className="ve-text">
              Fuiste incorporado como <strong>{getRolLabel(datos.rol, datos.cantidad_sucursales)}</strong> en{' '}
              <strong>{datos.nombre}</strong>.
            </p>
            <button className="btn btn-primary" onClick={() => navigate('/home')}>
              Ir al inicio
            </button>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="ve-icon ve-icon--err">✕</div>
            <h1 className="ve-title">Invitación inválida</h1>
            <p className="ve-text">{mensaje}</p>
            <button className="btn btn-primary" onClick={() => navigate('/')}>
              Ir al inicio
            </button>
          </>
        )}
      </div>
    </div>
  )
}
