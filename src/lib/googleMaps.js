import { setOptions, importLibrary } from '@googlemaps/js-api-loader'

let initialized = false
let placesPromise = null

export function loadGoogleMaps() {
  if (!placesPromise) {
    if (!initialized) {
      setOptions({
        key: import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
        v: 'weekly',
      })
      initialized = true
    }
    placesPromise = importLibrary('places')
  }
  return placesPromise
}
