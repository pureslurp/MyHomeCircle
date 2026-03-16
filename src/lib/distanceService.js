import { supabase } from './supabase'
import { loadGoogleMaps } from './googleMaps'

const BATCH_SIZE = 25

async function callDistanceMatrix(service, origin, destinations) {
  return new Promise((resolve, reject) => {
    service.getDistanceMatrix(
      {
        origins: [origin],
        destinations: destinations.map(d => ({ lat: d.lat, lng: d.lng })),
        travelMode: window.google.maps.TravelMode.DRIVING,
        unitSystem: window.google.maps.UnitSystem.IMPERIAL,
      },
      (result, status) => {
        if (status === 'OK') resolve(result)
        else reject(new Error(`Distance Matrix failed: ${status}`))
      }
    )
  })
}

/**
 * Get driving times from one home to many saved locations.
 * First checks Supabase cache. Only calls Google API for uncached pairs.
 * For locations with branches, calculates distance to all branches and uses the minimum.
 * Returns array of { saved_location_id, driving_minutes, driving_meters }
 */
export async function getDrivingTimes(homeId, homeLat, homeLng, savedLocations) {
  if (!savedLocations.length) return []

  // 1. Load cached results from Supabase
  const { data: cached } = await supabase
    .from('distance_cache')
    .select('saved_location_id, driving_minutes, driving_meters')
    .eq('home_id', homeId)
    .in('saved_location_id', savedLocations.map(l => l.id))

  const cachedMap = {}
  ;(cached || []).forEach(c => { cachedMap[c.saved_location_id] = c })

  const uncached = savedLocations.filter(l => !cachedMap[l.id])

  // 2. Fetch uncached from Google Distance Matrix
  if (uncached.length > 0) {
    // Fetch any extra branches for uncached locations
    const { data: branchRows } = await supabase
      .from('location_branches')
      .select('location_id, lat, lng')
      .in('location_id', uncached.map(l => l.id))

    // Build flat destinations list: primary address + all branches, each tagged with saved_location_id
    const destinations = []
    for (const loc of uncached) {
      destinations.push({ saved_location_id: loc.id, lat: loc.lat, lng: loc.lng })
      const extras = (branchRows || []).filter(b => b.location_id === loc.id)
      for (const branch of extras) {
        destinations.push({ saved_location_id: loc.id, lat: branch.lat, lng: branch.lng })
      }
    }

    await loadGoogleMaps()
    const service = new window.google.maps.DistanceMatrixService()
    const origin = { lat: homeLat, lng: homeLng }

    // Process in batches of 25 (Distance Matrix API limit)
    const perLocation = {}
    for (let i = 0; i < destinations.length; i += BATCH_SIZE) {
      const batch = destinations.slice(i, i + BATCH_SIZE)
      const result = await callDistanceMatrix(service, origin, batch)
      const elements = result.rows[0]?.elements || []
      elements.forEach((el, idx) => {
        if (el.status !== 'OK') return
        const { saved_location_id } = batch[idx]
        const minutes = Math.round(el.duration.value / 60)
        const meters = el.distance.value
        // Keep the minimum drive time across all branches
        const existing = perLocation[saved_location_id]
        if (!existing || minutes < existing.driving_minutes) {
          perLocation[saved_location_id] = { driving_minutes: minutes, driving_meters: meters }
        }
      })
    }

    // Upsert minimums into cache
    const toInsert = []
    for (const [locId, result] of Object.entries(perLocation)) {
      cachedMap[locId] = { saved_location_id: locId, ...result }
      toInsert.push({ home_id: homeId, saved_location_id: locId, ...result })
    }
    if (toInsert.length > 0) {
      await supabase.from('distance_cache').upsert(toInsert, { onConflict: 'home_id,saved_location_id' })
    }
  }

  return savedLocations.map(l => ({ ...cachedMap[l.id], saved_location_id: l.id }))
}

/**
 * Invalidate cache for a specific home (call when home coords change)
 */
export async function invalidateHomeCache(homeId) {
  await supabase.from('distance_cache').delete().eq('home_id', homeId)
}

/**
 * Invalidate cache entries for a saved location (call when location or its branches change)
 */
export async function invalidateLocationCache(savedLocationId) {
  await supabase.from('distance_cache').delete().eq('saved_location_id', savedLocationId)
}
