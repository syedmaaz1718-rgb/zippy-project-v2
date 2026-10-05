import { createContext, useCallback, useContext, useState } from 'react'
const Ctx = createContext(() => {})
export function ToastProvider({ children }) {
  const [msg, setMsg] = useState(null)
  const toast = useCallback((text, kind = 'info') => {
    setMsg({ text, kind })
    setTimeout(() => setMsg(null), 2600)
  }, [])
  return (
    <Ctx.Provider value={toast}>
      {children}
      {msg && <div className={'toast ' + msg.kind}>{msg.text}</div>}
    </Ctx.Provider>
  )
}
export const useToast = () => useContext(Ctx)
