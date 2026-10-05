import { useNavigate } from 'react-router-dom'
import { useCart } from '../CartContext'
import { useAuth } from '../AuthContext'
import ProductImage from './ProductImage'

export default function CartDrawer({ open, onClose }) {
  const c = useCart()
  const { user } = useAuth()
  const nav = useNavigate()
  if (!open) return null
  const go = () => { onClose(); nav(user ? '/checkout' : '/login', { state: { from: '/checkout' } }) }
  return (
    <div className="overlay" onClick={onClose}>
      <aside className="drawer" onClick={(e) => e.stopPropagation()}>
        <div className="drawer-head"><h3>My Cart</h3><button onClick={onClose}>✕</button></div>
        {c.lines.length === 0 ? (
          <p className="empty">Your cart is empty 🛒<br />Add something tasty!</p>
        ) : (
          <>
            <div className="eta">⏱ Delivery in 10 minutes</div>
            {c.savings > 0 && <div className="saved">🎉 You're saving ₹{c.savings} on this order</div>}
            <div className="drawer-items">
              {c.lines.map((l) => (
                <div className="row" key={l.product_id}>
                  <span className="e thumb"><ProductImage product={{ id: l.product_id, name: l.name, emoji: l.emoji }} /></span>
                  <div className="info"><div>{l.name}</div><small>{l.unit}</small></div>
                  <div className="stepper small">
                    <button onClick={() => c.remove(l)}>−</button><span>{l.qty}</span><button onClick={() => c.add(l)}>+</button>
                  </div>
                  <b>₹{l.qty * l.price}</b>
                </div>
              ))}
            </div>
            <div className="bill">
              <div><span>Items total</span><span>₹{c.subtotal}</span></div>
              <div><span>Delivery {c.delivery === 0 && '(free above ₹199)'}</span><span>₹{c.delivery}</span></div>
              <div><span>Handling fee</span><span>₹{c.handling}</span></div>
              <div className="grand"><span>To pay</span><span>₹{c.total}</span></div>
            </div>
            <button className="primary" onClick={go}>{user ? 'Proceed to Checkout' : 'Login to checkout'}</button>
          </>
        )}
      </aside>
    </div>
  )
}
