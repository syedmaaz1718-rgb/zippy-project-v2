import { useEffect, useState } from 'react'
import { get } from '../api'
import { useAuth } from '../AuthContext'
import { AREAS, nearestArea, saveLocation } from '../useDeliveryLocation'

export default function LocationModal({ onClose }) {
  const { user } = useAuth()
  const [saved, setSaved] = useState([])
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => { if (user) get('/auth/addresses').then(setSaved).catch(() => {}) }, [user])
  const pick = (loc) => { saveLocation(loc); onClose() }
  const locate = () => {
    setMsg('')
    if (!navigator.geolocation) return setMsg('Your browser does not support location. Pick an area below.')
    setBusy(true)
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setBusy(false)
        const area = nearestArea(p.coords.latitude, p.coords.longitude)
        if (area) pick({ area, line: '' })
        else setMsg('Zippy only delivers in Bengaluru in this demo, and you seem to be outside it. Pick an area below.')
      },
      () => { setBusy(false); setMsg('Could not get your location (permission denied or unavailable). Pick an area below.') },
      { timeout: 10000 }
    )
  }
  return (
    <div className="overlay center" onClick={onClose}>
      <div className="modal loc-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Choose delivery location">
        <div className="loc-head"><h3>Choose delivery location</h3><button className="x" onClick={onClose} aria-label="Close">✕</button></div>
        <button className="primary loc-gps" onClick={locate} disabled={busy}>{busy ? 'Finding you...' : '📍 Use my current location'}</button>
        {msg && <p className="loc-msg">{msg}</p>}
        {saved.length > 0 && (
          <>
            <h4>Your saved addresses</h4>
            {saved.map((a) => (
              <button key={a.id} className="loc-row" onClick={() => pick({ area: a.label, line: a.line })}>
                <b>{a.label}</b><small>{a.line}</small>
              </button>
            ))}
          </>
        )}
        <h4>Bengaluru areas</h4>
        <div className="loc-areas">
          {AREAS.map((a) => <button key={a.name} className="chip" onClick={() => pick({ area: a.name, line: '' })}>{a.name}</button>)}
        </div>
        {!user && <small className="loc-msg">Log in to see your saved addresses.</small>}
      </div>
    </div>
  )
}
