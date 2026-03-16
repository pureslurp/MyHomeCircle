import { useMemo } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { getCategoryColor } from './CategoryBadge'

// Fix leaflet marker icons broken by bundlers
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
})

function dotIcon(color, size = 14) {
  return L.divIcon({
    html: `<div style="width:${size}px;height:${size}px;background:${color};border-radius:50%;border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.35)"></div>`,
    className: '',
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  })
}

const homeIcon = L.divIcon({
  html: `<div style="width:18px;height:18px;background:#1d4ed8;border-radius:4px;border:2.5px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.4);transform:rotate(45deg)"></div>`,
  className: '',
  iconSize: [18, 18],
  iconAnchor: [9, 9],
})

// Fit map bounds to show all markers
function FitBounds({ positions }) {
  const map = useMap()
  useMemo(() => {
    if (positions.length > 0) {
      map.fitBounds(L.latLngBounds(positions), { padding: [40, 40], maxZoom: 14 })
    }
  }, [positions.map(p => p.join()).join()])
  return null
}

/**
 * home: { label, lat, lng }
 * savedLocations: [{ id, name, category, lat, lng }]
 * drivingTimes: [{ saved_location_id, driving_minutes }]  (optional)
 */
export default function LocationMap({ home, savedLocations = [], drivingTimes = [] }) {
  const timeMap = {}
  drivingTimes.forEach(d => { timeMap[d.saved_location_id] = d.driving_minutes })

  const allPositions = [
    [home.lat, home.lng],
    ...savedLocations.map(l => [l.lat, l.lng]),
  ]

  return (
    <MapContainer
      center={[home.lat, home.lng]}
      zoom={12}
      style={{ height: '100%', width: '100%', borderRadius: '0.75rem' }}
      scrollWheelZoom={false}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <FitBounds positions={allPositions} />

      {/* Home marker */}
      <Marker position={[home.lat, home.lng]} icon={homeIcon}>
        <Popup>
          <strong>{home.label}</strong>
          <br />
          <span className="text-xs text-gray-500">{home.address}</span>
        </Popup>
      </Marker>

      {/* Saved location markers */}
      {savedLocations.map(loc => (
        <Marker
          key={loc.id}
          position={[loc.lat, loc.lng]}
          icon={dotIcon(getCategoryColor(loc.category))}
        >
          <Popup>
            <strong>{loc.name}</strong>
            {loc.category && <><br /><span className="text-xs text-gray-500">{loc.category}</span></>}
            {timeMap[loc.id] != null && (
              <><br /><span className="text-xs font-medium text-blue-600">{timeMap[loc.id]} min drive</span></>
            )}
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  )
}
