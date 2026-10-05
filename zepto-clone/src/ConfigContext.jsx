import { createContext, useContext, useEffect, useState } from 'react'
import { get } from './api'

const Ctx = createContext({ razorpay: null, theme: 'green', setTheme: () => {} })
export function ConfigProvider({ children }) {
  const [cfg, setCfg] = useState({ razorpay: null })
  const [theme, setThemeState] = useState(localStorage.getItem('zippy_theme') || 'green')
  useEffect(() => { get('/config').then(setCfg).catch(() => {}) }, [])
  useEffect(() => { document.documentElement.setAttribute('data-theme', theme) }, [theme])
  const setTheme = (t) => { localStorage.setItem('zippy_theme', t); setThemeState(t) }
  return <Ctx.Provider value={{ ...cfg, theme, setTheme }}>{children}</Ctx.Provider>
}
export const useConfig = () => useContext(Ctx)
