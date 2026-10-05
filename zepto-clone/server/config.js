// Central runtime config (all optional - the app runs with defaults).
export const STEPS = (process.env.STEP_SECONDS || '20,30,60').split(',').map(Number)
export const AUTO_PROGRESS = process.env.AUTO_PROGRESS !== '0'
export const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID || ''
export const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || ''
export const RAZORPAY_API = process.env.RAZORPAY_API_BASE || 'https://api.razorpay.com/v1'
export const razorpayEnabled = () => !!(RAZORPAY_KEY_ID && RAZORPAY_KEY_SECRET)
// The mocked dark store (Koramangala, Bengaluru). Delivery destinations are derived near it.
export const STORE = { lat: 12.9352, lng: 77.6245 }
