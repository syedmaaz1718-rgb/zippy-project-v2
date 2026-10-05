import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useCart } from '../CartContext'
import { useAuth } from '../AuthContext'
import { useConfig } from '../ConfigContext'
import { get, post } from '../api'
import AddressPicker from '../components/AddressPicker'
import CouponBox from '../components/CouponBox'
import ProductImage from '../components/ProductImage'

const TIPS = [0, 10, 20, 30, 50]

function loadRazorpay() {
  return new Promise((resolve, reject) => {
    if (window.Razorpay) return resolve()
    const s = document.createElement('script')
    s.src = 'https://checkout.razorpay.com/v1/checkout.js'
    s.onload = resolve
    s.onerror = () => reject(new Error('Could not load Razorpay. Check your internet connection.'))
    document.body.appendChild(s)
  })
}

export default function Checkout() {
  const c = useCart()
  const { user } = useAuth()
  const { razorpay } = useConfig()
  const nav = useNavigate()
  const [addr, setAddr] = useState('')
  const [phone, setPhone] = useState(user.phone || '')
  const [pay, setPay] = useState(null)
  const [tip, setTip] = useState(0)
  const [coupon, setCoupon] = useState('')
  const [bill, setBill] = useState(null)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  const method = pay || (razorpay ? 'razorpay' : 'upi')
  useEffect(() => { c.reload() }, [])
  useEffect(() => {
    get(`/orders/coupon/check?tip=${tip}${coupon ? '&code=' + coupon : ''}`).then(setBill).catch(() => {})
  }, [coupon, tip, c.subtotal])

  if (c.lines.length === 0 && !busy) return <div className="empty">Your cart is empty. <Link to="/">Go shopping</Link></div>
  const b = bill || { ...c, discount: 0, tip: 0 }

  const done = (code) => { c.clear(); nav(`/order/${code}`, { state: { fresh: true } }) }
  const submit = async (e) => {
    e.preventDefault(); setErr(''); setBusy(true)
    const payload = { address: addr, phone, coupon: bill?.coupon || undefined, tip }
    try {
      if (method === 'razorpay') {
        await loadRazorpay()
        const d = await post('/payments/create', payload)
        const abandon = () => post('/payments/cancel', { orderCode: d.orderCode }).catch(() => {})
        const rzp = new window.Razorpay({
          key: d.keyId, amount: d.amount, currency: 'INR', name: 'Zippy', description: 'Order ' + d.orderCode, order_id: d.razorpayOrderId,
          prefill: { name: d.name, email: d.email, contact: d.phone }, theme: { color: '#0b7a3b' },
          handler: async (resp) => {
            try { await post('/payments/verify', { orderCode: d.orderCode, ...resp }); done(d.orderCode) } catch (e2) { setErr(e2.message); setBusy(false) }
          },
          modal: { ondismiss: () => { abandon(); setBusy(false) } },
        })
        rzp.on('payment.failed', (r) => { setErr('Payment failed: ' + (r.error?.description || 'try again')); abandon(); setBusy(false) })
        rzp.open()
      } else {
        const o = await post('/orders', { ...payload, paymentMethod: method })
        done(o.code)
      }
    } catch (e2) { setErr(e2.message); setBusy(false) }
  }
  const opts = razorpay
    ? [['razorpay', 'Pay online (UPI / Card / Netbanking) - Razorpay test mode'], ['cod', 'Cash on delivery']]
    : [['upi', 'UPI (mock)'], ['card', 'Credit / Debit card (mock)'], ['cod', 'Cash on delivery']]
  return (
    <div className="checkout">
      <form onSubmit={submit} className="panel">
        <h2>Delivery address</h2>
        <AddressPicker value={addr} onChange={setAddr} />
        <label>Mobile<input value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={10} /></label>
        <h2>Tip your delivery partner 🛵</h2>
        <div className="tips">{TIPS.map((t) => <button type="button" key={t} className={'tipbtn' + (tip === t ? ' on' : '')} onClick={() => setTip(t)}>{t === 0 ? 'No tip' : '₹' + t}</button>)}</div>
        <h2>Payment</h2>
        {!razorpay && <p className="hint">Payment gateway is not configured on this server, so payment is simulated.</p>}
        {opts.map(([v, l]) => <label key={v} className="radio"><input type="radio" name="pay" checked={method === v} onChange={() => setPay(v)} /> {l}</label>)}
        {err && <em>{err}</em>}
        <button className="primary" disabled={busy || !addr}>{busy ? 'Processing...' : `${method === 'razorpay' ? 'Pay' : 'Place order'} · ₹${b.total}`}</button>
      </form>
      <div className="panel">
        <h2>Order summary</h2>
        {c.lines.map((l) => <div className="row" key={l.product_id}><span className="e thumb"><ProductImage product={{ id: l.product_id, name: l.name, emoji: l.emoji }} /></span><div className="info">{l.name} × {l.qty}</div><b>₹{l.qty * l.price}</b></div>)}
        <CouponBox onApply={setCoupon} bill={bill} />
        <div className="bill">
          <div><span>Items total</span><span>₹{b.subtotal}</span></div>
          <div><span>Delivery</span><span>₹{b.delivery}</span></div>
          <div><span>Handling fee</span><span>₹{b.handling}</span></div>
          {b.tip > 0 && <div><span>Delivery tip</span><span>₹{b.tip}</span></div>}
          {b.discount > 0 && <div className="green"><span>Coupon {b.coupon}</span><span>−₹{b.discount}</span></div>}
          <div className="grand"><span>To pay</span><span>₹{b.total}</span></div>
        </div>
      </div>
    </div>
  )
}
