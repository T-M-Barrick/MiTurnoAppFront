import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useTheme } from '../../context/ThemeContext'
import { validateEmail, validatePassword } from '../../utils/validation'
import ErrorModal from '../../components/ErrorModal/ErrorModal'
import logoMiturno from '../../assets/logo-miturno.png'
import './Login.css'

// Frases que se escriben solas en el panel izquierdo
const FRASES = [
  'Reservá tus turnos en segundos.',
  'Tu tiempo, mejor administrado.',
  'Empresas que respetan tu agenda.',
  'Más organización, menos esperas.',
  'Todo en un solo lugar.',
]

// Hook de efecto typewriter (escribe/borra en loop)
function useTypewriter(phrases, speed = 55, pause = 1800) {
  const [displayed, setDisplayed] = useState('')
  const [phraseIdx, setPhraseIdx] = useState(0)
  const [charIdx, setCharIdx]     = useState(0)
  const [deleting, setDeleting]   = useState(false)

  useEffect(() => {
    const current = phrases[phraseIdx]

    const timeout = setTimeout(() => {
      if (!deleting) {
        // Escribiendo
        setDisplayed(current.slice(0, charIdx + 1))
        if (charIdx + 1 === current.length) {
          // Terminó de escribir → pausa antes de borrar
          setTimeout(() => setDeleting(true), pause)
        } else {
          setCharIdx((i) => i + 1)
        }
      } else {
        // Borrando
        setDisplayed(current.slice(0, charIdx - 1))
        if (charIdx - 1 === 0) {
          setDeleting(false)
          setCharIdx(0)
          setPhraseIdx((i) => (i + 1) % phrases.length)
        } else {
          setCharIdx((i) => i - 1)
        }
      }
    }, deleting ? speed / 2 : speed)

    return () => clearTimeout(timeout)
  }, [charIdx, deleting, phraseIdx, phrases, speed, pause])

  return displayed
}

export default function Login() {
  const { login } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const navigate = useNavigate()

  const [email, setEmail]           = useState('')
  const [password, setPassword]     = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [errors, setErrors]         = useState({})
  const [loading, setLoading]       = useState(false)
  const [backError, setBackError]   = useState(null)

  const typewritten = useTypewriter(FRASES)

  const validate = () => {
    const e = {}
    const emailErr = validateEmail(email)
    const passErr  = validatePassword(password)
    if (emailErr) e.email    = emailErr
    if (passErr)  e.password = passErr
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!validate()) return
    setLoading(true)
    setBackError(null)
    try {
      await login(email.trim().toLowerCase(), password)
      navigate('/home', { replace: true })
    } catch (err) {
      setBackError(err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-page">
      {/* Botón tema — esquina superior derecha */}
      <button
        className="login-page__theme"
        onClick={toggleTheme}
        aria-label="Cambiar tema"
      >
        {theme === 'dark' ? '☀️' : '🌙'}
      </button>

      {/* Panel izquierdo — logo + descripción animada */}
      <div className="login-left">
        <img
          src={logoMiturno}
          alt="MiTurno"
          className="login-left__logo"
          onError={(e) => { e.target.style.display = 'none' }}
        />
        <p className="login-left__tagline">
          {typewritten}
          <span className="login-left__cursor" aria-hidden="true">|</span>
        </p>
        <p className="login-left__sub">
          La plataforma que conecta personas con empresas de forma simple y eficiente.
        </p>
      </div>

      {/* Panel derecho — formulario */}
      <div className="login-right">
        <div className="login-card">
          <h2 className="login-card__title">Iniciar sesión</h2>

          <form onSubmit={handleSubmit} noValidate>
            {/* Email */}
            <div className="form-group">
              <label htmlFor="login-email">Email</label>
              <input
                id="login-email"
                type="email"
                autoComplete="email"
                placeholder="tucorreo@ejemplo.com"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setErrors((prev) => ({ ...prev, email: null })) }}
                className={errors.email ? 'error' : ''}
                disabled={loading}
              />
              {errors.email && <p className="form-error">{errors.email}</p>}
            </div>

            {/* Contraseña */}
            <div className="form-group">
              <label htmlFor="login-password">Contraseña</label>
              <div className="password-wrapper">
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setErrors((prev) => ({ ...prev, password: null })) }}
                  className={errors.password ? 'error' : ''}
                  disabled={loading}
                />
                <button type="button" className="eye-btn" onClick={() => setShowPassword((v) => !v)} tabIndex={-1} aria-label="Mostrar contraseña">
                  {showPassword ? '🙈' : '👁️'}
                </button>
              </div>
              {errors.password && <p className="form-error">{errors.password}</p>}
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading}
            >
              {loading ? <><span className="spinner spinner-sm" /> Ingresando…</> : 'Ingresar'}
            </button>
          </form>

          <div className="login-card__divider">¿No tenés cuenta?</div>

          <Link to="/registro" className="btn btn-secondary" target="_self">
            Crear cuenta
          </Link>

          <Link to="/olvide-contrasena" className="login-card__forgot">
            ¿Olvidaste tu contraseña?
          </Link>
        </div>
      </div>

      {/* Modal de error del back */}
      <ErrorModal error={backError} onClose={() => setBackError(null)} />
    </div>
  )
}
