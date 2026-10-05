import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { get } from '../api'
import { useAuth } from '../AuthContext'
import ProductCard from '../components/ProductCard'

export default function Home() {
  const [params, setParams] = useSearchParams()
  const q = params.get('q') || ''
  const category = params.get('cat') || ''
  const sort = params.get('sort') || ''
  const [cats, setCats] = useState([])
  const [items, setItems] = useState([])
  const { user } = useAuth()
  const [late, setLate] = useState([])
  const [deals, setDeals] = useState([])
  const [again, setAgain] = useState([])
  const [loading, setLoading] = useState(true)
  const hour = new Date().getHours()
  const night = hour >= 22 || hour < 5

  useEffect(() => { get('/categories').then(setCats); get('/products?tag=latenight').then(setLate); get('/products?tag=deals&limit=10').then(setDeals) }, [])
  useEffect(() => {
    if (!user) return setAgain([])
    get('/orders').then(async (os) => {
      const names = [...new Set(os.flatMap((o) => o.items.map((i) => i.name)))].slice(0, 8)
      const all = await get('/products')
      setAgain(all.filter((p) => names.includes(p.name)))
    }).catch(() => {})
  }, [user])
  useEffect(() => {
    setLoading(true)
    const qs = new URLSearchParams({ ...(category && { category }), ...(q && { q }), ...(sort && { sort }) })
    get('/products?' + qs).then((r) => { setItems(r); setLoading(false) })
  }, [category, q, sort])

  const setParam = (k, v) => { const n = new URLSearchParams(params); v ? n.set(k, v) : n.delete(k); setParams(n) }
  const activeCat = cats.find((c) => c.id === category)
  const browsing = !q && !category

  return (
    <>
      {browsing && (
        <>
          <section className="hero">
            <div><h1>Groceries in 10 minutes ⚡</h1><p>Free delivery above ₹199 · Use code <b>WELCOME50</b></p></div>
            <div className="hero-emoji">🛵</div>
          </section>
          <div className="banners">
            <Link to="/?cat=snacks" className="banner b1"><b>Snack attack 🍟</b><span>Flat ₹50 off above ₹299</span><span className="code">WELCOME50</span></Link>
            <Link to="/craving" className="banner b2"><b>Study-night combo</b><span>10% off above ₹150</span><span className="code">ZIPPY10</span></Link>
            <Link to="/streak" className="banner b3"><b>Order daily, win rewards</b><span>Bhookh Streak unlocks free delivery</span><span className="code">STREAK14</span></Link>
          </div>
          <div className="feature-row">
            <Link to="/craving" className="feature pink">😋<b>Craving Mode</b><small>Mood batao, snacks pao</small></Link>
            <Link to="/flats" className="feature blue">🏠<b>Flat Cart</b><small>Group order + split bill</small></Link>
            <Link to="/streak" className="feature orange">🔥<b>Bhookh Streak</b><small>Order daily, earn rewards</small></Link>
          </div>
        </>
      )}
      <h2 className="section">Shop by category</h2>
      <div className="cats">
        {cats.map((c) => (
          <button key={c.id} className={'cat' + (c.id === category ? ' active' : '')} style={{ background: c.color }} onClick={() => setParam('cat', c.id === category ? '' : c.id)}>
            <span>{c.emoji}</span>{c.name}
          </button>
        ))}
      </div>
      {browsing && again.length > 0 && (<><h2 className="section">🔁 Buy again</h2><div className="hscroll">{again.map((p) => <ProductCard key={p.id} product={p} />)}</div></>)}
      {browsing && deals.length > 0 && (<><h2 className="section">🏷️ Deals of the day</h2><div className="hscroll">{deals.map((p) => <ProductCard key={p.id} product={p} />)}</div></>)}
      {browsing && late.length > 0 && (
        <>
          <h2 className="section">🌙 Late-night cravings {night && <span className="chip-live">on now</span>}</h2>
          <div className="hscroll">{late.map((p) => <ProductCard key={p.id} product={p} />)}</div>
        </>
      )}
      <div className="section-head">
        <h2 className="section">{q ? `Results for "${q}"` : activeCat ? activeCat.name : 'All products'}</h2>
        <select value={sort} onChange={(e) => setParam('sort', e.target.value)}>
          <option value="">Sort: Relevance</option><option value="price_asc">Price: low to high</option><option value="price_desc">Price: high to low</option><option value="discount">Biggest discount</option><option value="rating">Top rated</option>
        </select>
      </div>
      {loading ? <p className="empty">Loading...</p> : items.length === 0 ? <p className="empty">No products found 😕</p> : (
        <div className="grid">{items.map((p) => <ProductCard key={p.id} product={p} />)}</div>
      )}
    </>
  )
}
