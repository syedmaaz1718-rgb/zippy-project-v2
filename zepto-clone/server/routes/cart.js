import { Router } from 'express'
import { db } from '../db.js'
import { requireAuth } from '../auth.js'
import { priceCart } from '../pricing.js'

const r = Router()
r.use(requireAuth)

export function loadCart(userId) {
  return db.prepare(`SELECT p.id AS product_id, p.name, p.emoji, p.price, p.mrp, p.unit, p.stock, c.qty
    FROM cart_items c JOIN products p ON p.id=c.product_id WHERE c.user_id=? AND p.active=1 ORDER BY p.id`).all(userId)
}
const view = (userId, coupon) => {
  const items = loadCart(userId)
  return { items, bill: priceCart(items, coupon, userId) }
}

r.get('/', (req, res) => res.json(view(req.user.id, req.query.coupon)))

// set absolute quantity (0 removes)
r.put('/items/:productId', (req, res) => {
  const qty = Number(req.body?.qty)
  if (!Number.isInteger(qty) || qty < 0) return res.status(400).json({ error: 'Invalid quantity' })
  const p = db.prepare('SELECT id,stock FROM products WHERE id=? AND active=1').get(req.params.productId)
  if (!p) return res.status(404).json({ error: 'Product not found' })
  if (qty > p.stock) return res.status(400).json({ error: `Only ${p.stock} left in stock` })
  if (qty === 0) db.prepare('DELETE FROM cart_items WHERE user_id=? AND product_id=?').run(req.user.id, p.id)
  else db.prepare(`INSERT INTO cart_items (user_id,product_id,qty) VALUES (?,?,?)
    ON CONFLICT(user_id,product_id) DO UPDATE SET qty=excluded.qty`).run(req.user.id, p.id, qty)
  res.json(view(req.user.id, req.body?.coupon))
})

// merge a guest cart after login: [{productId, qty}]
r.post('/merge', (req, res) => {
  const lines = Array.isArray(req.body?.items) ? req.body.items : []
  const tx = db.transaction(() => {
    for (const l of lines) {
      const p = db.prepare('SELECT id,stock FROM products WHERE id=? AND active=1').get(l.productId)
      if (!p || !(l.qty > 0)) continue
      const cur = db.prepare('SELECT qty FROM cart_items WHERE user_id=? AND product_id=?').get(req.user.id, p.id)?.qty || 0
      const qty = Math.min(p.stock, cur + Math.floor(l.qty))
      db.prepare(`INSERT INTO cart_items (user_id,product_id,qty) VALUES (?,?,?)
        ON CONFLICT(user_id,product_id) DO UPDATE SET qty=excluded.qty`).run(req.user.id, p.id, qty)
    }
  })
  tx()
  res.json(view(req.user.id))
})

r.delete('/', (req, res) => {
  db.prepare('DELETE FROM cart_items WHERE user_id=?').run(req.user.id)
  res.json(view(req.user.id))
})

export default r
