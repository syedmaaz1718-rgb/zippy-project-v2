import { Router } from 'express'
import { db } from '../db.js'
import { requireAuth } from '../auth.js'

const r = Router()
r.use(requireAuth)

r.get('/', (req, res) => {
  res.json(db.prepare(`SELECT p.id,p.name,p.category_id AS category,p.emoji,p.price,p.mrp,p.unit,p.stock FROM wishlist w
    JOIN products p ON p.id=w.product_id WHERE w.user_id=? AND p.active=1`).all(req.user.id))
})
r.put('/:productId', (req, res) => {
  if (!db.prepare('SELECT 1 FROM products WHERE id=?').get(req.params.productId)) return res.status(404).json({ error: 'Product not found' })
  db.prepare('INSERT OR IGNORE INTO wishlist (user_id,product_id) VALUES (?,?)').run(req.user.id, req.params.productId)
  res.json({ ok: true })
})
r.delete('/:productId', (req, res) => {
  db.prepare('DELETE FROM wishlist WHERE user_id=? AND product_id=?').run(req.user.id, req.params.productId)
  res.json({ ok: true })
})
export default r
