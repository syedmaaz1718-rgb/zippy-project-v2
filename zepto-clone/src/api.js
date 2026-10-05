// Thin fetch client for the Express API. Token lives in localStorage.
export const getToken = () => localStorage.getItem('zippy_token')
export const setToken = (t) => (t ? localStorage.setItem('zippy_token', t) : localStorage.removeItem('zippy_token'))

export async function api(method, url, body) {
  const res = await fetch('/api' + url, {
    method,
    headers: { 'Content-Type': 'application/json', ...(getToken() ? { Authorization: 'Bearer ' + getToken() } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const err = new Error(data.error || 'Request failed')
    err.status = res.status
    throw err
  }
  return data
}
export const get = (u) => api('GET', u)
export const post = (u, b) => api('POST', u, b || {})
export const put = (u, b) => api('PUT', u, b || {})
export const del = (u) => api('DELETE', u)
