import { useEffect, useState } from 'react'
import { get, post, put, del } from '../api'
import { useToast } from '../ToastContext'
import { STATUS_LABEL } from './OrderDetail'

export default function Admin() {
  const [tab, setTab] = useState('dash')
  return (
    <>
      <h2 className="section">🛠 Admin</h2>
      <div className="seg">{[['dash', 'Dashboard'], ['products', 'Products'], ['orders', 'Orders']].map(([k, l]) => <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}</button>)}</div>
      {tab === 'dash' && <Dash />}{tab === 'products' && <Products />}{tab === 'orders' && <AdminOrders />}
    </>
  )
}

function Dash() {
  const [s, setS] = useState(null)
  useEffect(() => { get('/admin/stats').then(setS) }, [])
  if (!s) return <p className="empty">Loading...</p>
  return (
    <>
      <div className="stats">
        <div className="stat"><b>{s.orders}</b>Orders</div><div className="stat"><b>₹{s.revenue}</b>Revenue</div><div className="stat"><b>{s.customers}</b>Customers</div>
      </div>
      <div className="checkout">
        <div className="panel"><h3>Top products</h3>{s.topProducts.map((p) => <div className="row" key={p.name}><div className="info">{p.name}</div><b>{p.sold} sold</b></div>)}{!s.topProducts.length && <p className="hint">No sales yet</p>}</div>
        <div className="panel"><h3>Low stock (≤10)</h3>{s.lowStock.map((p) => <div className="row" key={p.id}><div className="info">{p.name}</div><b>{p.stock}</b></div>)}{!s.lowStock.length && <p className="hint">All good</p>}</div>
      </div>
    </>
  )
}

const blank = { name: '', category: 'snacks', emoji: '📦', price: '', mrp: '', unit: '', stock: 50 }
function Products() {
  const toast = useToast()
  const [list, setList] = useState([])
  const [cats, setCats] = useState([])
  const [f, setF] = useState(blank)
  const [editing, setEditing] = useState(null)
  const load = () => get('/admin/products').then(setList)
  useEffect(() => { load(); get('/categories').then(setCats) }, [])
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })
  const save = async () => {
    try { editing ? await put('/admin/products/' + editing, { ...f, active: true }) : await post('/admin/products', f); setF(blank); setEditing(null); load(); toast('Saved') } catch (e) { toast(e.message, 'error') }
  }
  return (
    <>
      <div className="panel pform">
        <h3>{editing ? 'Edit product' : 'Add product'}</h3>
        <div className="pgrid">
          <input placeholder="Name" value={f.name} onChange={set('name')} />
          <select value={f.category} onChange={set('category')}>{cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
          <input placeholder="Emoji" value={f.emoji} onChange={set('emoji')} />
          <input placeholder="Price" type="number" value={f.price} onChange={set('price')} />
          <input placeholder="MRP" type="number" value={f.mrp} onChange={set('mrp')} />
          <input placeholder="Unit (500 g)" value={f.unit} onChange={set('unit')} />
          <input placeholder="Stock" type="number" value={f.stock} onChange={set('stock')} />
          <button className="primary" onClick={save}>{editing ? 'Update' : 'Add'}</button>
        </div>
      </div>
      <div className="panel">
        {list.map((p) => (
          <div className={'row' + (p.active ? '' : ' faded')} key={p.id}>
            <span className="e">{p.emoji}</span><div className="info">{p.name} <small>₹{p.price} · stock {p.stock}{!p.active && ' · hidden'}</small></div>
            <button className="add" onClick={() => { setEditing(p.id); setF(p); window.scrollTo(0, 0) }}>Edit</button>
            {p.active && <button className="danger small" onClick={async () => { await del('/admin/products/' + p.id); load() }}>Hide</button>}
          </div>
        ))}
      </div>
    </>
  )
}

function AdminOrders() {
  const toast = useToast()
  const [orders, setOrders] = useState([])
  const load = () => get('/admin/orders').then(setOrders)
  useEffect(() => { load() }, [])
  const adv = async (code) => { try { await post(`/admin/orders/${code}/advance`); load() } catch (e) { toast(e.message, 'error') } }
  return (
    <div>
      {orders.map((o) => (
        <div className="panel order" key={o.code}>
          <div className="between"><b>{o.code} · {o.customer}</b><span className={'status ' + o.status}>{STATUS_LABEL[o.status]}</span></div>
          <small>{o.address}</small>
          <div>{o.items.map((i) => `${i.emoji} ${i.name} × ${i.qty}`).join(', ')}</div>
          <div className="between"><b>₹{o.total} · {o.payment_method} · {o.payment_status}</b>
            {['placed', 'packing', 'out_for_delivery'].includes(o.status) && <button className="add" onClick={() => adv(o.code)}>Advance →</button>}</div>
        </div>
      ))}
      {!orders.length && <p className="empty">No orders yet.</p>}
    </div>
  )
}
