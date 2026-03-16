import { useEffect, useState, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { getDrivingTimes, invalidateHomeCache } from '../lib/distanceService'
import LocationMap from '../components/LocationMap'
import CategoryBadge from '../components/CategoryBadge'
import { ArrowLeft, RefreshCw, Clock, MapPin } from 'lucide-react'

export default function HomeDetail() {
  const { id } = useParams()
  const [home, setHome] = useState(null)
  const [savedLocations, setSavedLocations] = useState([])
  const [drivingTimes, setDrivingTimes] = useState([])
  const [loading, setLoading] = useState(true)
  const [calculating, setCalculating] = useState(false)
  const [error, setError] = useState(null)

  const load = useCallback(async (forceRefresh = false) => {
    setError(null)
    if (forceRefresh) setCalculating(true)
    else setLoading(true)

    try {
      const [{ data: homeData }, { data: locsData }] = await Promise.all([
        supabase.from('prospective_homes').select('*').eq('id', id).single(),
        supabase.from('saved_locations').select('*').order('category').order('name'),
      ])

      if (!homeData) { setError('Home not found.'); return }

      setHome(homeData)
      setSavedLocations(locsData || [])

      if (forceRefresh) await invalidateHomeCache(id)

      const times = await getDrivingTimes(id, homeData.lat, homeData.lng, locsData || [])
      setDrivingTimes(times)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
      setCalculating(false)
    }
  }, [id])

  useEffect(() => { load() }, [load])

  if (loading) return <div className="flex items-center justify-center py-24 text-gray-400 text-sm">Calculating driving times…</div>
  if (error) return <div className="text-red-500 text-sm py-8">{error}</div>
  if (!home) return null

  // Build time lookup
  const timeMap = {}
  drivingTimes.forEach(d => { if (d) timeMap[d.saved_location_id] = d })

  // Group locations by category
  const grouped = {}
  savedLocations.forEach(loc => {
    const key = loc.category || 'Uncategorized'
    if (!grouped[key]) grouped[key] = []
    grouped[key].push({ ...loc, ...timeMap[loc.id] })
  })

  // Compute category averages
  const categoryAverages = Object.entries(grouped).map(([category, locs]) => {
    const withTimes = locs.filter(l => l.driving_minutes != null)
    const avg = withTimes.length
      ? Math.round(withTimes.reduce((s, l) => s + l.driving_minutes, 0) / withTimes.length)
      : null
    return { category, locs, avg, count: withTimes.length }
  })

  // Sort: categories with data first, then by avg time
  categoryAverages.sort((a, b) => {
    if (a.avg == null && b.avg == null) return 0
    if (a.avg == null) return 1
    if (b.avg == null) return -1
    return a.avg - b.avg
  })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <Link to="/homes" className="mt-1 text-gray-400 hover:text-gray-700">
            <ArrowLeft size={18} />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{home.label}</h1>
            <p className="text-sm text-gray-400 mt-0.5">{home.address}</p>
          </div>
        </div>
        <button
          onClick={() => load(true)}
          disabled={calculating}
          className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800 border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-gray-50 disabled:opacity-40 transition-colors shrink-0"
        >
          <RefreshCw size={14} className={calculating ? 'animate-spin' : ''} />
          {calculating ? 'Recalculating…' : 'Recalculate'}
        </button>
      </div>

      {savedLocations.length === 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-700">
          No saved places yet. <Link to="/saved-locations" className="font-semibold underline">Add your places</Link> to see driving times.
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Results */}
        <div className="space-y-4">
          {categoryAverages.map(({ category, locs, avg, count }) => (
            <CategoryCard key={category} category={category} locs={locs} avg={avg} count={count} />
          ))}
        </div>

        {/* Map */}
        <div className="lg:sticky lg:top-20 h-[480px] rounded-2xl overflow-hidden border border-gray-200 shadow-sm">
          <LocationMap home={home} savedLocations={savedLocations} drivingTimes={drivingTimes} />
        </div>
      </div>
    </div>
  )
}

function CategoryCard({ category, locs, avg, count }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
      {/* Category header / summary */}
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors text-left"
      >
        <div className="flex items-center gap-3">
          <CategoryBadge category={category === 'Uncategorized' ? null : category} />
          <span className="text-xs text-gray-400">{locs.length} place{locs.length !== 1 ? 's' : ''}</span>
        </div>
        <div className="flex items-center gap-3">
          {avg != null ? (
            <div className="flex items-center gap-1.5">
              <Clock size={14} className="text-blue-500" />
              <span className="font-bold text-gray-900">{avg} min</span>
              <span className="text-xs text-gray-400">avg</span>
            </div>
          ) : (
            <span className="text-xs text-gray-400">No data</span>
          )}
          <span className="text-gray-300 text-xs">{expanded ? '▲' : '▼'}</span>
        </div>
      </button>

      {/* Expanded breakdown */}
      {expanded && (
        <div className="border-t border-gray-100 divide-y divide-gray-100">
          {locs.map(loc => (
            <div key={loc.id} className="flex items-center justify-between px-5 py-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-gray-800 truncate">{loc.name}</p>
                <p className="text-xs text-gray-400 truncate mt-0.5">{loc.address}</p>
              </div>
              <div className="ml-4 shrink-0">
                {loc.driving_minutes != null ? (
                  <span className="text-sm font-semibold text-blue-600">{loc.driving_minutes} min</span>
                ) : (
                  <span className="text-xs text-gray-300">—</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
