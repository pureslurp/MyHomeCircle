import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { getDrivingTimes } from '../lib/distanceService'
import CategoryBadge from '../components/CategoryBadge'
import { BarChart3, Clock, ArrowRight, Check, ChevronDown, ChevronUp } from 'lucide-react'

export default function Compare() {
  const [homes, setHomes] = useState([])
  const [selected, setSelected] = useState([])
  const [savedLocations, setSavedLocations] = useState([])
  const [activeLocations, setActiveLocations] = useState(new Set())
  const [results, setResults] = useState({}) // homeId -> { locationId -> minutes }
  const [loading, setLoading] = useState(false)
  const [initialized, setInitialized] = useState(false)
  const [filterOpen, setFilterOpen] = useState(false)
  const [scoringMode, setScoringMode] = useState('A') // 'A' = frequency-weighted, 'B' = category-importance
  const [categoryWeights, setCategoryWeights] = useState({}) // category -> 1..5

  useEffect(() => {
    async function load() {
      const [{ data: homesData }, { data: locsData }] = await Promise.all([
        supabase.from('prospective_homes').select('*').order('created_at', { ascending: false }),
        supabase.from('saved_locations').select('*').order('category').order('name'),
      ])
      setHomes(homesData || [])
      setSavedLocations(locsData || [])
      setActiveLocations(new Set((locsData || []).map(l => l.id)))
      const cats = [...new Set((locsData || []).map(l => l.category || 'Uncategorized'))]
      setCategoryWeights(prev => {
        const next = { ...prev }
        cats.forEach(c => { if (next[c] == null) next[c] = 3 })
        return next
      })
    }
    load()
  }, [])

  function toggleHome(homeId) {
    setSelected(sel =>
      sel.includes(homeId) ? sel.filter(id => id !== homeId) : [...sel, homeId]
    )
  }

  function toggleLocation(locId) {
    setActiveLocations(prev => {
      const next = new Set(prev)
      next.has(locId) ? next.delete(locId) : next.add(locId)
      return next
    })
  }

  function toggleCategory(category) {
    const catLocs = savedLocations.filter(l => (l.category || 'Uncategorized') === category)
    const allActive = catLocs.every(l => activeLocations.has(l.id))
    setActiveLocations(prev => {
      const next = new Set(prev)
      catLocs.forEach(l => allActive ? next.delete(l.id) : next.add(l.id))
      return next
    })
  }

  function selectAllLocations() {
    setActiveLocations(new Set(savedLocations.map(l => l.id)))
  }

  function clearAllLocations() {
    setActiveLocations(new Set())
  }

  async function compare() {
    if (selected.length < 2) return
    setLoading(true)
    const newResults = {}

    await Promise.all(
      selected.map(async homeId => {
        const home = homes.find(h => h.id === homeId)
        if (!home) return

        const times = await getDrivingTimes(homeId, home.lat, home.lng, savedLocations)
        const locationTimes = {}
        times.forEach(t => { if (t) locationTimes[t.saved_location_id] = t.driving_minutes })
        newResults[homeId] = locationTimes
      })
    )

    setResults(newResults)
    setInitialized(true)
    setLoading(false)
  }

  // All categories present across saved locations
  const allCategories = [...new Set(savedLocations.map(l => l.category || 'Uncategorized'))]

  // Selected home objects (maintain compare order)
  const selectedHomes = selected.map(id => homes.find(h => h.id === id)).filter(Boolean)

  // Category average for a home, respecting activeLocations and scoringMode
  function getCategoryAvg(homeId, category) {
    const locs = savedLocations.filter(
      l => (l.category || 'Uncategorized') === category && activeLocations.has(l.id)
    )
    const pairs = locs
      .map(l => ({ val: results[homeId]?.[l.id], weight: l.visits_per_week ?? 1 }))
      .filter(p => p.val != null)
    if (!pairs.length) return null
    if (scoringMode === 'A') {
      const sumW = pairs.reduce((s, p) => s + p.weight, 0)
      return Math.round(pairs.reduce((s, p) => s + p.val * p.weight, 0) / sumW)
    }
    return Math.round(pairs.reduce((s, p) => s + p.val, 0) / pairs.length)
  }

  // Overall score for a home across all active locations
  function getOverallScore(homeId) {
    if (scoringMode === 'A') {
      // Flat frequency-weighted average across all active locations
      const locs = savedLocations.filter(l => activeLocations.has(l.id))
      const pairs = locs
        .map(l => ({ val: results[homeId]?.[l.id], weight: l.visits_per_week ?? 1 }))
        .filter(p => p.val != null)
      if (!pairs.length) return null
      const sumW = pairs.reduce((s, p) => s + p.weight, 0)
      return Math.round(pairs.reduce((s, p) => s + p.val * p.weight, 0) / sumW)
    }
    // Mode B: weighted average of category averages using slider weights
    const catPairs = allCategories
      .map(c => ({ avg: getCategoryAvg(homeId, c), weight: categoryWeights[c] ?? 3 }))
      .filter(p => p.avg != null)
    if (!catPairs.length) return null
    const sumW = catPairs.reduce((s, p) => s + p.weight, 0)
    return Math.round(catPairs.reduce((s, p) => s + p.avg * p.weight, 0) / sumW)
  }

  // Best (lowest) time per category across selected homes
  function getBest(category) {
    let best = null
    selectedHomes.forEach(h => {
      const v = getCategoryAvg(h.id, category)
      if (v != null && (best == null || v < best)) best = v
    })
    return best
  }

  const bestOverall = initialized ? selectedHomes.reduce((best, h) => {
    const score = getOverallScore(h.id)
    return (score != null && (best == null || score < best)) ? score : best
  }, null) : null

  if (homes.length === 0) {
    return (
      <div className="text-center py-20 text-gray-400">
        <BarChart3 className="mx-auto mb-3 opacity-30" size={40} />
        <p className="font-medium">No homes to compare</p>
        <Link to="/homes" className="text-sm text-blue-600 hover:underline mt-2 inline-block">
          Add some homes first <ArrowRight size={12} className="inline" />
        </Link>
      </div>
    )
  }

  // Group saved locations by category for the filter panel
  const locationsByCategory = {}
  savedLocations.forEach(loc => {
    const key = loc.category || 'Uncategorized'
    if (!locationsByCategory[key]) locationsByCategory[key] = []
    locationsByCategory[key].push(loc)
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Compare Homes</h1>
        <p className="text-gray-500 text-sm mt-1">Select two or more homes to compare driving times side by side.</p>
      </div>

      {/* Home selector */}
      <div className="bg-white border border-gray-200 rounded-2xl p-5">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Select homes to compare</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {homes.map(home => {
            const isSelected = selected.includes(home.id)
            return (
              <button
                key={home.id}
                onClick={() => toggleHome(home.id)}
                className={`flex items-start gap-3 text-left p-3 rounded-xl border-2 transition-all ${
                  isSelected
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className={`mt-0.5 w-4 h-4 rounded flex items-center justify-center shrink-0 border-2 transition-colors ${
                  isSelected ? 'bg-blue-500 border-blue-500' : 'border-gray-300'
                }`}>
                  {isSelected && <Check size={10} className="text-white" />}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{home.label}</p>
                  <p className="text-xs text-gray-400 truncate mt-0.5">{home.address}</p>
                </div>
              </button>
            )
          })}
        </div>

        <button
          onClick={compare}
          disabled={selected.length < 2 || loading}
          className="mt-4 flex items-center gap-2 bg-blue-600 text-white px-5 py-2 rounded-xl text-sm font-semibold hover:bg-blue-700 disabled:opacity-40 transition-colors"
        >
          <BarChart3 size={15} />
          {loading ? 'Calculating…' : `Compare ${selected.length > 0 ? selected.length : ''} homes`}
        </button>
        {selected.length === 1 && <p className="text-xs text-gray-400 mt-2">Select at least one more home to compare.</p>}
      </div>

      {/* Scoring mode toggle */}
      {initialized && (
        <div className="bg-white border border-gray-200 rounded-2xl p-4 flex items-center gap-4 flex-wrap">
          <span className="text-sm font-semibold text-gray-700">Scoring mode</span>
          <div className="flex rounded-xl border border-gray-200 overflow-hidden text-sm">
            <button
              onClick={() => setScoringMode('A')}
              className={`px-4 py-1.5 font-medium transition-colors ${
                scoringMode === 'A' ? 'bg-blue-600 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'
              }`}
            >
              Frequency-weighted
            </button>
            <button
              onClick={() => setScoringMode('B')}
              className={`px-4 py-1.5 font-medium transition-colors border-l border-gray-200 ${
                scoringMode === 'B' ? 'bg-blue-600 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'
              }`}
            >
              Category importance
            </button>
          </div>
          <p className="text-xs text-gray-400">
            {scoringMode === 'A'
              ? 'Weights locations by visits/week.'
              : 'Adjust sliders to set category importance.'}
          </p>
        </div>
      )}

      {/* Category importance sliders (Mode B only) */}
      {initialized && scoringMode === 'B' && (
        <div className="bg-white border border-gray-200 rounded-2xl p-5 space-y-3">
          <h2 className="text-sm font-semibold text-gray-700">Category importance</h2>
          <p className="text-xs text-gray-400">Drag sliders to set how much each category matters to you.</p>
          <div className="space-y-2">
            {allCategories.map(category => (
              <div key={category} className="flex items-center gap-3">
                <div className="w-28 shrink-0">
                  <CategoryBadge category={category === 'Uncategorized' ? null : category} />
                </div>
                <input
                  type="range"
                  min={1}
                  max={5}
                  step={1}
                  value={categoryWeights[category] ?? 3}
                  onChange={e => setCategoryWeights(prev => ({ ...prev, [category]: Number(e.target.value) }))}
                  className="flex-1 accent-blue-600"
                />
                <span className="text-sm font-semibold text-gray-700 w-4 text-right">
                  {categoryWeights[category] ?? 3}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filter places panel */}
      {initialized && savedLocations.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
          <button
            onClick={() => setFilterOpen(o => !o)}
            className="w-full flex items-center justify-between px-5 py-3 hover:bg-gray-50 transition-colors text-left"
          >
            <div className="flex items-center gap-3">
              <span className="text-sm font-semibold text-gray-700">Filter places</span>
              <span className="text-xs text-gray-400">{activeLocations.size} of {savedLocations.length} active</span>
            </div>
            <div className="flex items-center gap-3">
              <span
                role="button"
                tabIndex={0}
                onClick={e => { e.stopPropagation(); selectAllLocations() }}
                onKeyDown={e => e.key === 'Enter' && (e.stopPropagation(), selectAllLocations())}
                className="text-xs text-blue-600 hover:underline font-medium"
              >
                All
              </span>
              <span
                role="button"
                tabIndex={0}
                onClick={e => { e.stopPropagation(); clearAllLocations() }}
                onKeyDown={e => e.key === 'Enter' && (e.stopPropagation(), clearAllLocations())}
                className="text-xs text-gray-500 hover:underline"
              >
                None
              </span>
              {filterOpen ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
            </div>
          </button>

          {filterOpen && (
            <div className="border-t border-gray-100 px-5 py-3 space-y-4">
              {Object.entries(locationsByCategory).map(([category, locs]) => {
                const allActive = locs.every(l => activeLocations.has(l.id))
                const someActive = locs.some(l => activeLocations.has(l.id))
                return (
                  <div key={category}>
                    {/* Category toggle */}
                    <button
                      onClick={() => toggleCategory(category)}
                      className="flex items-center gap-2 mb-2 group"
                    >
                      <div className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
                        allActive ? 'bg-blue-500 border-blue-500' : someActive ? 'bg-blue-200 border-blue-300' : 'border-gray-300'
                      }`}>
                        {allActive && <Check size={10} className="text-white" />}
                        {!allActive && someActive && <div className="w-1.5 h-1.5 rounded-sm bg-blue-500" />}
                      </div>
                      <CategoryBadge category={category === 'Uncategorized' ? null : category} />
                    </button>

                    {/* Individual locations */}
                    <div className="ml-6 space-y-1.5">
                      {locs.map(loc => {
                        const isActive = activeLocations.has(loc.id)
                        return (
                          <button
                            key={loc.id}
                            onClick={() => toggleLocation(loc.id)}
                            className="flex items-center gap-2 w-full text-left group"
                          >
                            <div className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
                              isActive ? 'bg-blue-500 border-blue-500' : 'border-gray-300'
                            }`}>
                              {isActive && <Check size={10} className="text-white" />}
                            </div>
                            <span className={`text-sm truncate ${isActive ? 'text-gray-700' : 'text-gray-400 line-through'}`}>
                              {loc.name}
                              {scoringMode === 'A' && (loc.visits_per_week ?? 1) !== 1 && (
                                <span className="ml-1 text-gray-400 text-xs">({loc.visits_per_week}×/wk)</span>
                              )}
                            </span>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Comparison table */}
      {initialized && selectedHomes.length >= 2 && (
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="text-left px-5 py-3 font-semibold text-gray-600 w-40">Category</th>
                  {selectedHomes.map(home => (
                    <th key={home.id} className="text-left px-5 py-3 font-semibold text-gray-900 min-w-[150px]">
                      <Link to={`/homes/${home.id}`} className="hover:text-blue-600 hover:underline truncate block max-w-[160px]">
                        {home.label}
                      </Link>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {allCategories.map((category, i) => {
                  const best = getBest(category)
                  return (
                    <tr key={category} className={`border-b border-gray-100 ${i % 2 === 1 ? 'bg-gray-50/50' : ''}`}>
                      <td className="px-5 py-3">
                        <CategoryBadge category={category === 'Uncategorized' ? null : category} />
                      </td>
                      {selectedHomes.map(home => {
                        const val = getCategoryAvg(home.id, category)
                        const isBest = val != null && val === best
                        return (
                          <td key={home.id} className="px-5 py-3">
                            {val != null ? (
                              <div className={`flex items-center gap-1.5 ${isBest ? 'text-emerald-600' : 'text-gray-700'}`}>
                                <Clock size={13} />
                                <span className="font-semibold">{val} min</span>
                                {isBest && selectedHomes.length > 1 && (
                                  <span className="text-xs bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full font-medium">best</span>
                                )}
                              </div>
                            ) : (
                              <span className="text-gray-300">—</span>
                            )}
                          </td>
                        )
                      })}
                    </tr>
                  )
                })}

                {/* Overall score row */}
                <tr className="bg-blue-50 font-semibold">
                  <td className="px-5 py-3 text-blue-700 text-sm">
                    {scoringMode === 'A' ? 'Weighted avg' : 'Importance-weighted avg'}
                  </td>
                  {selectedHomes.map(home => {
                    const overall = getOverallScore(home.id)
                    return (
                      <td key={home.id} className="px-5 py-3">
                        {overall != null ? (
                          <div className={`flex items-center gap-1.5 ${overall === bestOverall ? 'text-emerald-600' : 'text-blue-700'}`}>
                            <Clock size={13} />
                            <span>{overall} min</span>
                            {overall === bestOverall && selectedHomes.length > 1 && (
                              <span className="text-xs bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full">best</span>
                            )}
                          </div>
                        ) : <span className="text-gray-300">—</span>}
                      </td>
                    )
                  })}
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
