import { useEffect, useRef } from 'react'
import { loadGoogleMaps } from '../lib/googleMaps'

/**
 * Uncontrolled address input with Google Places Autocomplete.
 * Calls onSelect({ address, lat, lng }) when user picks a suggestion.
 */
export default function AddressAutocomplete({ defaultValue = '', onSelect, placeholder, className = '' }) {
  const inputRef = useRef(null)
  const autocompleteRef = useRef(null)

  useEffect(() => {
    let mounted = true
    loadGoogleMaps().then((places) => {
      if (!mounted || !inputRef.current) return
      autocompleteRef.current = new places.Autocomplete(inputRef.current, {
        fields: ['formatted_address', 'geometry'],
      })
      autocompleteRef.current.addListener('place_changed', () => {
        const place = autocompleteRef.current.getPlace()
        if (place?.geometry) {
          onSelect({
            address: place.formatted_address,
            lat: place.geometry.location.lat(),
            lng: place.geometry.location.lng(),
          })
        }
      })
    })
    return () => {
      mounted = false
      if (autocompleteRef.current) {
        window.google?.maps?.event?.clearInstanceListeners(autocompleteRef.current)
      }
    }
  }, [])

  return (
    <input
      ref={inputRef}
      type="text"
      defaultValue={defaultValue}
      placeholder={placeholder || 'Enter an address...'}
      className={`w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${className}`}
    />
  )
}
