import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { get } from '../api'

export default function Streak() {
  const [s, setS] = useState(null)
  useEffect(() => { get('/streak').then(setS) }, [])
  if (!s) return <p className="empty">Loading...</p>
  return (
    <div className="panel streak">
      <div className="flame">{s.current > 0 ? '🔥' : '🥶'}</div>
      <h1>{s.current}-day Bhookh Streak</h1>
      <p>Best: {s.best} days</p>
      {s.atRisk && <div className="warn">⚠️ Order something today or your streak resets at midnight!</div>}
      {s.orderedToday && <div className="saved">✓ Today's order done. Come back tomorrow!</div>}
      {s.current === 0 && <p>Place an order to start your streak.</p>}
      {s.next && <p>{s.daysToNext} more day(s) to unlock <b>{s.next.label}</b></p>}
      <h3>Rewards</h3>
      {s.rewards.map((r) => (
        <div className={'reward' + (r.unlocked ? ' on' : '')} key={r.code}>
          <span>{r.unlocked ? (r.used ? '✅' : '🎁') : '🔒'}</span>
          <div><b>{r.days}-day streak: {r.label}</b><br /><small>{r.unlocked ? (r.used ? 'Used' : `Use code ${r.code} at checkout`) : 'Locked'}</small></div>
        </div>
      ))}
      <Link to="/" className="primary link-btn">Order now</Link>
    </div>
  )
}
