// End-to-end API test. Run: npm test  (uses a temporary database, starts its own server)
import { spawn } from 'child_process'
import assert from 'assert'
import fs from 'fs'
import http from 'http'
import crypto from 'crypto'
const DB = '/tmp/zippy-test-' + Date.now() + '.db'
const PORT = 3999
const srv = spawn('node', ['server/index.js'], { env: { ...process.env, DB_FILE: DB, PORT, AUTO_PROGRESS: '0' }, stdio: 'ignore' })
const base = `http://localhost:${PORT}/api`
const call = async (method, url, body, token) => {
  const r = await fetch(base + url, { method, headers: { 'content-type': 'application/json', ...(token ? { authorization: 'Bearer ' + token } : {}) }, body: body ? JSON.stringify(body) : undefined })
  return { status: r.status, data: await r.json() }
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
let failed = false
try {
  await sleep(1500)
  let r = await call('GET', '/products?q=milk'); assert.equal(r.data.length, 1, 'search')
  r = await call('GET', '/cart'); assert.equal(r.status, 401, 'cart needs auth')
  r = await call('POST', '/auth/register', { name: 'Test', email: 't@t.com', phone: '9123456789', password: 'secret1' }); assert.equal(r.status, 201)
  const tok = r.data.token
  r = await call('POST', '/auth/register', { name: 'Test', email: 't@t.com', password: 'secret1' }); assert.equal(r.status, 409, 'dup email')
  r = await call('POST', '/auth/login', { email: 't@t.com', password: 'bad' }); assert.equal(r.status, 401)
  r = await call('PUT', '/cart/items/1', { qty: 2 }, tok); assert.equal(r.data.bill.subtotal, 78)
  r = await call('PUT', '/cart/items/4', { qty: 1 }, tok); assert.equal(r.data.bill.subtotal, 207); assert.equal(r.data.bill.delivery, 0)
  r = await call('PUT', '/cart/items/1', { qty: 9999 }, tok); assert.equal(r.status, 400, 'stock limit')
  r = await call('GET', '/orders/coupon/check?code=WELCOME50', null, tok); assert.equal(r.data.discount, 0, 'min order not met'); assert.ok(r.data.couponError)
  r = await call('PUT', '/cart/items/9', { qty: 1 }, tok)
  r = await call('GET', '/orders/coupon/check?code=ZIPPY10', null, tok); assert.ok(r.data.discount > 0)
  r = await call('POST', '/orders', { address: '12 MG Road, Bengaluru', paymentMethod: 'upi', coupon: 'ZIPPY10' }, tok); assert.equal(r.status, 201, JSON.stringify(r.data))
  const code = r.data.code
  r = await call('GET', '/cart', null, tok); assert.equal(r.data.items.length, 0, 'cart cleared')
  r = await call('GET', '/products/1'); assert.ok(r.data.stock > 0)
  r = await call('POST', `/orders/${code}/cancel`, null, tok); assert.equal(r.data.status, 'cancelled'); assert.equal(r.data.payment_status, 'refunded')
  r = await call('GET', '/admin/stats', null, tok); assert.equal(r.status, 403, 'non admin blocked')
  r = await call('POST', '/auth/login', { email: 'admin@zippy.com', password: 'admin123' }); const adm = r.data.token
  r = await call('GET', '/admin/stats', null, adm); assert.equal(r.status, 200)
  r = await call('POST', '/admin/products', { name: 'Test Item', category: 'snacks', price: 10, mrp: 12, stock: 5 }, adm); assert.equal(r.status, 201)
  // wishlist
  r = await call('PUT', '/wishlist/5', null, tok); r = await call('GET', '/wishlist', null, tok); assert.equal(r.data.length, 1)
  // voice
  r = await call('POST', '/voice/parse', { text: 'bhai 2 doodh aur ek dozen ande, teen chips aur kuch random cheez' })
  assert.deepEqual(r.data.items.map((i) => [i.name, i.qty]), [['Toned Milk', 2], ['Farm Eggs', 1], ['Potato Chips Classic', 3]]); assert.ok(r.data.unmatched.length)
  r = await call('POST', '/voice/parse', { text: 'cup noodles aur ice cream' }); assert.equal(r.data.items.length, 2)
  // craving
  r = await call('GET', '/craving?mood=gym'); assert.ok(r.data.products.length >= 4)
  // streak: today's cancelled order doesn't count, so streak 0
  r = await call('GET', '/streak', null, tok); assert.equal(r.data.current, 0)
  // budget
  r = await call('PUT', '/budget', { budget: 3000 }, tok); r = await call('GET', '/budget', null, tok); assert.equal(r.data.budget, 3000)
  // flat cart + split
  r = await call('POST', '/auth/register', { name: 'Flatmate', email: 'f@t.com', phone: '9123456780', password: 'secret1' }); const tok2 = r.data.token
  r = await call('POST', '/flats', { name: 'Room 204' }, tok); const fid = r.data.id, inv = r.data.inviteCode
  r = await call('POST', '/flats/join', { code: inv }, tok2); assert.equal(r.status, 200)
  r = await call('PUT', `/flats/${fid}/items/21`, { qty: 2 }, tok); // bread 45*2=90 by Test
  r = await call('PUT', `/flats/${fid}/items/17`, { qty: 3 }, tok2); // cola 40*3=120 by Flatmate
  assert.equal(r.data.items.length, 2); assert.equal(r.data.bill.subtotal, 210); assert.equal(r.data.bill.delivery, 0)
  assert.equal(r.data.split.reduce((s, x) => s + x.amount, 0), r.data.bill.total, 'split sums to total')
  r = await call('GET', `/flats/${fid}?mode=items`, null, tok); assert.equal(r.data.split.find((x) => x.name === 'Test').amount, 93) // viewer is payer in preview, so rounding remainder lands on them
  r = await call('POST', `/flats/${fid}/checkout`, { address: '204 Hostel Block, Bengaluru', paymentMethod: 'upi', mode: 'items' }, tok2); assert.equal(r.status, 201, JSON.stringify(r.data))
  const fcode = r.data.code; assert.equal(r.data.splits.length, 2); assert.equal(r.data.splits.find((x) => x.name === 'Flatmate').paid, 1)
  assert.equal(r.data.splits.find((x) => x.name === 'Test').paid, 0)
  r = await call('POST', `/flats/orders/${fcode}/settle`, null, tok); assert.equal(r.data.splits.find((x) => x.name === 'Test').paid, 1)
  r = await call('GET', '/streak', null, tok); assert.equal(r.data.current, 1, 'flat order counts for streak'); assert.ok(r.data.atRisk === false)
  r = await call('GET', '/budget', null, tok); assert.equal(r.data.flat, 92)
  r = await call('GET', '/orders/coupon/check?code=STREAK3', null, tok); assert.ok(r.data.couponError, 'streak locked')
  // ---- tip + reviews ----
  r = await call('PUT', '/cart/items/2', { qty: 1 }, tok2); r = await call('GET', '/orders/coupon/check?tip=20', null, tok2); assert.equal(r.data.tip, 20); assert.equal(r.data.total, r.data.subtotal + r.data.delivery + r.data.handling + 20)
  r = await call('POST', '/reviews/2', { rating: 5 }, tok2); assert.equal(r.status, 403, 'cannot review before delivery')
  r = await call('POST', '/orders', { address: '204 Hostel Block, Bengaluru', paymentMethod: 'cod', tip: 10 }, tok2); assert.equal(r.status, 201); assert.equal(r.data.tip, 10)
  const ocode = r.data.code; assert.ok(r.data.tracking.dest.lat)
  for (let i = 0; i < 3; i++) r = await call('POST', `/admin/orders/${ocode}/advance`, null, adm)
  assert.equal(r.data.status, 'delivered')
  r = await call('POST', '/reviews/2', { rating: 4, comment: 'fresh' }, tok2); assert.equal(r.status, 201)
  r = await call('GET', '/reviews/2'); assert.ok(r.data.reviews.some((x) => x.comment === 'fresh'))
  r = await call('GET', '/products/2'); assert.ok(r.data.rating > 0 && r.data.similar.length > 0)
  r = await call('GET', '/suggest?q=mil'); assert.ok(r.data.length >= 1)
  console.log('All API tests passed ✅')
} catch (e) { failed = true; console.error('FAILED:', e.stack.split('\n').slice(0,3).join(' | ')) }

// ---- Razorpay + live tracking, against a fake Razorpay API and a server with auto-progress on ----
if (!failed) {
  const SECRET = 'test_secret'
  const fake = http.createServer((req, res) => {
    let body = ''; req.on('data', (c) => (body += c)); req.on('end', () => {
      const ok = req.headers.authorization === 'Basic ' + Buffer.from('rzp_test_key:' + SECRET).toString('base64')
      res.writeHead(ok ? 200 : 401, { 'content-type': 'application/json' })
      res.end(JSON.stringify(ok ? { id: 'order_FAKE' + JSON.parse(body).receipt, amount: JSON.parse(body).amount } : { error: { description: 'auth' } }))
    })
  }).listen(3998)
  const DB2 = '/tmp/zippy-test2-' + Date.now() + '.db'
  const srv2 = spawn('node', ['server/index.js'], { env: { ...process.env, DB_FILE: DB2, PORT: 3996, STEP_SECONDS: '1,1,1', RAZORPAY_KEY_ID: 'rzp_test_key', RAZORPAY_KEY_SECRET: SECRET, RAZORPAY_API_BASE: 'http://localhost:3998' }, stdio: 'ignore' })
  const b2 = 'http://localhost:3996/api'
  const c2 = async (m, u, body, t) => { const r = await fetch(b2 + u, { method: m, headers: { 'content-type': 'application/json', ...(t ? { authorization: 'Bearer ' + t } : {}) }, body: body ? JSON.stringify(body) : undefined }); return { status: r.status, data: await r.json() } }
  try {
    await sleep(1500)
    let r = await c2('GET', '/config'); assert.equal(r.data.razorpay.keyId, 'rzp_test_key'); assert.ok(!JSON.stringify(r.data).includes(SECRET), 'secret never exposed')
    r = await c2('POST', '/auth/login', { email: 'demo@zippy.com', password: 'demo123' }); const t = r.data.token
    await c2('PUT', '/cart/items/4', { qty: 2 }, t)
    const stock0 = (await c2('GET', '/products/4')).data.stock
    r = await c2('POST', '/payments/create', { address: '12 MG Road, Bengaluru', phone: '9876543210', tip: 10 }, t); assert.equal(r.status, 201, JSON.stringify(r.data))
    const pay = r.data; assert.equal(pay.amount, (2 * 129 + 25 * 0 + 5 + 10) * 100)
    assert.equal((await c2('GET', '/products/4')).data.stock, stock0 - 2, 'stock reserved')
    { const lo = await c2('GET', '/orders', null, t); assert.equal(lo.data.length, 0, 'unpaid order hidden ' + JSON.stringify(lo.data).slice(0, 300)) }
    r = await c2('POST', '/payments/verify', { orderCode: pay.orderCode, razorpay_order_id: pay.razorpayOrderId, razorpay_payment_id: 'pay_1', razorpay_signature: 'bad' }, t); assert.equal(r.status, 400, 'bad signature rejected')
    const sig = crypto.createHmac('sha256', SECRET).update(pay.razorpayOrderId + '|pay_1').digest('hex')
    // open live stream before paying so we see placed -> delivered pushed
    const seen = []
    const ctl = new AbortController()
    const stream = fetch(b2 + `/orders/${pay.orderCode}/stream?token=${t}`, { signal: ctl.signal }).then(async (res) => {
      const rd = res.body.getReader(); const dec = new TextDecoder()
      for (;;) { const { value, done } = await rd.read(); if (done) break; for (const m of dec.decode(value).matchAll(/"status":"(\w+)"/g)) if (seen.at(-1) !== m[1]) seen.push(m[1]); if (seen.includes('delivered')) break }
    }).catch(() => {})
    r = await c2('POST', '/payments/verify', { orderCode: pay.orderCode, razorpay_order_id: pay.razorpayOrderId, razorpay_payment_id: 'pay_1', razorpay_signature: sig }, t); assert.equal(r.status, 200); assert.equal(r.data.payment_status, 'paid')
    assert.equal((await c2('GET', '/cart', null, t)).data.items.length, 0, 'cart cleared after payment')
    await Promise.race([stream, sleep(25000)]); ctl.abort()
    assert.deepEqual(seen.filter((x, i) => ['payment_pending', 'placed', 'packing', 'out_for_delivery', 'delivered'].includes(x)).slice(-4), ['placed', 'packing', 'out_for_delivery', 'delivered'], 'live status stream: ' + seen)
    // abandoned payment releases stock
    await c2('PUT', '/cart/items/4', { qty: 1 }, t)
    const s1 = (await c2('GET', '/products/4')).data.stock
    r = await c2('POST', '/payments/create', { address: '12 MG Road, Bengaluru', phone: '9876543210' }, t); assert.equal((await c2('GET', '/products/4')).data.stock, s1 - 1)
    r = await c2('POST', '/payments/cancel', { orderCode: r.data.orderCode }, t); assert.equal(r.data.status, 'cancelled'); assert.equal((await c2('GET', '/products/4')).data.stock, s1, 'stock released')
    console.log('Razorpay + live tracking tests passed ✅')
  } catch (e) { failed = true; console.error('FAILED (payments):', e.message) }
  srv2.kill(); fake.close(); for (const s of ['', '-wal', '-shm']) fs.rmSync(DB2 + s, { force: true })
}
srv.kill(); for (const s of ['', '-wal', '-shm']) fs.rmSync(DB + s, { force: true })
process.exit(failed ? 1 : 0)
