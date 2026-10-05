import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

const pin = (emoji) => L.divIcon({ html: `<div class="pin">${emoji}</div>`, className: '', iconSize: [28, 28], iconAnchor: [14, 14] })

// Mocked rider movement: straight-line interpolation from the dark store to the customer,
// driven by how long the order has been "out for delivery". Map tiles are real OpenStreetMap.
export default function TrackMap({ tracking, status }) {
  const el = useRef(), map = useRef(), rider = useRef(), start = useRef(0)
  const { store, dest, deliverySeconds, statusAgeSeconds } = tracking

  useEffect(() => {
    map.current = L.map(el.current, { zoomControl: true, attributionControl: true }).setView([(store.lat + dest.lat) / 2, (store.lng + dest.lng) / 2], 14)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' }).addTo(map.current)
    L.marker([store.lat, store.lng], { icon: pin('🏪') }).addTo(map.current)
    L.marker([dest.lat, dest.lng], { icon: pin('🏠') }).addTo(map.current)
    L.polyline([[store.lat, store.lng], [dest.lat, dest.lng]], { color: '#0b7a3b', dashArray: '6 8', weight: 3 }).addTo(map.current)
    rider.current = L.marker([store.lat, store.lng], { icon: pin('🛵') }).addTo(map.current)
    map.current.fitBounds([[store.lat, store.lng], [dest.lat, dest.lng]], { padding: [40, 40] })
    return () => map.current.remove()
  }, [])

  useEffect(() => { start.current = Date.now() - statusAgeSeconds * 1000 }, [status, statusAgeSeconds])
  useEffect(() => {
    const t = setInterval(() => {
      let f = 0
      if (status === 'delivered') f = 1
      else if (status === 'out_for_delivery') f = Math.min(1, (Date.now() - start.current) / 1000 / deliverySeconds)
      rider.current?.setLatLng([store.lat + (dest.lat - store.lat) * f, store.lng + (dest.lng - store.lng) * f])
    }, 500)
    return () => clearInterval(t)
  }, [status, deliverySeconds])
  return <div ref={el} className="track-map" />
}
