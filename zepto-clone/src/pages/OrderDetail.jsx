import { useEffect, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { get, post, getToken } from '../api'
import { useAuth } from '../AuthContext'
import { useToast } from '../ToastContext'
import TrackMap from '../components/TrackMap'
import ProductImage from '../components/ProductImage'

export const STATUS_LABEL = { payment_pending: 'Awaiting payment', placed: 'Order placed', packing: 'Packing', out_for_delivery: 'Out for delivery', delivered: 'Delivered', cancelled: 'Cancelled' }
const STEPS = ['placed', 'packing', 'out_for_delivery', 'delivered']
const fmt = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

export default function OrderDetail() {
  const { code } = useParams()
  const { user } = useAuth()
  const toast = useToast()
  const fresh = useLocation().state?.fresh
  const [o, setO] = useState(null)
  const [err, setErr] = useState('')
  const [live, setLive] = useState(false)
  const [eta, setEta] = useState(null)

  // Live tracking: Server-Sent Events push every status change. Falls back to a plain fetch if the stream is unavailable.
  useEffect(() => {
    get('/orders/' + code).then(setO).catch((e) => setErr(e.message))
    const es = new EventSource(`/api/orders/${code}/stream?token=${encodeURIComponent(getToken())}`)
    es.onopen = () => setLive(true)
    es.onmessage = (e) => setO(JSON.parse(e.data))
    es.onerror = () => setLive(false)
    return () => es.close()
  }, [code])

  // countdown that re-syncs every time the server pushes a new status
  useEffect(() => {
    if (!o || o.tracking.etaSeconds == null) return setEta(null)
    const t0 = Date.now(), base = o.tracking.etaSeconds
    setEta(base)
    const t = setInterval(() => setEta(Math.max(0, base - Math.floor((Date.now() - t0) / 1000))), 1000)
    return () => clearInterval(t)
  }, [o?.status, o?.tracking.etaSeconds])

  if (err) return <p className="empty">{err}</p>
  if (!o) return <p className="empty">Loading...</p>
  const idx = STEPS.indexOf(o.status)
  const active = ['placed', 'packing', 'out_for_delivery'].includes(o.status)
  const mine = o.splits.find((s) => s.user_id === user.id)
  const cancel = async () => { try { setO(await post(`/orders/${code}/cancel`)); toast('Order cancelled') } catch (e) { toast(e.message, 'error') } }
  const settle = async () => { setO(await post(`/flats/orders/${code}/settle`)); toast('Marked as paid') }
  const headline = { placed: 'Order placed! 🎉', packing: 'Packing your order 📦', out_for_delivery: 'Your rider is on the way 🛵', delivered: 'Delivered. Enjoy! 🎉', cancelled: 'Order cancelled', payment_pending: 'Waiting for payment' }[o.status]
  return (
    <div className="success panel">
      <h1>{fresh && o.status === 'placed' ? '✅ ' : ''}{headline}</h1>
      <p>Order <b>{o.code}</b>{active && <> · {live && <span className="live" />}{eta != null ? <>arriving in <b>{fmt(eta)}</b></> : 'arriving in ~10 mins'}</>}</p>
      {o.status !== 'cancelled' && o.status !== 'payment_pending' && <ol className="track">{STEPS.map((s, i) => <li key={s} className={i <= idx ? 'done' : ''}>{STATUS_LABEL[s]}</li>)}</ol>}
      {(active || o.status === 'delivered') && <TrackMap tracking={o.tracking} status={o.status} />}
      {active && o.rider_name && <div className="rider"><span className="e">🛵</span><div className="left" style={{ margin: 0 }}><b>{o.rider_name}</b> is your delivery partner<br /><small>Rider details are simulated</small></div></div>}
      <div className="left">
        <h3>Items</h3>
        {o.items.map((i, k) => <div className="row" key={k}><span className="e">{i.emoji}</span><div className="info">{i.name} × {i.qty}{o.flat_id && <small> · added by {i.added_by}</small>}</div><b>₹{i.price * i.qty}</b></div>)}
        <div className="bill">
          <div><span>Items</span><span>₹{o.subtotal}</span></div><div><span>Delivery</span><span>₹{o.delivery_fee}</span></div>
          <div><span>Handling</span><span>₹{o.handling_fee}</span></div>
          {o.tip > 0 && <div><span>Tip</span><span>₹{o.tip}</span></div>}
          {o.discount > 0 && <div className="green"><span>Coupon {o.coupon}</span><span>−₹{o.discount}</span></div>}
          <div className="grand"><span>Total</span><span>₹{o.total}</span></div>
        </div>
        <p className="hint">Payment: {o.payment_method.toUpperCase()} · {o.payment_status}<br />Deliver to: {o.address}</p>
        {o.status === 'delivered' && (
          <>
            <h3>⭐ Rate your items</h3>
            <div className="chips">{[...new Map(o.items.map((i) => [i.name, i])).values()].map((i) => <ReviewLink key={i.name} name={i.name} />)}</div>
          </>
        )}
        {o.splits.length > 0 && (
          <>
            <h3>🏠 Bill split</h3>
            {o.splits.map((s) => <div className="row" key={s.user_id}><div className="info">{s.name}{s.user_id === o.user_id && ' (paid upfront)'}</div><b>₹{s.amount}</b><span className={'status ' + (s.paid ? 'delivered' : 'placed')}>{s.paid ? 'Paid' : 'Owes'}</span></div>)}
            {mine && !mine.paid && <button className="primary" onClick={settle}>Pay my share ₹{mine.amount} (mock)</button>}
          </>
        )}
      </div>
      {o.status === 'placed' && o.user_id === user.id && <button className="danger" onClick={cancel}>Cancel order</button>}
      <Link className="primary link-btn" to="/">Continue shopping</Link>
    </div>
  )
}

function ReviewLink({ name }) {
  const [id, setId] = useState(null)
  useEffect(() => { get('/products?q=' + encodeURIComponent(name)).then((r) => setId(r.find((p) => p.name === name)?.id)) }, [name])
  return id ? <Link className="chip" to={'/product/' + id}>{name} ›</Link> : null
}
