import { Router } from 'express'
import crypto from 'crypto'
import { db } from '../db.js'
import { requireAuth } from '../auth.js'
import { loadCart } from './cart.js'
import { createOrder, orderView, cancelOrder, setOrderStatus } from '../orderService.js'
import { RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET, RAZORPAY_API, razorpayEnabled } from '../config.js'

// Razorpay (test mode) flow:
//  1. POST /create  - saves the order as 'payment_pending' (stock reserved) and creates a Razorpay order
//  2. browser opens Razorpay Checkout with the returned order id
//  3. POST /verify  - checks the HMAC signature, marks the order paid + placed, clears the cart
//  4. POST /cancel  - payment dismissed/failed: release the stock (the cart is untouched so they can retry)
const r = Router()
r.use(requireAuth)

r.post('/create', async (req, res) => {
  if (!razorpayEnabled()) return res.status(400).json({ error: 'Online payments are not configured on this server' })
  const { addressId, address, phone, coupon, tip } = req.body || {}
  let addr = address
  if (addressId) addr = db.prepare('SELECT line FROM addresses WHERE id=? AND user_id=?').get(addressId, req.user.id)?.line
  if (!addr || addr.trim().length < 8) return res.status(400).json({ error: 'Delivery address required' })
  const ph = phone || req.user.phone
  if (!/^[6-9]\d{9}$/.test(ph || '')) return res.status(400).json({ error: 'Valid 10-digit mobile number required' })
  let order
  try {
    const lines = loadCart(req.user.id).map((l) => ({ ...l, added_by: req.user.id }))
    order = createOrder({ user: req.user, lines, address: addr, phone: ph, paymentMethod: 'razorpay', coupon, tip, pendingPayment: true })
  } catch (e) { return res.status(400).json({ error: e.message }) }
  try {
    const rp = await fetch(`${RAZORPAY_API}/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Basic ' + Buffer.from(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`).toString('base64') },
      body: JSON.stringify({ amount: order.total * 100, currency: 'INR', receipt: order.code }),
    })
    const body = await rp.json()
    if (!rp.ok) throw new Error(body?.error?.description || 'Razorpay rejected the order')
    db.prepare('UPDATE orders SET razorpay_order_id=? WHERE id=?').run(body.id, order.id)
    res.status(201).json({ orderCode: order.code, razorpayOrderId: body.id, amount: order.total * 100, keyId: RAZORPAY_KEY_ID, name: req.user.name, email: req.user.email, phone: ph })
  } catch (e) {
    cancelOrder(order.code, false)
    res.status(502).json({ error: 'Could not start payment: ' + e.message })
  }
})

export const signatureOk = (orderId, paymentId, signature, secret = RAZORPAY_KEY_SECRET) => {
  const expected = crypto.createHmac('sha256', secret).update(`${orderId}|${paymentId}`).digest('hex')
  const a = Buffer.from(expected), b = Buffer.from(String(signature || ''))
  return a.length === b.length && crypto.timingSafeEqual(a, b)
}

r.post('/verify', (req, res) => {
  const { orderCode, razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body || {}
  const o = db.prepare('SELECT * FROM orders WHERE code=? AND user_id=?').get(orderCode, req.user.id)
  if (!o || o.razorpay_order_id !== razorpay_order_id) return res.status(404).json({ error: 'Order not found' })
  if (!signatureOk(razorpay_order_id, razorpay_payment_id, razorpay_signature)) return res.status(400).json({ error: 'Payment verification failed' })
  if (o.status === 'payment_pending') {
    db.prepare("UPDATE orders SET payment_status='paid', razorpay_payment_id=? WHERE id=?").run(razorpay_payment_id, o.id)
    db.prepare('DELETE FROM cart_items WHERE user_id=?').run(req.user.id)
    return res.json(setOrderStatus(o.code, 'placed'))
  }
  res.json(orderView(o)) // already verified (idempotent)
})

r.post('/cancel', (req, res) => {
  const o = db.prepare('SELECT * FROM orders WHERE code=? AND user_id=?').get(req.body?.orderCode, req.user.id)
  if (!o) return res.status(404).json({ error: 'Order not found' })
  if (o.status !== 'payment_pending') return res.status(400).json({ error: 'Order is not awaiting payment' })
  res.json(cancelOrder(o.code, false))
})

export default r
