import { useEffect, useState } from 'react'
import { get, put } from '../api'
import { useToast } from '../ToastContext'

export default function Budget() {
  const toast = useToast()
  const [d, setD] = useState(null)
  const [val, setVal] = useState('')
  const load = () => get('/budget').then((r) => { setD(r); setVal(r.budget || '') })
  useEffect(() => { load() }, [])
  if (!d) return <p className="empty">Loading...</p>
  const pct = d.budget ? Math.min(100, Math.round((d.spent / d.budget) * 100)) : 0
  const save = async () => { try { await put('/budget', { budget: Number(val) }); toast('Budget saved'); load() } catch (e) { toast(e.message, 'error') } }
  return (
    <div className="panel">
      <h2>💰 Monthly budget</h2>
      <div className="coupon-row"><input type="number" value={val} onChange={(e) => setVal(e.target.value)} placeholder="₹ per month" /><button className="add" onClick={save}>Save</button></div>
      <div className="bar"><div className={'fill' + (pct >= 90 ? ' hot' : '')} style={{ width: pct + '%' }} /></div>
      <p><b>₹{d.spent}</b> spent this month{d.budget ? <> of ₹{d.budget} · {d.remaining >= 0 ? `₹${d.remaining} left` : `over by ₹${-d.remaining}`}</> : ' (set a budget above)'}</p>
      <p className="hint">Personal orders ₹{d.personal} + your share of Flat Cart orders ₹{d.flat}</p>
      <h3>By category</h3>
      {d.byCategory.length === 0 ? <p className="hint">No orders this month yet.</p> : d.byCategory.map((c) => <div className="row" key={c.name}><span className="e">{c.emoji}</span><div className="info">{c.name}</div><b>₹{c.spent}</b></div>)}
    </div>
  )
}
