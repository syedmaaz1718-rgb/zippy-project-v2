import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { get, put, post } from './api'
import { useAuth } from './AuthContext'
import { useToast } from './ToastContext'

const Ctx = createContext(null)
const GUEST = 'zippy_guest_cart'
const readGuest = () => JSON.parse(localStorage.getItem(GUEST) || '[]')

// Same numbers as server/pricing.js (server is the source of truth at checkout)
export const bill = (lines) => {
  const subtotal = lines.reduce((s, l) => s + l.price * l.qty, 0)
  const savings = lines.reduce((s, l) => s + (l.mrp - l.price) * l.qty, 0)
  const delivery = subtotal === 0 || subtotal >= 199 ? 0 : 25
  const handling = subtotal === 0 ? 0 : 5
  return { subtotal, savings, delivery, handling, total: subtotal + delivery + handling }
}

export function CartProvider({ children }) {
  const { user, ready } = useAuth()
  const toast = useToast()
  const [lines, setLines] = useState(readGuest)

  // load / merge when auth state changes
  useEffect(() => {
    if (!ready) return
    if (!user) { setLines(readGuest()); return }
    const guest = readGuest()
    const run = guest.length
      ? post('/cart/merge', { items: guest.map((l) => ({ productId: l.product_id, qty: l.qty })) }).then((r) => { localStorage.removeItem(GUEST); return r })
      : get('/cart')
    run.then((r) => setLines(r.items)).catch(() => {})
  }, [user, ready])

  useEffect(() => { if (!user) localStorage.setItem(GUEST, JSON.stringify(lines)) }, [lines, user])

  const setQty = useCallback(async (product, qty) => {
    const id = product.product_id ?? product.id
    if (qty > product.stock) return toast(`Only ${product.stock} in stock`, 'error')
    if (user) {
      try { setLines((await put(`/cart/items/${id}`, { qty })).items) } catch (e) { toast(e.message, 'error') }
    } else {
      setLines((cur) => {
        const rest = cur.filter((l) => l.product_id !== id)
        return qty > 0 ? [...rest, { product_id: id, name: product.name, emoji: product.emoji, price: product.price, mrp: product.mrp, unit: product.unit, stock: product.stock, qty }] : rest
      })
    }
  }, [user, toast])

  const qtyOf = (id) => lines.find((l) => l.product_id === id)?.qty || 0
  const value = {
    lines, ...bill(lines),
    count: lines.reduce((s, l) => s + l.qty, 0),
    qty: qtyOf,
    add: (p) => setQty(p, qtyOf(p.id ?? p.product_id) + 1),
    remove: (p) => setQty(p, qtyOf(p.id ?? p.product_id) - 1),
    addMany: async (items) => { for (const it of items) await setQty(it, qtyOf(it.id) + it.qty) },
    clear: () => setLines([]),
    reload: () => user && get('/cart').then((r) => setLines(r.items)),
  }
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
export const useCart = () => useContext(Ctx)
