import { Link, useNavigate, useSearchParams, useLocation } from 'react-router-dom'
import { useEffect, useRef, useState } from 'react'
import { useCart } from '../CartContext'
import { useAuth } from '../AuthContext'
import { useConfig } from '../ConfigContext'
import { get } from '../api'

export default function Navbar({ onCart, onVoice }) {
  const { count, total } = useCart()
  const { user, logout } = useAuth()
  const { theme, setTheme } = useConfig()
  const [params] = useSearchParams()
  const [menu, setMenu] = useState(false)
  const [q, setQ] = useState(params.get('q') || '')
  const [sugg, setSugg] = useState([])
  const nav = useNavigate()
  const loc = useLocation()
  const timer = useRef()

  useEffect(() => { if (loc.pathname === '/') setQ(params.get('q') || '') }, [params, loc.pathname])
  const onSearch = (e) => {
    const v = e.target.value
    setQ(v)
    nav(v ? `/?q=${encodeURIComponent(v)}` : '/', { replace: loc.pathname === '/' })
    clearTimeout(timer.current)
    timer.current = setTimeout(() => (v.trim() ? get('/suggest?q=' + encodeURIComponent(v)).then(setSugg).catch(() => {}) : setSugg([])), 150)
  }
  return (
    <header className="navbar">
      <div className="container nav-inner">
        <Link to="/" className="logo">zippy<span>⚡</span></Link>
        <div className="delivery"><b>⏱ 10 minutes</b><small>Koramangala, Bengaluru ▾</small></div>
        <div className="search-wrap" onBlur={() => setTimeout(() => setSugg([]), 150)}>
          <input className="search" placeholder='Search "milk", "chips"...' value={q} onChange={onSearch} />
          {sugg.length > 0 && (
            <div className="suggest">
              {sugg.map((s) => <Link key={s.id} to={'/product/' + s.id} onClick={() => setSugg([])}><img src={`/products/${s.id}.jpg`} alt="" width="32" height="32" style={{ borderRadius: 6, objectFit: 'cover' }} onError={(e) => { e.target.style.display = 'none' }} />{s.name}<small style={{ marginLeft: 'auto' }}>₹{s.price}</small></Link>)}
            </div>
          )}
        </div>
        <button className="theme-btn" title="Switch theme" onClick={() => setTheme(theme === 'green' ? 'purple' : 'green')}>🎨</button>
        <button className="icon-btn" title="Voice order" onClick={onVoice}>🎙️</button>
        {user ? (
          <div className="menu-wrap">
            <button className="link-btn-plain" onClick={() => setMenu(!menu)}>👤 {user.name.split(' ')[0]} ▾</button>
            {menu && (
              <div className="menu" onClick={() => setMenu(false)}>
                <Link to="/orders">📦 Orders</Link>
                <Link to="/flats">🏠 Flat Cart</Link>
                <Link to="/streak">🔥 Bhookh Streak</Link>
                <Link to="/wishlist">❤️ Wishlist</Link>
                <Link to="/budget">💰 Budget</Link>
                {user.role === 'admin' && <Link to="/admin">🛠 Admin</Link>}
                <button onClick={logout}>Logout</button>
              </div>
            )}
          </div>
        ) : (
          <Link to="/login" className="link-btn-plain">Login</Link>
        )}
        <button className="cart-btn" onClick={onCart}>🛒 {count > 0 ? `${count} · ₹${total}` : 'Cart'}</button>
      </div>
    </header>
  )
}
