import { db } from './db.js'
import { getStreak } from './streak.js'

export const FREE_DELIVERY_ABOVE = 199
export const DELIVERY_FEE = 25
export const HANDLING_FEE = 5

// Single source of truth for bill calculation (used by cart preview and order placement).
export const TIP_OPTIONS = [0, 10, 20, 30, 50]

export function priceCart(lines, couponCode, userId, tip = 0) {
  tip = TIP_OPTIONS.includes(Number(tip)) ? Number(tip) : 0
  const subtotal = lines.reduce((s, l) => s + l.price * l.qty, 0)
  const savings = lines.reduce((s, l) => s + (l.mrp - l.price) * l.qty, 0)
  let delivery = subtotal === 0 || subtotal >= FREE_DELIVERY_ABOVE ? 0 : DELIVERY_FEE
  const handling = subtotal === 0 ? 0 : HANDLING_FEE
  let discount = 0
  let coupon = null
  let couponError = null
  if (couponCode) {
    const c = db.prepare('SELECT * FROM coupons WHERE code=? AND active=1').get(String(couponCode).toUpperCase())
    if (!c) couponError = 'Invalid coupon'
    else if (c.min_streak > 0 && !userId) couponError = 'Login to use streak rewards'
    else if (c.min_streak > 0 && getStreak(userId).best < c.min_streak) couponError = `Unlocks at a ${c.min_streak}-day Bhookh Streak`
    else if (c.min_streak > 0 && db.prepare('SELECT 1 FROM orders WHERE user_id=? AND coupon=? AND status!=?').get(userId, c.code, 'cancelled')) couponError = 'Streak reward already used'
    else if (subtotal < c.min_order) couponError = `Add items worth ₹${c.min_order - subtotal} more to use ${c.code}`
    else {
      coupon = c.code
      if (c.kind === 'flat') discount = Math.min(c.value, subtotal)
      if (c.kind === 'percent') discount = Math.floor((subtotal * c.value) / 100)
      if (c.kind === 'freedelivery') { discount = delivery; delivery = delivery } // discount cancels delivery fee
    }
  }
  const total = subtotal + delivery + handling - discount + (subtotal === 0 ? 0 : tip)
  return { subtotal, savings, delivery, handling, tip: subtotal === 0 ? 0 : tip, discount, coupon, couponError, total }
}
