import { useState, useRef } from 'react'
import { post } from '../api'
import { useCart } from '../CartContext'
import { useToast } from '../ToastContext'

const SR = typeof window !== 'undefined' ? window.SpeechRecognition || window.webkitSpeechRecognition : null

// Voice Order: speak or type a Hinglish command, e.g. "2 doodh aur ek dozen ande add karo"
export default function VoiceOrder({ open, onClose, onCart }) {
  const cart = useCart()
  const toast = useToast()
  const [text, setText] = useState('')
  const [result, setResult] = useState(null)
  const [listening, setListening] = useState(false)
  const rec = useRef(null)
  if (!open) return null

  const parse = async (t) => {
    try { setResult(await post('/voice/parse', { text: t })) } catch (e) { toast(e.message, 'error') }
  }
  const listen = () => {
    if (!SR) return toast('Voice not supported in this browser (use Chrome). Type instead.', 'error')
    const r = new SR()
    r.lang = 'hi-IN'
    r.interimResults = false
    r.onstart = () => setListening(true)
    r.onend = () => setListening(false)
    r.onresult = (e) => { const t = e.results[0][0].transcript; setText(t); parse(t) }
    r.onerror = () => toast('Could not hear you, try again', 'error')
    rec.current = r
    r.start()
  }
  const addAll = async () => {
    await cart.addMany(result.items.map((i) => ({ id: i.productId, name: i.name, emoji: i.emoji, price: i.price, mrp: i.price, unit: i.unit, stock: 99, qty: i.qty })))
    toast(`Added ${result.items.length} item(s) to cart`)
    setResult(null); setText(''); onClose(); onCart()
  }
  return (
    <div className="overlay center" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="drawer-head"><h3>🎙️ Voice Order</h3><button onClick={onClose}>✕</button></div>
        <p className="hint">Bolo ya likho: <i>"2 doodh, ek dozen ande aur teen chips add karo"</i></p>
        <div className="voice-row">
          <input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && parse(text)} placeholder="Type your order..." />
          <button className={'mic' + (listening ? ' live' : '')} onClick={listen}>{listening ? '● Listening' : '🎙️'}</button>
          <button className="primary small" onClick={() => parse(text)}>Go</button>
        </div>
        {result && (
          <div className="voice-result">
            {result.items.map((i) => <div className="row" key={i.productId}><span className="e">{i.emoji}</span><div className="info">{i.name} <small>({i.unit})</small><br /><small>heard: "{i.heard}"</small></div><b>× {i.qty}</b></div>)}
            {result.unmatched.length > 0 && <p className="warn">Couldn't find: {result.unmatched.join(', ')}</p>}
            {result.items.length > 0 ? <button className="primary" onClick={addAll}>Add {result.items.length} item(s) to cart</button> : <p className="empty">Nothing matched. Try "doodh", "chips", "ande"...</p>}
          </div>
        )}
      </div>
    </div>
  )
}
