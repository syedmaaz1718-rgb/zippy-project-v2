import { useEffect, useState } from 'react'
import { get, post, del } from '../api'
import { useDeliveryLocation } from '../useDeliveryLocation'

export default function AddressPicker({ value, onChange }) {
  const [list, setList] = useState([])
  const place = useDeliveryLocation()
  const [line, setLine] = useState('')
  useEffect(() => { setLine((l) => (l && !l.endsWith(', Bengaluru') ? l : `, ${place.area}, Bengaluru`)) }, [place.area])
  const [label, setLabel] = useState('Home')
  const [err, setErr] = useState('')
  const load = () => get('/auth/addresses').then((l) => { setList(l); if (!value && l.length) onChange((l.find((a) => a.line === place.line) || l[0]).line) })
  useEffect(() => { load() }, [])
  const add = async () => {
    setErr('')
    try { const a = await post('/auth/addresses', { label, line }); setLine(`, ${place.area}, Bengaluru`); await load(); onChange(a.line) } catch (e) { setErr(e.message) }
  }
  return (
    <div className="addr">
      {list.map((a) => (
        <label key={a.id} className="radio addr-row">
          <input type="radio" checked={value === a.line} onChange={() => onChange(a.line)} />
          <span><b>{a.label}</b> · {a.line}</span>
          <button type="button" className="x" onClick={async () => { await del('/auth/addresses/' + a.id); load() }}>✕</button>
        </label>
      ))}
      <div className="addr-new">
        <select value={label} onChange={(e) => setLabel(e.target.value)}><option>Home</option><option>Hostel</option><option>Work</option><option>Other</option></select>
        <input value={line} onChange={(e) => setLine(e.target.value)} placeholder="Flat no, building, area, city" />
        <button type="button" className="add" onClick={add}>Save</button>
      </div>
      {err && <em>{err}</em>}
    </div>
  )
}
