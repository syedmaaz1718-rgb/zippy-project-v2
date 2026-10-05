import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { get } from '../api'
import { STATUS_LABEL } from './OrderDetail'

export default function Orders() {
  const [orders, setOrders] = useState(null)
  useEffect(() => { get('/orders').then(setOrders) }, [])
  if (!orders) return <p className="empty">Loading...</p>
  if (!orders.length) return <div className="empty">No orders yet. <Link to="/">Start shopping</Link></div>
  return (
    <>
      <h2 className="section">Your orders</h2>
      {orders.map((o) => (
        <Link to={`/order/${o.code}`} className="panel order" key={o.code}>
          <div className="between"><b>{o.code}{o.flat_id ? ' · 🏠 Flat order' : ''}</b><span className={'status ' + o.status}>{STATUS_LABEL[o.status]}</span></div>
          <small>{new Date(o.created_at.replace(' ', 'T') + 'Z').toLocaleString()}</small>
          <div>{o.items.map((i) => `${i.emoji} ${i.name} × ${i.qty}`).join(', ')}</div>
          <b>₹{o.total}</b>
        </Link>
      ))}
    </>
  )
}
