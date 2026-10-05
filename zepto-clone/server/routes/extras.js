import { Router } from 'express'
import { db } from '../db.js'
import { requireAuth } from '../auth.js'
import { getStreak } from '../streak.js'
import { parseVoice } from '../voice.js'

const r = Router()

// ---- Bhookh Streak ----
r.get('/streak', requireAuth, (req, res) => res.json(getStreak(req.user.id)))
r.get('/coupons', requireAuth, (_req, res) => {
  res.json(db.prepare('SELECT code,kind,value,min_order AS minOrder,min_streak AS minStreak,description FROM coupons WHERE active=1').all())
})

// ---- Craving Mode ----
export const MOODS = {
  exam_stress: { label: 'Exam stress', emoji: '📚', line: 'Brain needs fuel. Sugar + caffeine + something crunchy.', picks: ['Dark Chocolate', 'Instant Coffee', 'Energy Drink', 'Choco Cookies', 'Masala Noodles', 'Peanut Butter'] },
  late_night: { label: '3am bhookh', emoji: '🌙', line: 'Kitchen band, pet khula. Quick bites only.', picks: ['Cup Noodles', 'Potato Chips', 'Vanilla Ice Cream', 'Popcorn', 'Chocolate Biscuits', 'Cola'] },
  gym: { label: 'Gym mode', emoji: '💪', line: 'Protein first, junk later.', picks: ['Protein Bar', 'Farm Eggs', 'Paneer', 'Banana', 'Peanut Butter', 'Curd Cup', 'Mineral Water'] },
  breakup: { label: 'Breakup', emoji: '💔', line: 'Ice cream is cheaper than therapy. Zyada nahi toh thoda.', picks: ['Vanilla Ice Cream', 'Dark Chocolate', 'Choco Cookies', 'Potato Chips', 'Hot Chocolate'] },
  sick: { label: 'Bimar hoon', emoji: '🤒', line: 'Get well soon. Warm, light and hydrating.', picks: ['ORS', 'Ginger Tea', 'Instant Soup', 'Orange Juice', 'Brown Bread', 'Curd Cup'] },
  party: { label: 'Flat party', emoji: '🎉', line: 'Chips, cola, popcorn. Bas music laga de.', picks: ['Potato Chips', 'Cola', 'Popcorn', 'Choco Cookies', 'Ice Cream', 'Mineral Water'] },
  lazy: { label: 'Aalas', emoji: '🛋️', line: 'Zero cooking required.', picks: ['Masala Noodles', 'Cup Noodles', 'Pav Buns', 'Butter', 'Potato Chips', 'Cola'] },
}
r.get('/craving/moods', (_req, res) => res.json(Object.entries(MOODS).map(([id, m]) => ({ id, label: m.label, emoji: m.emoji }))))
r.get('/craving', (req, res) => {
  const m = MOODS[req.query.mood]
  if (!m) return res.status(404).json({ error: 'Unknown mood' })
  const seen = new Set(), out = []
  for (const kw of m.picks) {
    for (const p of db.prepare("SELECT id,name,category_id AS category,emoji,price,mrp,unit,stock FROM products WHERE active=1 AND stock>0 AND name LIKE ?").all(`%${kw}%`)) {
      if (!seen.has(p.id)) { seen.add(p.id); out.push(p) }
    }
  }
  res.json({ mood: { id: req.query.mood, label: m.label, emoji: m.emoji, line: m.line }, products: out })
})

// ---- Voice Order (Hinglish text command -> cart lines) ----
r.post('/voice/parse', (req, res) => {
  const text = String(req.body?.text || '').slice(0, 500)
  if (!text.trim()) return res.status(400).json({ error: 'Say or type something' })
  res.json(parseVoice(text))
})

export default r
