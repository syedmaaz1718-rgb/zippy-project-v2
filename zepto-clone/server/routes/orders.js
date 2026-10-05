import { Router } from 'express'
import { db } from '../db.js'
import { requireAuth } from '../auth.js'
import { priceCart } from '../pricing.js'
import { createOrder, orderView, cancelOrder } from '../orderService.js'
import { onOrder } from '../events.js'
import jwt from 'jsonwebtoken'
import { JWT_SECRET } from '../auth.js'
import { loadCart } from './cart.js'

const r = Router()

// Live tracking stream (Server-Sent Events). EventSource cannot set headers, so the JWT comes as ?token=
r.get('/:code/stream', (req, res) => {
  let user
  try { user = jwt.verify(String(req.query.token || ''), JWT_SECRET) } catch { return res.status(401).end() }
  const o = db.prepare('SELECT * FROM orders WHERE code=? AND (user_id=? OR id IN (SELECT order_id FROM order_splits WHERE user_id=?))').get(req.params.code, user.id, user.id)
  if (!o) return res.status(404).end()
  res.set({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' })
  res.flushHeaders()
  const send = (order) => res.write(`data: ${JSON.stringify(order)}\n\n`)
  send(orderView(o))
  const off = onOrder(o.code, send)
  const ping = setInterval(() => res.write(': ping\n\n'), 20000)
  req.on('close', () => { off(); clearInterval(ping) })
})

r.use(requireAuth)

export const STATUS_FLOW = ['placed', 'packing', 'out_for_delivery', 'delivered']

const orderWithItems = orderView

r.post('/', (req, res) => {
  const { addressId, address, phone, paymentMethod, coupon, tip } = req.body || {}
  if (!['upi', 'card', 'cod'].includes(paymentMethod)) return res.status(400).json({ error: 'Choose a payment method' })
  let addrText = address
  if (addressId) addrText = db.prepare('SELECT line FROM addresses WHERE id=? AND user_id=?').get(addressId, req.user.id)?.line
  if (!addrText || addrText.trim().length < 8) return res.status(400).json({ error: 'Delivery address required' })
  const ph = phone || req.user.phone
  if (!/^[6-9]\d{9}$/.test(ph || '')) return res.status(400).json({ error: 'Valid 10-digit mobile number required' })

  try {
    const lines = loadCart(req.user.id).map((l) => ({ ...l, added_by: req.user.id }))
    const order = createOrder({ user: req.user, lines, address: addrText, phone: ph, paymentMethod, coupon, tip })
    db.prepare('DELETE FROM cart_items WHERE user_id=?').run(req.user.id)
    res.status(201).json(orderView(order))
  } catch (e) {
    res.status(400).json({ error: e.message })
  }
})

// Validate coupon against current cart without placing the order
r.get('/coupon/check', (req, res) => {
  const bill = priceCart(loadCart(req.user.id), req.query.code, req.user.id, req.query.tip)
  res.json(bill)
})

r.get('/', (req, res) => {
  const rows = db.prepare(`SELECT * FROM orders WHERE (user_id=? OR id IN (SELECT order_id FROM order_splits WHERE user_id=?)) AND status!='payment_pending' ORDER BY id DESC`).all(req.user.id, req.user.id)
  res.json(rows.map(orderWithItems))
})

r.get('/:code', (req, res) => {
  const o = db.prepare('SELECT * FROM orders WHERE code=? AND (user_id=? OR id IN (SELECT order_id FROM order_splits WHERE user_id=?))').get(req.params.code, req.user.id, req.user.id)
  if (!o) return res.status(404).json({ error: 'Order not found' })
  res.json(orderWithItems(o))
})

r.post('/:code/cancel', (req, res) => {
  const o = db.prepare('SELECT * FROM orders WHERE code=? AND user_id=?').get(req.params.code, req.user.id)
  if (!o) return res.status(404).json({ error: 'Order not found' })
  if (o.status !== 'placed') return res.status(400).json({ error: 'Order can only be cancelled before packing starts' })
  res.json(cancelOrder(o.code))
})

export default r
