import express from 'express'
import cors from 'cors'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'
import './db.js'
import { startSimulator } from './simulator.js'
import paymentRoutes from './routes/payments.js'
import reviewRoutes from './routes/reviews.js'
import authRoutes from './routes/auth.js'
import catalogRoutes from './routes/catalog.js'
import cartRoutes from './routes/cart.js'
import orderRoutes from './routes/orders.js'
import adminRoutes from './routes/admin.js'
import wishlistRoutes from './routes/wishlist.js'
import flatRoutes from './routes/flats.js'
import extraRoutes from './routes/extras.js'
import budgetRoutes from './routes/budget.js'

const app = express()
app.use(cors())
app.use(express.json())

app.use('/api/auth', authRoutes)
app.use('/api', catalogRoutes)
app.use('/api/cart', cartRoutes)
app.use('/api/orders', orderRoutes)
app.use('/api/admin', adminRoutes)
app.use('/api/wishlist', wishlistRoutes)
app.use('/api/flats', flatRoutes)
app.use('/api/budget', budgetRoutes)
app.use('/api/payments', paymentRoutes)
app.use('/api/reviews', reviewRoutes)
app.use('/api', extraRoutes)
app.use('/api', (_req, res) => res.status(404).json({ error: 'Not found' }))

// In production serve the built frontend
const dist = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist')
if (fs.existsSync(dist)) {
  app.use(express.static(dist))
  app.use((_req, res) => res.sendFile(path.join(dist, 'index.html')))
}

app.use((err, _req, res, _next) => {
  console.error(err)
  res.status(500).json({ error: 'Something went wrong' })
})

const PORT = process.env.PORT || 3001
app.listen(PORT, () => {
  console.log(`Zippy API running on http://localhost:${PORT}`)
  startSimulator()
})
