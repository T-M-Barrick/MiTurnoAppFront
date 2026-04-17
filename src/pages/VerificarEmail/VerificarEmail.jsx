import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../../services/api'
import { parseBackendError } from '../../utils/errorMessages'
import '../../styles/ve-card.css'

export default function VerificarEmail() {
  const navigate = useNavigate()
  const [status, setStatus] = useState('loading') // 'loading' | 'success' | 'error'
  const [mensaje, setMensaje] = useState('')

  // Leemos tipo una vez — la URL no cambia durante el ciclo de vida del componente
  const urlParams = new URLSearchParams(window.location.hash.split('?')[1] || '')
  const tipoUrl   = urlParams.get('tipo') // 'usuario' | 'empresa'

  useEffect(() => {
    // Tomamos tipo y token de la query string: /#/verificar-email?tipo=usuario&token=XXX
    const params = new URLSearchParams(window.location.hash.split('?')[1] || '')
    const token = params.get('token')
    const tipo  = params.get('tipo') // 'usuario' | 'empresa'

    if (!token) {
      setStatus('error')
      setMensaje('El enlace de verificación no es válido.')
      return
    }

    const endpoint = tipo === 'empresa'
      ? `/empresas/verificacion/email?token=${encodeURIComponent(token)}`
      : `/usuarios/verificacion/email?token=${encodeURIComponent(token)}`

    api.get(endpoint)
      .then(() => {
        setStatus('success')
        setMensaje(
          tipo === 'empresa'
            ? '¡El email de tu empresa fue verificado correctamente!'
            : '¡Tu email fue verificado correctamente! Ya podés iniciar sesión.'
        )
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
            <p className="ve-text">Verificando tu email…</p>
          </>
        )}

        {status === 'success' && (
          <>
            <div className="ve-icon ve-icon--ok">✓</div>
            <h1 className="ve-title">✅ Email verificado</h1>
            <p className="ve-text">{mensaje}</p>
            <button
              className="ve-btn"
              onClick={() => navigate(tipoUrl === 'empresa' ? '/home' : '/')}
            >
              Ir al inicio
            </button>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="ve-icon ve-icon--err">✕</div>
            <h1 className="ve-title">❌ Verificación fallida</h1>
            <p className="ve-text">{mensaje}</p>
            <button className="ve-btn" onClick={() => navigate('/')}>
              Ir al inicio
            </button>
          </>
        )}
      </div>
    </div>
  )
}
