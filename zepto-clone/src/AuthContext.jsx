import { createContext, useContext, useEffect, useState } from 'react'
import { get, post, setToken, getToken } from './api'

const Ctx = createContext(null)
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [ready, setReady] = useState(false)
  useEffect(() => {
    if (!getToken()) return setReady(true)
    get('/auth/me').then((r) => setUser(r.user)).catch(() => setToken(null)).finally(() => setReady(true))
  }, [])
  const finish = (r) => { setToken(r.token); setUser(r.user); return r.user }
  const value = {
    user, ready,
    login: async (email, password) => finish(await post('/auth/login', { email, password })),
    register: async (f) => finish(await post('/auth/register', f)),
    logout: () => { setToken(null); setUser(null) },
  }
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
export const useAuth = () => useContext(Ctx)
