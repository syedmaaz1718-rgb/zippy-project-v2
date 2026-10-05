import { useEffect, useState } from 'react'

export const AREAS = [
  { name: 'Koramangala', lat: 12.9352, lng: 77.6245 },
  { name: 'Indiranagar', lat: 12.9784, lng: 77.6408 },
  { name: 'HSR Layout', lat: 12.9116, lng: 77.6474 },
  { name: 'BTM Layout', lat: 12.9166, lng: 77.6101 },
  { name: 'Jayanagar', lat: 12.925, lng: 77.5938 },
  { name: 'JP Nagar', lat: 12.9063, lng: 77.5857 },
  { name: 'Whitefield', lat: 12.9698, lng: 77.7499 },
  { name: 'Marathahalli', lat: 12.9591, lng: 77.6974 },
  { name: 'Electronic City', lat: 12.8452, lng: 77.6602 },
  { name: 'Bellandur', lat: 12.9304, lng: 77.6784 },
  { name: 'MG Road', lat: 12.9756, lng: 77.6068 },
  { name: 'Malleshwaram', lat: 13.0035, lng: 77.5707 },
  { name: 'Hebbal', lat: 13.0358, lng: 77.597 },
  { name: 'Yelahanka', lat: 13.1007, lng: 77.5963 },
]
const KEY = 'zippy_location'
const DEFAULT = { area: 'Koramangala', line: '' }

export function nearestArea(lat, lng) {
  let best = null
  for (const a of AREAS) {
    const d = (a.lat - lat) ** 2 + (a.lng - lng) ** 2
    if (!best || d < best.d) best = { a, d }
  }
  // roughly 0.25 degrees (~28 km) from the nearest known area means we are outside Bengaluru
  return best && best.d < 0.0625 ? best.a.name : null
}

export function getLocation() {
  try { return { ...DEFAULT, ...JSON.parse(localStorage.getItem(KEY) || '{}') } } catch { return DEFAULT }
}
export function saveLocation(loc) {
  localStorage.setItem(KEY, JSON.stringify(loc))
  window.dispatchEvent(new Event('zippy-location'))
}
export function useDeliveryLocation() {
  const [loc, setLoc] = useState(getLocation)
  useEffect(() => {
    const h = () => setLoc(getLocation())
    window.addEventListener('zippy-location', h)
    return () => window.removeEventListener('zippy-location', h)
  }, [])
  return loc
}
