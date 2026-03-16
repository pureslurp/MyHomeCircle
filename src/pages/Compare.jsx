import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { getDrivingTimes } from '../lib/distanceService'
import CategoryBadge from '../components/CategoryBadge'
import { BarChart3, Clock, ArrowRight, Check } from 'lucide-react'

export default function Compare() {
  const [homes, setHomes] = useState([])
  const [selected, setSelected] = useState([])
  const [savedLocations, setSavedLocations] = useState([])
  const [results, setResults] = useState({}) // homeId -> { category -> avg minutes }
  const [loading, setLoading] = useState(false)
  const [initialized, setInitialized] = useState(false)

  useEffect(() => {
    async function load() {
      const [{ data: homesData }, { data: locsData }] = await Promise.all([
        supabase.from('prospective_homes').select('*').order('created_at', { ascending: false }),
        supabase.from('saved_locations').select('*').order('category').order('name'),
      ])
      setHomes(homesData || [])
      setSavedLocations(locsData || [])
    }
    load()
  }, [])

  function toggleHome(homeId) {
    setSelected(sel =>
      sel.includes(homeId) ? sel.filter(id => id !== homeId) : [...sel, homeId]
    )
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
        const timeMap = {}
        times.forEach(t => { if (t) timeMap[t.saved_location_id] = t.driving_minutes })

        // Compute per-category averages
        const categoryMap = {}
        savedLocations.forEach(loc => {
          const key = loc.category || 'Uncategorized'
          if (!categoryMap[key]) categoryMap[key] = []
          if (timeMap[loc.id] != null) categoryMap[key].push(timeMap[loc.id])
        })

        const categoryAvgs = {}
        Object.entries(categoryMap).forEach(([cat, mins]) => {
          categoryAvgs[cat] = mins.length
            ? Math.round(mins.reduce((a, b) => a + b, 0) / mins.length)
            : null
        })

        newResults[homeId] = categoryAvgs
      })
    )

    setResults(newResults)
    setInitialized(true)
    setLoading(false)
  }

  // All categories present across saved locations
  const allCategories = [...new Set(savedLocations.map(l => l.category || 'Uncategorized'))]

  // Selected home objects
  const selectedHomes = homes.filter(h => selected.includes(h.id))

  // Best (lowest) time per category
  function getBest(category) {
    let best = null
    selectedHomes.forEach(h => {
      const v = results[h.id]?.[category]
      if (v != null && (best == null || v < best)) best = v
    })
    return best
  }

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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Compare Homes</h1>
        <p className="text-gray-500 text-sm mt-1">Select two or more homes to compare average driving times side by side.</p>
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
                        const val = results[home.id]?.[category]
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

                {/* Overall average row */}
                <tr className="bg-blue-50 font-semibold">
                  <td className="px-5 py-3 text-blue-700 text-sm">Overall avg</td>
                  {selectedHomes.map(home => {
                    const vals = allCategories
                      .map(c => results[home.id]?.[c])
                      .filter(v => v != null)
                    const overall = vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : null
                    const bestOverall = selectedHomes.reduce((best, h) => {
                      const hVals = allCategories.map(c => results[h.id]?.[c]).filter(v => v != null)
                      const hAvg = hVals.length ? Math.round(hVals.reduce((a, b) => a + b, 0) / hVals.length) : null
                      return (hAvg != null && (best == null || hAvg < best)) ? hAvg : best
                    }, null)
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
