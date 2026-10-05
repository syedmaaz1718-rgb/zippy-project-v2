import { useNavigate } from 'react-router-dom'
import { useCart } from '../CartContext'
import { useWishlist } from '../useWishlist'
import ProductImage from './ProductImage'
import { RatingBadge } from './Stars'

// Pass qty/onAdd/onRemove to override the normal cart (used by Flat Cart).
export default function ProductCard({ product, qty, onAdd, onRemove }) {
  const cart = useCart()
  const wish = useWishlist()
  const nav = useNavigate()
  const q = qty ?? cart.qty(product.id)
  const add = onAdd || (() => cart.add(product))
  const rem = onRemove || (() => cart.remove(product))
  const off = Math.round(((product.mrp - product.price) / product.mrp) * 100)
  const out = product.stock <= 0
  const stop = (fn) => (e) => { e.stopPropagation(); fn() }
  return (
    <div className={'card' + (out ? ' out' : '')} onClick={() => nav('/product/' + product.id)}>
      {off > 0 && <span className="off">{off}% OFF</span>}
      <button className={'heart' + (wish.has(product.id) ? ' on' : '')} onClick={stop(() => wish.toggle(product.id))} title="Wishlist">{wish.has(product.id) ? '♥' : '♡'}</button>
      <div className="pic"><ProductImage product={product} /></div>
      <div className="price"><b>₹{product.price}</b> {product.mrp > product.price && <s>₹{product.mrp}</s>}</div>
      <div className="pname">{product.name}</div>
      <div className="unit">{product.unit}{product.stock > 0 && product.stock <= 10 && <span className="low"> · only {product.stock} left</span>}</div>
      <RatingBadge rating={product.rating} count={product.reviews} />
      {out ? <button className="add" disabled>OUT OF STOCK</button> : q === 0 ? (
        <button className="add" onClick={stop(add)}>ADD</button>
      ) : (
        <div className="stepper" onClick={(e) => e.stopPropagation()}><button onClick={rem}>−</button><span>{q}</span><button onClick={add}>+</button></div>
      )}
    </div>
  )
}
