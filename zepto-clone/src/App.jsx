import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { useState } from 'react'
import { useAuth } from './AuthContext'
import Navbar from './components/Navbar'
import CartDrawer from './components/CartDrawer'
import VoiceOrder from './components/VoiceOrder'
import Home from './pages/Home'
import Auth from './pages/Auth'
import Checkout from './pages/Checkout'
import OrderDetail from './pages/OrderDetail'
import Orders from './pages/Orders'
import Wishlist from './pages/Wishlist'
import Craving from './pages/Craving'
import Streak from './pages/Streak'
import Budget from './pages/Budget'
import Flats from './pages/Flats'
import FlatDetail from './pages/FlatDetail'
import Admin from './pages/Admin'
import ProductDetail from './pages/ProductDetail'

function Private({ children, admin }) {
  const { user, ready } = useAuth()
  const loc = useLocation()
  if (!ready) return <p className="empty">Loading...</p>
  if (!user) return <Navigate to="/login" state={{ from: loc.pathname }} replace />
  if (admin && user.role !== 'admin') return <p className="empty">Admins only.</p>
  return children
}

export default function App() {
  const [cartOpen, setCartOpen] = useState(false)
  const [voiceOpen, setVoiceOpen] = useState(false)
  return (
    <>
      <Navbar onCart={() => setCartOpen(true)} onVoice={() => setVoiceOpen(true)} />
      <main className="container">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/product/:id" element={<ProductDetail />} />
          <Route path="/login" element={<Auth mode="login" />} />
          <Route path="/register" element={<Auth mode="register" />} />
          <Route path="/craving" element={<Craving />} />
          <Route path="/checkout" element={<Private><Checkout /></Private>} />
          <Route path="/order/:code" element={<Private><OrderDetail /></Private>} />
          <Route path="/orders" element={<Private><Orders /></Private>} />
          <Route path="/wishlist" element={<Private><Wishlist /></Private>} />
          <Route path="/streak" element={<Private><Streak /></Private>} />
          <Route path="/budget" element={<Private><Budget /></Private>} />
          <Route path="/flats" element={<Private><Flats /></Private>} />
          <Route path="/flats/:id" element={<Private><FlatDetail /></Private>} />
          <Route path="/admin" element={<Private admin><Admin /></Private>} />
          <Route path="*" element={<p className="empty">Page not found</p>} />
        </Routes>
      </main>
      <CartDrawer open={cartOpen} onClose={() => setCartOpen(false)} />
      <VoiceOrder open={voiceOpen} onClose={() => setVoiceOpen(false)} onCart={() => setCartOpen(true)} />
    </>
  )
}
