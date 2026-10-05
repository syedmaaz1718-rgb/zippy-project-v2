import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../AuthContext'

export default function Auth({ mode }) {
  const { login, register } = useAuth()
  const nav = useNavigate()
  const from = useLocation().state?.from || '/'
  const [f, setF] = useState({ name: '', email: '', phone: '', password: '' })
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })
  const submit = async (e) => {
    e.preventDefault(); setErr(''); setBusy(true)
    try { mode === 'login' ? await login(f.email, f.password) : await register(f); nav(from, { replace: true }) }
    catch (e2) { setErr(e2.message) } finally { setBusy(false) }
  }
  return (
    <form className="panel auth" onSubmit={submit}>
      <h2>{mode === 'login' ? 'Welcome back 👋' : 'Create your account'}</h2>
      {mode === 'register' && <label>Name<input value={f.name} onChange={set('name')} required /></label>}
      <label>Email<input type="email" value={f.email} onChange={set('email')} required /></label>
      {mode === 'register' && <label>Mobile<input value={f.phone} onChange={set('phone')} maxLength={10} placeholder="10-digit number" /></label>}
      <label>Password<input type="password" value={f.password} onChange={set('password')} required minLength={6} /></label>
      {err && <em>{err}</em>}
      <button className="primary" disabled={busy}>{busy ? '...' : mode === 'login' ? 'Login' : 'Sign up'}</button>
      {mode === 'login' ? <p>New here? <Link to="/register" state={{ from }}>Create account</Link></p> : <p>Have an account? <Link to="/login" state={{ from }}>Login</Link></p>}
      {mode === 'login' && <p className="hint">Demo: demo@zippy.com / demo123 · Admin: admin@zippy.com / admin123</p>}
    </form>
  )
}
