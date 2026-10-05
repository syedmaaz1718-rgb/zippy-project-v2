import { Router } from 'express'
import { db } from '../db.js'
import { requireAuth } from '../auth.js'

const r = Router()
r.use(requireAuth)

// "This month" = since the 1st, in server local time.
function monthStart() {
  const d = new Date()
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 19).replace('T', ' ')
}

r.get('/', (req, res) => {
  const since = monthStart()
  const uid = req.user.id
  // my share of orders: personal orders = full total, flat orders = my split amount
  const personal = db.prepare("SELECT COALESCE(SUM(total),0) s FROM orders WHERE user_id=? AND flat_id IS NULL AND status NOT IN ('cancelled','payment_pending') AND created_at>=?").get(uid, since).s
  const flat = db.prepare(`SELECT COALESCE(SUM(s.amount),0) s FROM order_splits s JOIN orders o ON o.id=s.order_id
    WHERE s.user_id=? AND o.status NOT IN ('cancelled','payment_pending') AND o.created_at>=?`).get(uid, since).s
  const byCategory = db.prepare(`SELECT c.name, c.emoji, SUM(oi.price*oi.qty) spent FROM order_items oi
    JOIN orders o ON o.id=oi.order_id JOIN products p ON p.id=oi.product_id JOIN categories c ON c.id=p.category_id
    WHERE oi.user_id=? AND o.status NOT IN ('cancelled','payment_pending') AND o.created_at>=? GROUP BY c.id ORDER BY spent DESC`).all(uid, since)
  const budget = db.prepare('SELECT monthly_budget b FROM users WHERE id=?').get(uid).b
  const spent = personal + flat
  res.json({ budget, spent, personal, flat, remaining: budget ? budget - spent : null, byCategory })
})

r.put('/', (req, res) => {
  const b = Number(req.body?.budget)
  if (!Number.isInteger(b) || b < 0 || b > 1000000) return res.status(400).json({ error: 'Enter a valid budget' })
  db.prepare('UPDATE users SET monthly_budget=? WHERE id=?').run(b, req.user.id)
  res.json({ budget: b })
})
export default r
