import { createContext, useContext, useEffect, useState } from 'react'

const ThemeContext = createContext()

export function ThemeProvider({ children }) {
  // Lee el tema guardado o usa el preferido por el sistema operativo
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem('miturno_theme')
    if (saved) return saved
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  })

  // Aplica el atributo data-theme en el elemento <html> para que el CSS lo tome
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('miturno_theme', theme)
  }, [theme])

  const toggleTheme = () => setTheme(t => (t === 'light' ? 'dark' : 'light'))

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  return useContext(ThemeContext)
}
