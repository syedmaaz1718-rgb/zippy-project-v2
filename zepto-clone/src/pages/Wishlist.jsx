import { useEffect, useState } from 'react'
import { get } from '../api'
import ProductCard from '../components/ProductCard'
import { useWishlist } from '../useWishlist'

export default function Wishlist() {
  const [items, setItems] = useState(null)
  const wish = useWishlist()
  useEffect(() => { get('/wishlist').then(setItems) }, [])
  const shown = (items || []).filter((p) => wish.has(p.id))
  return (
    <>
      <h2 className="section">❤️ Your wishlist</h2>
      {!items ? <p className="empty">Loading...</p> : shown.length === 0 ? <p className="empty">Nothing saved yet. Tap the heart on any product.</p> : <div className="grid">{shown.map((p) => <ProductCard key={p.id} product={p} />)}</div>}
    </>
  )
}
