import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { get, post } from '../api'
import { useToast } from '../ToastContext'

export default function Flats() {
  const nav = useNavigate()
  const toast = useToast()
  const [flats, setFlats] = useState(null)
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  useEffect(() => { get('/flats').then(setFlats) }, [])
  const create = async () => { try { nav('/flats/' + (await post('/flats', { name })).id) } catch (e) { toast(e.message, 'error') } }
  const join = async () => { try { nav('/flats/' + (await post('/flats/join', { code })).id) } catch (e) { toast(e.message, 'error') } }
  return (
    <>
      <h2 className="section">🏠 Flat Cart</h2>
      <p className="hint">Ek shared cart, sab flatmates add karein, bill automatically split.</p>
      <div className="checkout">
        <div className="panel"><h3>Create a flat</h3><div className="coupon-row"><input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Room 204 gang" /><button className="add" onClick={create}>Create</button></div></div>
        <div className="panel"><h3>Join with invite code</h3><div className="coupon-row"><input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="6-char code" /><button className="add" onClick={join}>Join</button></div></div>
      </div>
      <h3 className="section">Your flats</h3>
      {!flats ? <p className="empty">Loading...</p> : flats.length === 0 ? <p className="empty">No flats yet.</p> : flats.map((f) => (
        <Link key={f.id} to={'/flats/' + f.id} className="panel order"><div className="between"><b>{f.name}</b><span className="chip">{f.inviteCode}</span></div><small>{f.memberCount} members · {f.itemCount} items in cart</small></Link>
      ))}
    </>
  )
}
