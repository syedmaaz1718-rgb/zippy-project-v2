import { db } from './db.js'

// Day boundaries use this offset from UTC (default IST, +5:30).
const OFFSET_MIN = Number(process.env.TZ_OFFSET_MIN ?? 330)
export const MILESTONES = [
  { days: 3, code: 'STREAK3', label: '₹30 off' },
  { days: 7, code: 'STREAK7', label: '₹75 off' },
  { days: 14, code: 'STREAK14', label: 'Free delivery' },
]

const dayKey = (ms) => new Date(ms + OFFSET_MIN * 60000).toISOString().slice(0, 10)
const dayNum = (key) => Math.floor(Date.parse(key + 'T00:00:00Z') / 86400000)

export function orderDays(userId) {
  const rows = db.prepare(`SELECT created_at FROM orders WHERE status NOT IN ('cancelled','payment_pending') AND
    (user_id=? OR id IN (SELECT order_id FROM order_splits WHERE user_id=?))`).all(userId, userId)
  return [...new Set(rows.map((r) => dayKey(Date.parse(r.created_at.replace(' ', 'T') + 'Z'))))].map(dayNum).sort((a, b) => a - b)
}

export function getStreak(userId, nowMs = Date.now()) {
  const days = orderDays(userId)
  const today = dayNum(dayKey(nowMs))
  let best = 0, run = 0
  days.forEach((d, i) => { run = i > 0 && d === days[i - 1] + 1 ? run + 1 : 1; best = Math.max(best, run) })
  // current streak: consecutive days ending today, or yesterday (still alive until midnight)
  const set = new Set(days)
  const orderedToday = set.has(today)
  let cur = 0
  let d = orderedToday ? today : today - 1
  while (set.has(d)) { cur++; d-- }
  const used = new Set(db.prepare('SELECT coupon FROM orders WHERE user_id=? AND coupon IS NOT NULL').all(userId).map((r) => r.coupon))
  const rewards = MILESTONES.map((m) => ({ ...m, unlocked: best >= m.days, used: used.has(m.code) }))
  const next = MILESTONES.find((m) => cur < m.days) || null
  return { current: cur, best, orderedToday, atRisk: cur > 0 && !orderedToday, rewards, next, daysToNext: next ? next.days - cur : 0 }
}
