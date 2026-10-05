import { db } from './db.js'
import { priceCart } from './pricing.js'
import { emitOrder } from './events.js'
import { STEPS, AUTO_PROGRESS, STORE } from './config.js'

// Split a bill between members. lines carry added_by (user id).
// mode 'equal': everyone pays the same. mode 'items': each pays for what they added + equal share of fees/discount.
export function computeSplit(lines, bill, memberIds, payerId, mode) {
  const ids = [...new Set(memberIds)]
  const shares = {}
  if (mode === 'equal') {
    const each = Math.floor(bill.total / ids.length)
    ids.forEach((id) => (shares[id] = each))
  } else {
    const itemTotal = {}
    lines.forEach((l) => (itemTotal[l.added_by] = (itemTotal[l.added_by] || 0) + l.price * l.qty))
    const participants = ids.filter((id) => itemTotal[id])
    const feeShare = bill.delivery + bill.handling - bill.discount
    const each = Math.floor(feeShare / participants.length)
    participants.forEach((id) => (shares[id] = itemTotal[id] + each))
  }
  const assigned = Object.values(shares).reduce((a, b) => a + b, 0)
  shares[payerId] = (shares[payerId] || 0) + (bill.total - assigned) // rounding remainder goes to payer
  return shares
}

const RIDERS = ['Ravi K.', 'Imran S.', 'Suresh P.', 'Manoj T.', 'Arjun D.', 'Faisal A.']

// Creates an order inside a transaction. Throws Error with a user-friendly message.
export function createOrder({ user, lines, address, phone, paymentMethod, coupon, flat, tip = 0, pendingPayment = false }) {
  return db.transaction(() => {
    if (lines.length === 0) throw new Error('Your cart is empty')
    for (const l of lines) if (l.qty > l.stock) throw new Error(`${l.name}: only ${l.stock} left in stock`)
    const bill = priceCart(lines, coupon, user.id, tip)
    if (coupon && bill.couponError) throw new Error(bill.couponError)
    const code = 'ZP' + Math.floor(100000 + Math.random() * 900000)
    const payStatus = pendingPayment || paymentMethod === 'cod' ? 'pending' : 'paid' // upi/card without Razorpay = mock payment, marked paid instantly
    const status = pendingPayment ? 'payment_pending' : 'placed'
    const rider = RIDERS[Math.floor(Math.random() * RIDERS.length)]
    const info = db.prepare(`INSERT INTO orders (code,user_id,status,payment_method,payment_status,address,phone,subtotal,delivery_fee,handling_fee,discount,coupon,total,flat_id,tip,rider_name)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(code, user.id, status, paymentMethod, payStatus, address.trim(), phone,
      bill.subtotal, bill.delivery, bill.handling, bill.discount, bill.coupon, bill.total, flat?.id ?? null, bill.tip, rider)
    const ioi = db.prepare('INSERT INTO order_items (order_id,product_id,name,emoji,price,qty,user_id) VALUES (?,?,?,?,?,?,?)')
    const dec = db.prepare('UPDATE products SET stock=stock-? WHERE id=? AND stock>=?')
    for (const l of lines) {
      if (dec.run(l.qty, l.product_id, l.qty).changes === 0) throw new Error(`${l.name} just went out of stock`)
      ioi.run(info.lastInsertRowid, l.product_id, l.name, l.emoji, l.price, l.qty, l.added_by ?? user.id)
    }
    if (flat) {
      const shares = computeSplit(lines, bill, flat.memberIds, user.id, flat.splitMode)
      const is = db.prepare('INSERT INTO order_splits (order_id,user_id,amount,paid) VALUES (?,?,?,?)')
      for (const [uid, amt] of Object.entries(shares)) is.run(info.lastInsertRowid, Number(uid), amt, Number(uid) === user.id ? 1 : 0)
    }
    return db.prepare('SELECT * FROM orders WHERE id=?').get(info.lastInsertRowid)
  })()
}

// Fake but stable "geocoding": the same address always maps to the same point within ~2 km of the store.
function destFor(address) {
  let h = 0
  for (const ch of address) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  const a = ((h % 360) * Math.PI) / 180, r = 0.008 + ((h >> 8) % 100) / 100 * 0.012
  return { lat: STORE.lat + Math.sin(a) * r, lng: STORE.lng + Math.cos(a) * r }
}

function trackingInfo(o) {
  const age = db.prepare("SELECT CAST((julianday('now')-julianday(updated_at))*86400 AS INTEGER) a FROM orders WHERE id=?").get(o.id).a
  const stages = ['placed', 'packing', 'out_for_delivery']
  const i = stages.indexOf(o.status)
  let eta = null
  if (AUTO_PROGRESS && i >= 0) eta = Math.max(0, STEPS[i] - age) + STEPS.slice(i + 1).reduce((a, b) => a + b, 0)
  return { store: STORE, dest: destFor(o.address), statusAgeSeconds: age, deliverySeconds: STEPS[2], etaSeconds: eta, auto: AUTO_PROGRESS }
}

export const orderView = (o) => ({
  ...o,
  tracking: trackingInfo(o),
  items: db.prepare(`SELECT oi.name,oi.emoji,oi.price,oi.qty,oi.user_id,u.name AS added_by FROM order_items oi LEFT JOIN users u ON u.id=oi.user_id WHERE oi.order_id=?`).all(o.id),
  splits: db.prepare(`SELECT s.user_id,s.amount,s.paid,u.name FROM order_splits s JOIN users u ON u.id=s.user_id WHERE s.order_id=?`).all(o.id),
})

// Single place that changes an order's status: updates the DB, then notifies live-tracking listeners.
export function setOrderStatus(code, status) {
  const o = db.prepare('SELECT * FROM orders WHERE code=?').get(code)
  if (!o) return null
  db.prepare(`UPDATE orders SET status=?, updated_at=CURRENT_TIMESTAMP,
    payment_status=CASE WHEN ?='delivered' AND payment_method='cod' THEN 'paid' ELSE payment_status END WHERE id=?`).run(status, status, o.id)
  const fresh = orderView(db.prepare('SELECT * FROM orders WHERE id=?').get(o.id))
  emitOrder(code, fresh)
  return fresh
}

// Cancels an order and puts the stock back. Used by customer cancel, failed payment and the unpaid-order sweeper.
export function cancelOrder(code, refund = true) {
  const o = db.prepare('SELECT * FROM orders WHERE code=?').get(code)
  if (!o) return null
  db.transaction(() => {
    db.prepare(`UPDATE orders SET status='cancelled', updated_at=CURRENT_TIMESTAMP,
      payment_status=CASE WHEN payment_status='paid' AND ? THEN 'refunded' ELSE payment_status END WHERE id=?`).run(refund ? 1 : 0, o.id)
    db.prepare('SELECT product_id,qty FROM order_items WHERE order_id=?').all(o.id)
      .forEach((i) => db.prepare('UPDATE products SET stock=stock+? WHERE id=?').run(i.qty, i.product_id))
  })()
  const fresh = orderView(db.prepare('SELECT * FROM orders WHERE id=?').get(o.id))
  emitOrder(code, fresh)
  return fresh
}
