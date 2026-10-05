import { useEffect, useState, useCallback } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { get, post } from '../api'
import { useAuth } from '../AuthContext'
import { useCart } from '../CartContext'
import { useToast } from '../ToastContext'
import ProductImage from '../components/ProductImage'
import ProductCard from '../components/ProductCard'
import { Stars } from '../components/Stars'

export default function ProductDetail() {
  const { id } = useParams()
  const nav = useNavigate()
  const { user } = useAuth()
  const cart = useCart()
  const toast = useToast()
  const [p, setP] = useState(null)
  const [rev, setRev] = useState(null)
  const [can, setCan] = useState(null)
  const [stars, setStars] = useState(5)
  const [text, setText] = useState('')

  const loadReviews = useCallback(() => {
    get('/reviews/' + id).then(setRev)
    if (user) get(`/reviews/${id}/can-review`).then((c) => { setCan(c); if (c.mine) { setStars(c.mine.rating); setText(c.mine.comment || '') } }).catch(() => {})
  }, [id, user])
  useEffect(() => { setP(null); get('/products/' + id).then(setP).catch(() => setP(false)); loadReviews(); window.scrollTo(0, 0) }, [id, loadReviews])

  if (p === false) return <p className="empty">Product not found. <Link to="/">Home</Link></p>
  if (!p || !rev) return <p className="empty">Loading...</p>
  const q = cart.qty(p.id)
  const off = Math.round(((p.mrp - p.price) / p.mrp) * 100)
  const submit = async () => {
    try { await post('/reviews/' + id, { rating: stars, comment: text }); toast('Thanks for your review!'); loadReviews(); get('/products/' + id).then(setP) } catch (e) { toast(e.message, 'error') }
  }
  const max = Math.max(1, ...rev.dist.map((d) => d.c))
  return (
    <>
      <button className="back" onClick={() => nav(-1)}>← Back</button>
      <div className="pd">
        <div className="bigpic"><ProductImage product={p} /></div>
        <div>
          <small className="hint">{p.category}</small>
          <h1>{p.name}</h1>
          <div className="hint">{p.unit}</div>
          {rev.summary.count > 0 && <div><Stars value={rev.summary.avg} /> <b>{rev.summary.avg}</b> <small className="hint">({rev.summary.count} reviews)</small></div>}
          <div className="pprice">₹{p.price} {p.mrp > p.price && <><s>₹{p.mrp}</s> <span className="rate">{off}% OFF</span></>}</div>
          <div className="eta" style={{ marginBottom: 12 }}>⏱ Delivery in 10 minutes</div>
          {p.stock <= 0 ? <button className="add" disabled>OUT OF STOCK</button> : q === 0 ? <button className="add" onClick={() => cart.add(p)}>ADD TO CART</button> : <div className="stepper"><button onClick={() => cart.remove(p)}>−</button><span>{q}</span><button onClick={() => cart.add(p)}>+</button></div>}
          {p.stock > 0 && p.stock <= 10 && <p className="low">Only {p.stock} left</p>}
        </div>
      </div>

      <h2 className="section">Ratings & reviews</h2>
      <div className="checkout">
        <div className="panel">
          {rev.reviews.length === 0 && <p className="hint">No reviews yet.</p>}
          {rev.reviews.map((r) => (
            <div className="review" key={r.id}><Stars value={r.rating} /> <b>{r.name}</b> <small>· verified buyer</small>{r.comment && <p>{r.comment}</p>}</div>
          ))}
        </div>
        <div className="panel">
          {[5, 4, 3, 2, 1].map((n) => { const c = rev.dist.find((d) => d.rating === n)?.c || 0; return <div className="dist" key={n}>{n}★<div className="b"><div style={{ width: (c / max) * 100 + '%' }} /></div>{c}</div> })}
          <h3 style={{ marginTop: 16 }}>Rate this product</h3>
          {!user ? <p className="hint"><Link to="/login" state={{ from: '/product/' + id }}>Login</Link> to review.</p>
            : can?.canReview ? (
              <>
                <div className="stars-input">{[1, 2, 3, 4, 5].map((n) => <button key={n} className={n <= stars ? 'on' : ''} onClick={() => setStars(n)}>★</button>)}</div>
                <textarea rows={3} style={{ width: '100%' }} placeholder="How was it? (optional)" value={text} onChange={(e) => setText(e.target.value)} />
                <button className="primary" onClick={submit}>{can.mine ? 'Update review' : 'Submit review'}</button>
              </>
            ) : <p className="hint">You can review this product after it has been delivered to you.</p>}
        </div>
      </div>

      {p.similar.length > 0 && <><h2 className="section">Similar products</h2><div className="hscroll">{p.similar.map((s) => <ProductCard key={s.id} product={s} />)}</div></>}
    </>
  )
}
