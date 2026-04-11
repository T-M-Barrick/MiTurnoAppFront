import { useState } from 'react'
import { Link, useSearchParams, useNavigate } from 'react-router-dom'
import { useTheme } from '../../context/ThemeContext'
import { authService } from '../../services/authService'
import { validatePassword } from '../../utils/validation'
import ErrorModal from '../../components/ErrorModal/ErrorModal'
import logoMiturno from '../../assets/logo-miturno.png'
import '../Login/Login.css'
import './ResetearContrasena.css'

/**
 * Página de recuperación de contraseña — paso 2.
 * Recibe el token por query param (?token=...) y permite ingresar la nueva contraseña.
 */
export default function ResetearContrasena() {
  const { theme, toggleTheme } = useTheme()
  const navigate        = useNavigate()
  const [searchParams]  = useSearchParams()
  const token           = searchParams.get('token') ?? ''

  const [newPassword,     setNewPassword]     = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showNew,         setShowNew]         = useState(false)
  const [showConfirm,     setShowConfirm]     = useState(false)
  const [errors,          setErrors]          = useState({})
  const [loading,         setLoading]         = useState(false)
  const [done,            setDone]            = useState(false)
  const [backError,       setBackError]       = useState(null)

  const validate = () => {
    const e = {}
    const passErr = validatePassword(newPassword)
    if (passErr) e.newPassword = passErr
    if (!confirmPassword) {
      e.confirmPassword = 'Confirmá tu contraseña'
    } else if (newPassword !== confirmPassword) {
      e.confirmPassword = 'Las contraseñas no coinciden'
    }
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!validate()) return
    setLoading(true)
    try {
      await authService.resetPasswordEmail(token, newPassword)
      setDone(true)
    } catch (err) {
      setBackError(err)
    } finally {
      setLoading(false)
    }
  }

  // Si no hay token en la URL, mostrar error de enlace inválido
  const tokenInvalido = !token

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
        <p className="login-left__tagline">Nueva contraseña</p>
        <p className="login-left__sub">
          Elegí una contraseña segura de al menos 8 caracteres con letras y números.
        </p>
      </div>

      {/* Panel derecho */}
      <div className="login-right">
        <div className="login-card">
          <h2 className="login-card__title">Restablecer contraseña</h2>

          {tokenInvalido ? (
            /* Enlace sin token */
            <div className="reset-state">
              <span className="reset-state__icon">⚠️</span>
              <p className="reset-state__text">
                El enlace no es válido o ya fue utilizado. Solicitá uno nuevo desde la pantalla de inicio.
              </p>
              <Link to="/olvide-contrasena" className="btn btn-primary" style={{ marginTop: '8px' }}>
                Solicitar nuevo enlace
              </Link>
            </div>
          ) : done ? (
            /* Contraseña restablecida con éxito */
            <div className="reset-state">
              <span className="reset-state__icon">✅</span>
              <p className="reset-state__text">
                ¡Tu contraseña fue restablecida exitosamente! Ya podés iniciar sesión con tu nueva contraseña.
              </p>
              <button
                className="btn btn-primary"
                style={{ marginTop: '8px' }}
                onClick={() => navigate('/', { replace: true })}
              >
                Iniciar sesión
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} noValidate>
              {/* Nueva contraseña */}
              <div className="form-group">
                <label htmlFor="reset-new">Nueva contraseña</label>
                <div className="password-wrapper">
                  <input
                    id="reset-new"
                    type={showNew ? 'text' : 'password'}
                    autoComplete="new-password"
                    placeholder="••••••••"
                    value={newPassword}
                    onChange={(e) => { setNewPassword(e.target.value); setErrors((p) => ({ ...p, newPassword: null })) }}
                    className={errors.newPassword ? 'error' : ''}
                    disabled={loading}
                  />
                  <button type="button" className="eye-btn" onClick={() => setShowNew(v => !v)} tabIndex={-1} aria-label="Mostrar contraseña">
                    {showNew ? '🙈' : '👁️'}
                  </button>
                </div>
                {errors.newPassword && <p className="form-error">{errors.newPassword}</p>}
              </div>

              {/* Confirmar contraseña */}
              <div className="form-group">
                <label htmlFor="reset-confirm">Confirmá la contraseña</label>
                <div className="password-wrapper">
                  <input
                    id="reset-confirm"
                    type={showConfirm ? 'text' : 'password'}
                    autoComplete="new-password"
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={(e) => { setConfirmPassword(e.target.value); setErrors((p) => ({ ...p, confirmPassword: null })) }}
                    className={errors.confirmPassword ? 'error' : ''}
                    disabled={loading}
                  />
                  <button type="button" className="eye-btn" onClick={() => setShowConfirm(v => !v)} tabIndex={-1} aria-label="Mostrar contraseña">
                    {showConfirm ? '🙈' : '👁️'}
                  </button>
                </div>
                {errors.confirmPassword && <p className="form-error">{errors.confirmPassword}</p>}
              </div>

              <button type="submit" className="btn btn-primary" disabled={loading}>
                {loading ? <><span className="spinner spinner-sm" /> Guardando…</> : 'Guardar contraseña'}
              </button>

              <Link to="/" className="login-card__forgot">
                Volver al inicio de sesión
              </Link>
            </form>
          )}
        </div>
      </div>

      <ErrorModal error={backError} onClose={() => setBackError(null)} />
    </div>
  )
}
