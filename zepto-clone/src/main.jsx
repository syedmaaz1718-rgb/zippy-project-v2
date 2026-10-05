import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { AuthProvider } from './AuthContext'
import { CartProvider } from './CartContext'
import { WishlistProvider } from './useWishlist'
import { ToastProvider } from './ToastContext'
import { ConfigProvider } from './ConfigContext'
import './styles.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <BrowserRouter>
    <ConfigProvider><ToastProvider>
      <AuthProvider>
        <CartProvider><WishlistProvider>
          <App />
        </WishlistProvider></CartProvider>
      </AuthProvider>
    </ToastProvider></ConfigProvider>
  </BrowserRouter>
)
