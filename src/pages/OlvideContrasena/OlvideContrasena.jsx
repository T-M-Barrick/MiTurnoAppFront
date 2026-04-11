import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useTheme } from '../../context/ThemeContext'
import { authService } from '../../services/authService'
import { validateEmail } from '../../utils/validation'
import ErrorModal from '../../components/ErrorModal/ErrorModal'
import logoMiturno from '../../assets/logo-miturno.png'
import '../Login/Login.css'
import './OlvideContrasena.css'

/**
 * Página de recuperación de contraseña — paso 1.
 * El usuario ingresa su email y el back envía un link con token (siempre 204).
 */
export default function OlvideContrasena() {
  const { theme, toggleTheme } = useTheme()

  const [email,     setEmail]     = useState('')
  const [error,     setError]     = useState(null)
  const [loading,   setLoading]   = useState(false)
  const [sent,      setSent]      = useState(false)
  const [backError, setBackError] = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    const emailErr = validateEmail(email)
    if (emailErr) { setError(emailErr); return }
    setError(null)
    setLoading(true)
    try {
      await authService.forgotPasswordEmail(email.trim().toLowerCase())
      setSent(true)
    } catch (err) {
      setBackError(err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-page">
      {/* Botón tema */}
      <button className="login-page__theme" onClick={toggleTheme} aria-label="Cambiar tema">
        {theme === 'dark' ? '☀️' : '🌙'}
      </button>

      {/* Panel izquierdo */}
      <div className="login-left">
        <img
          src={logoMiturno}
          alt="MiTurno"
          className="login-left__logo"
          onError={(e) => { e.target.style.display = 'none' }}
        />
        <p className="login-left__tagline">Recuperá tu contraseña</p>
        <p className="login-left__sub">
          Te enviamos un link a tu email para que puedas crear una nueva contraseña.
        </p>
      </div>

      {/* Panel derecho */}
      <div className="login-right">
        <div className="login-card">
          <h2 className="login-card__title">Olvidé mi contraseña</h2>

          {sent ? (
            /* Estado: email enviado */
            <div className="olvide-sent">
              <span className="olvide-sent__icon">📬</span>
              <p className="olvide-sent__text">
                Si tu email está registrado, recibirás un link para restablecer tu contraseña en los próximos minutos.
              </p>
              <Link to="/" className="btn olvide-sent__btn">
                Volver al inicio
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} noValidate>
              <div className="form-group">
                <label htmlFor="olvide-email">Email</label>
                <input
                  id="olvide-email"
                  type="email"
                  autoComplete="email"
                  placeholder="tucorreo@ejemplo.com"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setError(null) }}
                  className={error ? 'error' : ''}
                  disabled={loading}
                />
                {error && <p className="form-error">{error}</p>}
              </div>

              <div className="olvide-actions">
                <Link to="/" className="btn olvide-actions__btn olvide-actions__btn--back">
                  Volver
                </Link>
                <button
                  type="submit"
                  className="btn olvide-actions__btn olvide-actions__btn--confirm"
                  disabled={loading}
                >
                  {loading ? <><span className="spinner spinner-sm" /> Enviando…</> : 'Enviar'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>

      <ErrorModal error={backError} onClose={() => setBackError(null)} />
    </div>
  )
}
