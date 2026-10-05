import { db } from './db.js'
import { setOrderStatus, cancelOrder } from './orderService.js'
import { STEPS, AUTO_PROGRESS as AUTO } from './config.js'

// Delivery "fleet" simulator. Real quick-commerce needs riders and dark stores; here an order just
// moves through the stages on a timer so live tracking can be demoed without touching the admin panel.
// STEP_SECONDS = seconds per stage: placed>packing, packing>out_for_delivery, out_for_delivery>delivered.
const NEXT = { placed: ['packing', STEPS[0]], packing: ['out_for_delivery', STEPS[1]], out_for_delivery: ['delivered', STEPS[2]] }

export function startSimulator() {
  setInterval(() => {
    if (AUTO) {
      const rows = db.prepare(`SELECT code,status,CAST((julianday('now')-julianday(updated_at))*86400 AS INTEGER) AS age FROM orders
        WHERE status IN ('placed','packing','out_for_delivery')`).all()
      for (const o of rows) {
        const [next, after] = NEXT[o.status]
        if (o.age >= after) setOrderStatus(o.code, next)
      }
    }
    // unpaid online orders are released after 15 minutes
    db.prepare(`SELECT code FROM orders WHERE status='payment_pending' AND (julianday('now')-julianday(created_at))*1440 > 15`).all()
      .forEach((o) => cancelOrder(o.code, false))
  }, 3000).unref()
}
