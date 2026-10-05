import { createContext, useContext, useEffect, useState } from 'react'
import { get, put, del } from './api'
import { useAuth } from './AuthContext'
import { useToast } from './ToastContext'
import { useNavigate } from 'react-router-dom'

const Ctx = createContext(null)
export function WishlistProvider({ children }) {
  const { user } = useAuth()
  const toast = useToast()
  const nav = useNavigate()
  const [ids, setIds] = useState(new Set())
  useEffect(() => {
    if (!user) return setIds(new Set())
    get('/wishlist').then((r) => setIds(new Set(r.map((p) => p.id)))).catch(() => {})
  }, [user])
  const toggle = async (id) => {
    if (!user) { toast('Login to save items'); return nav('/login') }
    const on = ids.has(id)
    const next = new Set(ids)
    on ? next.delete(id) : next.add(id)
    setIds(next)
    try { on ? await del('/wishlist/' + id) : await put('/wishlist/' + id) } catch (e) { toast(e.message, 'error') }
  }
  return <Ctx.Provider value={{ has: (id) => ids.has(id), toggle }}>{children}</Ctx.Provider>
}
export const useWishlist = () => useContext(Ctx)
