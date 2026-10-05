import { Router } from 'express'
import bcrypt from 'bcryptjs'
import { db } from '../db.js'
import { signToken, requireAuth } from '../auth.js'

const r = Router()
const emailOk = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)

r.post('/register', (req, res) => {
  const { name, email, phone, password } = req.body || {}
  if (!name || name.trim().length < 2) return res.status(400).json({ error: 'Enter your name' })
  if (!emailOk(email || '')) return res.status(400).json({ error: 'Enter a valid email' })
  if (!password || password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' })
  if (phone && !/^[6-9]\d{9}$/.test(phone)) return res.status(400).json({ error: 'Enter a valid 10-digit mobile number' })
  const exists = db.prepare('SELECT id FROM users WHERE email=?').get(email.toLowerCase())
  if (exists) return res.status(409).json({ error: 'Email already registered' })
  const info = db.prepare('INSERT INTO users (name,email,phone,password_hash) VALUES (?,?,?,?)')
    .run(name.trim(), email.toLowerCase(), phone || null, bcrypt.hashSync(password, 10))
  const user = db.prepare('SELECT id,name,email,phone,role FROM users WHERE id=?').get(info.lastInsertRowid)
  res.status(201).json({ token: signToken(user), user })
})

r.post('/login', (req, res) => {
  const { email, password } = req.body || {}
  const row = db.prepare('SELECT * FROM users WHERE email=?').get(String(email || '').toLowerCase())
  if (!row || !bcrypt.compareSync(password || '', row.password_hash)) return res.status(401).json({ error: 'Wrong email or password' })
  const user = { id: row.id, name: row.name, email: row.email, phone: row.phone, role: row.role }
  res.json({ token: signToken(user), user })
})

r.get('/me', requireAuth, (req, res) => res.json({ user: req.user }))

// Addresses
r.get('/addresses', requireAuth, (req, res) => {
  res.json(db.prepare('SELECT * FROM addresses WHERE user_id=? ORDER BY is_default DESC, id DESC').all(req.user.id))
})
r.post('/addresses', requireAuth, (req, res) => {
  const { label, line } = req.body || {}
  if (!line || line.trim().length < 8) return res.status(400).json({ error: 'Enter a full address' })
  const first = db.prepare('SELECT COUNT(*) c FROM addresses WHERE user_id=?').get(req.user.id).c === 0
  const info = db.prepare('INSERT INTO addresses (user_id,label,line,is_default) VALUES (?,?,?,?)')
    .run(req.user.id, (label || 'Home').slice(0, 20), line.trim(), first ? 1 : 0)
  res.status(201).json(db.prepare('SELECT * FROM addresses WHERE id=?').get(info.lastInsertRowid))
})
r.delete('/addresses/:id', requireAuth, (req, res) => {
  db.prepare('DELETE FROM addresses WHERE id=? AND user_id=?').run(req.params.id, req.user.id)
  res.json({ ok: true })
})

export default r
