import { useEffect, useState } from 'react'
import { get } from '../api'

export default function CouponBox({ onApply, bill }) {
  const [code, setCode] = useState('')
  const [list, setList] = useState([])
  useEffect(() => { get('/coupons').then(setList).catch(() => {}) }, [])
  return (
    <div className="coupon">
      <div className="coupon-row">
        <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="Promo code" />
        <button type="button" className="add" onClick={() => onApply(code)}>Apply</button>
      </div>
      {bill?.couponError && <em>{bill.couponError}</em>}
      {bill?.coupon && <span className="green">✓ {bill.coupon} applied</span>}
      <div className="chips">{list.map((c) => <button type="button" key={c.code} className="chip" title={c.description} onClick={() => { setCode(c.code); onApply(c.code) }}>{c.code}</button>)}</div>
    </div>
  )
}
