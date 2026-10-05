import jwt from 'jsonwebtoken'
import { db } from './db.js'

const SECRET = process.env.JWT_SECRET || 'dev-secret-change-me'
export const JWT_SECRET = SECRET
export const signToken = (user) => jwt.sign({ id: user.id }, SECRET, { expiresIn: '7d' })

export function requireAuth(req, res, next) {
  const h = req.headers.authorization || ''
  const token = h.startsWith('Bearer ') ? h.slice(7) : null
  if (!token) return res.status(401).json({ error: 'Login required' })
  try {
    const { id } = jwt.verify(token, SECRET)
    const user = db.prepare('SELECT id,name,email,phone,role FROM users WHERE id=?').get(id)
    if (!user) return res.status(401).json({ error: 'User not found' })
    req.user = user
    next()
  } catch {
    res.status(401).json({ error: 'Session expired, please login again' })
  }
}

export function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') return res.status(403).json({ error: 'Admin only' })
  next()
}
