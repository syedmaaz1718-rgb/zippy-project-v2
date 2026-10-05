import { Router } from 'express'
import crypto from 'crypto'
import { db } from '../db.js'
import { requireAuth } from '../auth.js'
import { priceCart } from '../pricing.js'
import { createOrder, orderView, computeSplit } from '../orderService.js'

const r = Router()
r.use(requireAuth)

const isMember = (flatId, userId) => !!db.prepare('SELECT 1 FROM flat_members WHERE flat_id=? AND user_id=?').get(flatId, userId)
const members = (flatId) => db.prepare('SELECT u.id,u.name FROM flat_members m JOIN users u ON u.id=m.user_id WHERE m.flat_id=? ORDER BY m.rowid').all(flatId)
const lines = (flatId) => db.prepare(`SELECT p.id AS product_id, p.name, p.emoji, p.price, p.mrp, p.unit, p.stock, f.qty, f.user_id AS added_by, u.name AS added_by_name
  FROM flat_cart_items f JOIN products p ON p.id=f.product_id JOIN users u ON u.id=f.user_id WHERE f.flat_id=? AND p.active=1 ORDER BY p.id, f.rowid`).all(flatId)

function flatView(flat, coupon, mode = 'items', userId) {
  const ls = lines(flat.id)
  const bill = priceCart(ls, coupon, userId)
  const mem = members(flat.id)
  const shares = ls.length ? computeSplit(ls, bill, mem.map((m) => m.id), userId, mode) : {}
  const split = mem.map((m) => ({ ...m, amount: shares[m.id] || 0 }))
  return { id: flat.id, name: flat.name, inviteCode: flat.invite_code, ownerId: flat.owner_id, members: mem, items: ls, bill, mode, split }
}
const getFlat = (req, res) => {
  const flat = db.prepare('SELECT * FROM flats WHERE id=?').get(req.params.id)
  if (!flat || !isMember(flat.id, req.user.id)) { res.status(404).json({ error: 'Flat not found' }); return null }
  return flat
}

r.get('/', (req, res) => {
  res.json(db.prepare(`SELECT f.id,f.name,f.invite_code AS inviteCode,
    (SELECT COUNT(*) FROM flat_members WHERE flat_id=f.id) AS memberCount,
    (SELECT COALESCE(SUM(qty),0) FROM flat_cart_items WHERE flat_id=f.id) AS itemCount
    FROM flats f JOIN flat_members m ON m.flat_id=f.id WHERE m.user_id=? ORDER BY f.id DESC`).all(req.user.id))
})

r.post('/', (req, res) => {
  const name = (req.body?.name || '').trim()
  if (name.length < 2) return res.status(400).json({ error: 'Give your flat a name' })
  const code = crypto.randomBytes(3).toString('hex').toUpperCase()
  const id = db.transaction(() => {
    const info = db.prepare('INSERT INTO flats (name,invite_code,owner_id) VALUES (?,?,?)').run(name, code, req.user.id)
    db.prepare('INSERT INTO flat_members (flat_id,user_id) VALUES (?,?)').run(info.lastInsertRowid, req.user.id)
    return info.lastInsertRowid
  })()
  res.status(201).json({ id, inviteCode: code })
})

r.post('/join', (req, res) => {
  const flat = db.prepare('SELECT * FROM flats WHERE invite_code=?').get(String(req.body?.code || '').trim().toUpperCase())
  if (!flat) return res.status(404).json({ error: 'Invalid invite code' })
  db.prepare('INSERT OR IGNORE INTO flat_members (flat_id,user_id) VALUES (?,?)').run(flat.id, req.user.id)
  res.json({ id: flat.id })
})

r.get('/:id', (req, res) => {
  const flat = getFlat(req, res); if (!flat) return
  res.json(flatView(flat, req.query.coupon, req.query.mode === 'equal' ? 'equal' : 'items', req.user.id))
})

// set MY quantity for a product in the shared cart
r.put('/:id/items/:productId', (req, res) => {
  const flat = getFlat(req, res); if (!flat) return
  const qty = Number(req.body?.qty)
  if (!Number.isInteger(qty) || qty < 0) return res.status(400).json({ error: 'Invalid quantity' })
  const p = db.prepare('SELECT id,stock FROM products WHERE id=? AND active=1').get(req.params.productId)
  if (!p) return res.status(404).json({ error: 'Product not found' })
  const others = db.prepare('SELECT COALESCE(SUM(qty),0) s FROM flat_cart_items WHERE flat_id=? AND product_id=? AND user_id!=?').get(flat.id, p.id, req.user.id).s
  if (others + qty > p.stock) return res.status(400).json({ error: `Only ${p.stock} left in stock` })
  if (qty === 0) db.prepare('DELETE FROM flat_cart_items WHERE flat_id=? AND product_id=? AND user_id=?').run(flat.id, p.id, req.user.id)
  else db.prepare(`INSERT INTO flat_cart_items (flat_id,product_id,user_id,qty) VALUES (?,?,?,?)
    ON CONFLICT(flat_id,product_id,user_id) DO UPDATE SET qty=excluded.qty`).run(flat.id, p.id, req.user.id, qty)
  res.json(flatView(flat, req.body?.coupon, req.body?.mode === 'equal' ? 'equal' : 'items', req.user.id))
})

r.post('/:id/leave', (req, res) => {
  const flat = getFlat(req, res); if (!flat) return
  db.prepare('DELETE FROM flat_cart_items WHERE flat_id=? AND user_id=?').run(flat.id, req.user.id)
  db.prepare('DELETE FROM flat_members WHERE flat_id=? AND user_id=?').run(flat.id, req.user.id)
  res.json({ ok: true })
})

// Any member can place the group order; they front the payment, others owe them their share.
r.post('/:id/checkout', (req, res) => {
  const flat = getFlat(req, res); if (!flat) return
  const { address, phone, paymentMethod, coupon, mode } = req.body || {}
  if (!['upi', 'card', 'cod'].includes(paymentMethod)) return res.status(400).json({ error: 'Choose a payment method' })
  if (!address || address.trim().length < 8) return res.status(400).json({ error: 'Delivery address required' })
  const ph = phone || req.user.phone
  if (!/^[6-9]\d{9}$/.test(ph || '')) return res.status(400).json({ error: 'Valid 10-digit mobile number required' })
  try {
    const order = createOrder({
      user: req.user, lines: lines(flat.id), address, phone: ph, paymentMethod, coupon,
      flat: { id: flat.id, memberIds: members(flat.id).map((m) => m.id), splitMode: mode === 'equal' ? 'equal' : 'items' },
    })
    db.prepare('DELETE FROM flat_cart_items WHERE flat_id=?').run(flat.id)
    res.status(201).json(orderView(order))
  } catch (e) { res.status(400).json({ error: e.message }) }
})

r.get('/:id/orders', (req, res) => {
  const flat = getFlat(req, res); if (!flat) return
  res.json(db.prepare('SELECT * FROM orders WHERE flat_id=? ORDER BY id DESC').all(flat.id).map(orderView))
})

// Mark my share of a flat order as paid (mock - no real payment)
r.post('/orders/:code/settle', (req, res) => {
  const o = db.prepare('SELECT * FROM orders WHERE code=?').get(req.params.code)
  if (!o || !o.flat_id || !isMember(o.flat_id, req.user.id)) return res.status(404).json({ error: 'Order not found' })
  const info = db.prepare('UPDATE order_splits SET paid=1 WHERE order_id=? AND user_id=?').run(o.id, req.user.id)
  if (!info.changes) return res.status(400).json({ error: 'You have no share in this order' })
  res.json(orderView(o))
})

export default r
