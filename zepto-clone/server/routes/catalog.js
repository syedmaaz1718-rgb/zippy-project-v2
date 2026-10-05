import { Router } from 'express'
import { db } from '../db.js'
import { razorpayEnabled, RAZORPAY_KEY_ID } from '../config.js'

const r = Router()

// search-as-you-type suggestions
r.get('/suggest', (req, res) => {
  const q = String(req.query.q || '').trim()
  if (q.length < 1) return res.json([])
  res.json(db.prepare('SELECT id,name,emoji,price FROM products WHERE active=1 AND name LIKE ? ORDER BY name LIMIT 6').all(`%${q}%`))
})

r.get('/config', (_req, res) => res.json({ razorpay: razorpayEnabled() ? { keyId: RAZORPAY_KEY_ID } : null }))

r.get('/categories', (_req, res) => {
  res.json(db.prepare('SELECT * FROM categories').all())
})

r.get('/products', (req, res) => {
  const { category, q, sort, tag } = req.query
  const where = ['active=1']
  const args = []
  if (category) { where.push('category_id=?'); args.push(category) }
  if (q) { where.push('name LIKE ?'); args.push(`%${q}%`) }
  if (tag === 'latenight') where.push('late_night=1')
  if (tag === 'deals') { where.push('mrp>price') }
  const order = { price_asc: 'price ASC', price_desc: 'price DESC', rating: 'rating DESC', discount: '(mrp-price)*1.0/mrp DESC' }[sort] || (tag === 'deals' ? '(mrp-price)*1.0/mrp DESC' : 'id ASC')
  const lim = Math.min(Number(req.query.limit) || 200, 200)
  res.json(db.prepare(`SELECT id,name,category_id AS category,emoji,price,mrp,unit,stock,late_night AS lateNight,(SELECT ROUND(AVG(rating),1) FROM reviews WHERE product_id=products.id) AS rating,(SELECT COUNT(*) FROM reviews WHERE product_id=products.id) AS reviews FROM products WHERE ${where.join(' AND ')} ORDER BY ${order} LIMIT ${lim}`).all(...args))
})

r.get('/products/:id', (req, res) => {
  const p = db.prepare('SELECT id,name,category_id AS category,emoji,price,mrp,unit,stock,late_night AS lateNight,(SELECT ROUND(AVG(rating),1) FROM reviews WHERE product_id=products.id) AS rating,(SELECT COUNT(*) FROM reviews WHERE product_id=products.id) AS reviews FROM products WHERE id=? AND active=1').get(req.params.id)
  if (!p) return res.status(404).json({ error: 'Product not found' })
  const similar = db.prepare('SELECT id,name,category_id AS category,emoji,price,mrp,unit,stock FROM products WHERE category_id=? AND id!=? AND active=1 LIMIT 6').all(p.category, p.id)
  res.json({ ...p, similar })
})

export default r
