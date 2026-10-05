import { useEffect, useState } from 'react'
import { get } from '../api'
import { useCart } from '../CartContext'
import ProductCard from '../components/ProductCard'

export default function Craving() {
  const cart = useCart()
  const [moods, setMoods] = useState([])
  const [data, setData] = useState(null)
  useEffect(() => {
    get('/craving/moods').then((m) => {
      setMoods(m)
      const h = new Date().getHours()
      pick(h >= 22 || h < 5 ? 'late_night' : null)
    })
  }, [])
  const pick = (id) => id && get('/craving?mood=' + id).then(setData)
  return (
    <>
      <h2 className="section">😋 Craving Mode</h2>
      <p className="hint">Kaisa feel ho raha hai? Mood chuno, hum snacks suggest karenge.</p>
      <div className="moods">
        {moods.map((m) => <button key={m.id} className={'mood' + (data?.mood.id === m.id ? ' active' : '')} onClick={() => pick(m.id)}><span>{m.emoji}</span>{m.label}</button>)}
      </div>
      {data && (
        <>
          <div className="mood-banner">{data.mood.emoji} <b>{data.mood.label}</b> - {data.mood.line}
            <button className="primary small" onClick={() => cart.addMany(data.products.slice(0, 4).map((p) => ({ ...p, qty: 1 })))}>Add top 4 to cart</button>
          </div>
          <div className="grid">{data.products.map((p) => <ProductCard key={p.id} product={p} />)}</div>
        </>
      )}
    </>
  )
}
