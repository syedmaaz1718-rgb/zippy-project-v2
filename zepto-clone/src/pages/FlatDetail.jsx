import { useEffect, useState, useCallback } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { get, post, put } from '../api'
import { useAuth } from '../AuthContext'
import { useToast } from '../ToastContext'
import ProductCard from '../components/ProductCard'
import AddressPicker from '../components/AddressPicker'
import CouponBox from '../components/CouponBox'

export default function FlatDetail() {
  const { id } = useParams()
  const { user } = useAuth()
  const nav = useNavigate()
  const toast = useToast()
  const [flat, setFlat] = useState(null)
  const [orders, setOrders] = useState([])
  const [products, setProducts] = useState([])
  const [q, setQ] = useState('')
  const [mode, setMode] = useState('items')
  const [coupon, setCoupon] = useState('')
  const [addr, setAddr] = useState('')
  const [pay, setPay] = useState('upi')
  const [busy, setBusy] = useState(false)

  const load = useCallback(() => get(`/flats/${id}?mode=${mode}${coupon ? '&coupon=' + coupon : ''}`).then(setFlat).catch((e) => toast(e.message, 'error')), [id, mode, coupon])
  useEffect(() => { load(); const t = setInterval(load, 4000); return () => clearInterval(t) }, [load]) // light polling so flatmates' adds show up
  useEffect(() => { get(`/flats/${id}/orders`).then(setOrders) }, [id, flat?.items.length])
  useEffect(() => { get('/products' + (q ? '?q=' + encodeURIComponent(q) : '')).then(setProducts) }, [q])

  const mine = (pid) => flat?.items.find((i) => i.product_id === pid && i.added_by === user.id)?.qty || 0
  const setQty = async (p, qty) => { try { setFlat(await put(`/flats/${id}/items/${p.id}`, { qty, mode, coupon: coupon || undefined })) } catch (e) { toast(e.message, 'error') } }
  const checkout = async () => {
    setBusy(true)
    try {
      const o = await post(`/flats/${id}/checkout`, { address: addr, paymentMethod: pay, mode, coupon: flat.bill.coupon || undefined })
      nav('/order/' + o.code, { state: { fresh: true } })
    } catch (e) { toast(e.message, 'error'); setBusy(false) }
  }
  if (!flat) return <p className="empty">Loading...</p>
  const b = flat.bill
  return (
    <>
      <div className="between"><h2 className="section">🏠 {flat.name}</h2><span className="chip" title="Share this with flatmates">Invite code: <b>{flat.inviteCode}</b></span></div>
      <p className="hint">Members: {flat.members.map((m) => m.name).join(', ')}. Share the invite code so flatmates can join and add to the same cart.</p>
      <div className="checkout">
        <div>
          <div className="panel">
            <h3>Shared cart</h3>
            {flat.items.length === 0 ? <p className="hint">Empty. Add items from the list below.</p> : flat.items.map((i) => (
              <div className="row" key={i.product_id + '-' + i.added_by}>
                <span className="e">{i.emoji}</span><div className="info">{i.name} × {i.qty}<br /><small>added by {i.added_by === user.id ? 'you' : i.added_by_name}</small></div><b>₹{i.price * i.qty}</b>
              </div>
            ))}
          </div>
          <h3 className="section">Add items</h3>
          <input className="search wide" placeholder="Search products..." value={q} onChange={(e) => setQ(e.target.value)} />
          <div className="grid small">{products.slice(0, 24).map((p) => <ProductCard key={p.id} product={p} qty={mine(p.id)} onAdd={() => setQty(p, mine(p.id) + 1)} onRemove={() => setQty(p, mine(p.id) - 1)} />)}</div>
        </div>
        <div>
          <div className="panel">
            <h3>Bill split</h3>
            <div className="seg"><button className={mode === 'items' ? 'on' : ''} onClick={() => setMode('items')}>By items</button><button className={mode === 'equal' ? 'on' : ''} onClick={() => setMode('equal')}>Split equally</button></div>
            {flat.split.map((s) => <div className="row" key={s.id}><div className="info">{s.name}{s.id === user.id && ' (you)'}</div><b>₹{s.amount}</b></div>)}
            <p className="hint">Whoever places the order pays upfront; others settle their share from the order page.</p>
            <CouponBox onApply={setCoupon} bill={b} />
            <div className="bill">
              <div><span>Items</span><span>₹{b.subtotal}</span></div><div><span>Delivery</span><span>₹{b.delivery}</span></div><div><span>Handling</span><span>₹{b.handling}</span></div>
              {b.discount > 0 && <div className="green"><span>Coupon</span><span>−₹{b.discount}</span></div>}
              <div className="grand"><span>Total</span><span>₹{b.total}</span></div>
            </div>
          </div>
          <div className="panel" style={{ marginTop: 12 }}>
            <h3>Place group order</h3>
            <AddressPicker value={addr} onChange={setAddr} />
            {[['upi', 'UPI'], ['card', 'Card'], ['cod', 'Cash on delivery']].map(([v, l]) => <label key={v} className="radio"><input type="radio" checked={pay === v} onChange={() => setPay(v)} /> {l}</label>)}
            <button className="primary" disabled={busy || !addr || flat.items.length === 0} onClick={checkout}>Place order · ₹{b.total}</button>
          </div>
          {orders.length > 0 && (
            <div className="panel" style={{ marginTop: 12 }}>
              <h3>Past flat orders</h3>
              {orders.map((o) => <Link key={o.code} to={'/order/' + o.code} className="row"><div className="info">{o.code} · {o.status}</div><b>₹{o.total}</b>{o.splits.some((s) => !s.paid) && <span className="status placed">Unsettled</span>}</Link>)}
            </div>
          )}
        </div>
      </div>
    </>
  )
}
