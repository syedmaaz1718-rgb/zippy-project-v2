import { Router } from 'express'
import { db } from '../db.js'
import { requireAuth, requireAdmin } from '../auth.js'
import { setOrderStatus } from '../orderService.js'

const r = Router()
r.use(requireAuth, requireAdmin)

r.get('/stats', (_req, res) => {
  const one = (sql) => db.prepare(sql).get()
  res.json({
    orders: one("SELECT COUNT(*) c FROM orders").c,
    revenue: one("SELECT COALESCE(SUM(total),0) s FROM orders WHERE status NOT IN ('cancelled','payment_pending')").s,
    customers: one("SELECT COUNT(*) c FROM users WHERE role='customer'").c,
    lowStock: db.prepare('SELECT id,name,stock FROM products WHERE stock<=10 AND active=1 ORDER BY stock').all(),
    byStatus: db.prepare('SELECT status, COUNT(*) c FROM orders GROUP BY status').all(),
    topProducts: db.prepare(`SELECT name, SUM(qty) sold FROM order_items oi JOIN orders o ON o.id=oi.order_id
      WHERE o.status NOT IN ('cancelled','payment_pending') GROUP BY name ORDER BY sold DESC LIMIT 5`).all(),
  })
})

r.get('/products', (_req, res) => {
  res.json(db.prepare('SELECT id,name,category_id AS category,emoji,price,mrp,unit,stock,active FROM products ORDER BY id DESC').all())
})

function validProduct(b) {
  const price = Number(b.price), mrp = Number(b.mrp), stock = Number(b.stock)
  if (!b.name?.trim()) return 'Name required'
  if (!db.prepare('SELECT 1 FROM categories WHERE id=?').get(b.category)) return 'Unknown category'
  if (!(price > 0) || !(mrp >= price)) return 'Price must be > 0 and MRP >= price'
  if (!Number.isInteger(stock) || stock < 0) return 'Stock must be a whole number'
  return null
}

r.post('/products', (req, res) => {
  const err = validProduct(req.body || {})
  if (err) return res.status(400).json({ error: err })
  const b = req.body
  const info = db.prepare('INSERT INTO products (name,category_id,emoji,price,mrp,unit,stock) VALUES (?,?,?,?,?,?,?)')
    .run(b.name.trim(), b.category, b.emoji || '📦', Number(b.price), Number(b.mrp), b.unit || '', Number(b.stock))
  res.status(201).json({ id: info.lastInsertRowid })
})

r.put('/products/:id', (req, res) => {
  const err = validProduct(req.body || {})
  if (err) return res.status(400).json({ error: err })
  const b = req.body
  db.prepare('UPDATE products SET name=?,category_id=?,emoji=?,price=?,mrp=?,unit=?,stock=?,active=? WHERE id=?')
    .run(b.name.trim(), b.category, b.emoji || '📦', Number(b.price), Number(b.mrp), b.unit || '', Number(b.stock), b.active === false || b.active === 0 ? 0 : 1, req.params.id)
  res.json({ ok: true })
})

// soft delete so old orders keep working
r.delete('/products/:id', (req, res) => {
  db.prepare('UPDATE products SET active=0 WHERE id=?').run(req.params.id)
  res.json({ ok: true })
})

r.get('/orders', (req, res) => {
  const rows = db.prepare(`SELECT o.*, u.name AS customer, u.email FROM orders o JOIN users u ON u.id=o.user_id
    WHERE o.status!='payment_pending' ${req.query.status ? 'AND o.status=?' : ''} ORDER BY o.id DESC LIMIT 200`).all(...(req.query.status ? [req.query.status] : []))
  res.json(rows.map((o) => ({ ...o, items: db.prepare('SELECT name,emoji,price,qty FROM order_items WHERE order_id=?').all(o.id) })))
})

const NEXT = { placed: 'packing', packing: 'out_for_delivery', out_for_delivery: 'delivered' }
r.post('/orders/:code/advance', (req, res) => {
  const o = db.prepare('SELECT * FROM orders WHERE code=?').get(req.params.code)
  if (!o) return res.status(404).json({ error: 'Order not found' })
  const next = NEXT[o.status]
  if (!next) return res.status(400).json({ error: `Order is already ${o.status}` })
  setOrderStatus(o.code, next)
  res.json({ status: next })
})

export default r
