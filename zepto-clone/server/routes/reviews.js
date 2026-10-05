import { Router } from 'express'
import { db } from '../db.js'
import { requireAuth } from '../auth.js'

const r = Router()

r.get('/:productId', (req, res) => {
  const reviews = db.prepare(`SELECT r.id,r.rating,r.comment,r.created_at,u.name FROM reviews r JOIN users u ON u.id=r.user_id
    WHERE r.product_id=? ORDER BY r.id DESC LIMIT 50`).all(req.params.productId)
  const summary = db.prepare('SELECT ROUND(AVG(rating),1) avg, COUNT(*) count FROM reviews WHERE product_id=?').get(req.params.productId)
  const dist = db.prepare('SELECT rating, COUNT(*) c FROM reviews WHERE product_id=? GROUP BY rating').all(req.params.productId)
  res.json({ summary, dist, reviews })
})

// Only customers who received this product (delivered order) can review it. One review per product, editable.
r.post('/:productId', requireAuth, (req, res) => {
  const rating = Number(req.body?.rating)
  const comment = String(req.body?.comment || '').trim().slice(0, 500)
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) return res.status(400).json({ error: 'Pick 1 to 5 stars' })
  const bought = db.prepare(`SELECT 1 FROM order_items oi JOIN orders o ON o.id=oi.order_id
    WHERE oi.product_id=? AND o.status='delivered' AND (oi.user_id=? OR o.user_id=?) LIMIT 1`).get(req.params.productId, req.user.id, req.user.id)
  if (!bought) return res.status(403).json({ error: 'You can review a product after it has been delivered to you' })
  db.prepare(`INSERT INTO reviews (product_id,user_id,rating,comment) VALUES (?,?,?,?)
    ON CONFLICT(product_id,user_id) DO UPDATE SET rating=excluded.rating, comment=excluded.comment, created_at=CURRENT_TIMESTAMP`).run(req.params.productId, req.user.id, rating, comment)
  res.status(201).json({ ok: true })
})

// can the current user review? (used by the UI to show the form)
r.get('/:productId/can-review', requireAuth, (req, res) => {
  const bought = db.prepare(`SELECT 1 FROM order_items oi JOIN orders o ON o.id=oi.order_id
    WHERE oi.product_id=? AND o.status='delivered' AND (oi.user_id=? OR o.user_id=?) LIMIT 1`).get(req.params.productId, req.user.id, req.user.id)
  const mine = db.prepare('SELECT rating,comment FROM reviews WHERE product_id=? AND user_id=?').get(req.params.productId, req.user.id)
  res.json({ canReview: !!bought, mine: mine || null })
})
export default r
