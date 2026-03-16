import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { invalidateLocationCache } from '../lib/distanceService'
import AddressAutocomplete from '../components/AddressAutocomplete'
import CategoryBadge from '../components/CategoryBadge'
import { Plus, Pencil, Trash2, X, Check, MapPin } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'

const SUGGESTED_CATEGORIES = ['Work', 'Family', 'Friends', 'Gym', 'Restaurant', 'Shopping', 'Healthcare']

const EMPTY_FORM = { name: '', category: '', address: '', lat: null, lng: null, visits_per_week: 1 }

export default function SavedLocations() {
  const { user } = useAuth()
  const [locations, setLocations] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [editId, setEditId] = useState(null)
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState(null)
  const [error, setError] = useState(null)
  const [branches, setBranches] = useState([])
  const originalBranchIdsRef = useRef([])

  async function load() {
    const { data } = await supabase
      .from('saved_locations')
      .select('*, location_branches(id)')
      .order('category', { ascending: true, nullsFirst: false })
      .order('name')
    setLocations(data || [])
  }

  useEffect(() => { load() }, [])

  function startAdd() {
    setEditId(null)
    setForm(EMPTY_FORM)
    setBranches([])
    originalBranchIdsRef.current = []
    setError(null)
    setShowForm(true)
  }

  async function startEdit(loc) {
    setEditId(loc.id)
    setForm({ name: loc.name, category: loc.category || '', address: loc.address, lat: loc.lat, lng: loc.lng, visits_per_week: loc.visits_per_week ?? 1 })
    setBranches([])
    originalBranchIdsRef.current = []
    setError(null)
    setShowForm(true)
    const { data } = await supabase
      .from('location_branches')
      .select('id, label, address, lat, lng, sort_order')
      .eq('location_id', loc.id)
      .order('sort_order')
    const loaded = data || []
    setBranches(loaded)
    originalBranchIdsRef.current = loaded.map(b => b.id)
  }

  function cancel() {
    setShowForm(false)
    setEditId(null)
    setForm(EMPTY_FORM)
    setBranches([])
    originalBranchIdsRef.current = []
    setError(null)
  }

  function addBranch() {
    setBranches(prev => [...prev, { id: null, label: '', address: '', lat: null, lng: null }])
  }

  function updateBranch(idx, patch) {
    setBranches(prev => prev.map((b, i) => i === idx ? { ...b, ...patch } : b))
  }

  function removeBranch(idx) {
    setBranches(prev => prev.filter((_, i) => i !== idx))
  }

  async function save() {
    if (!form.name.trim()) return setError('Name is required.')
    if (!form.address || form.lat == null) return setError('Please select an address from the dropdown.')
    const vpw = parseFloat(form.visits_per_week)
    if (isNaN(vpw) || vpw <= 0) return setError('Visits per week must be a positive number.')
    const incompleteBranches = branches.filter(b => b.address && b.lat == null)
    if (incompleteBranches.length > 0) return setError('Please select each branch address from the dropdown.')

    setSaving(true)
    setError(null)

    const payload = {
      user_id: user.id,
      name: form.name.trim(),
      category: form.category.trim() || null,
      address: form.address,
      lat: form.lat,
      lng: form.lng,
      visits_per_week: parseFloat(form.visits_per_week) || 1,
    }

    const validBranches = branches.filter(b => b.lat != null)

    if (editId) {
      const { error: err } = await supabase.from('saved_locations').update(payload).eq('id', editId)
      if (err) { setSaving(false); return setError(err.message) }

      await invalidateLocationCache(editId)

      // Delete removed branches
      const deletedIds = originalBranchIdsRef.current.filter(id => !branches.find(b => b.id === id))
      if (deletedIds.length > 0) {
        await supabase.from('location_branches').delete().in('id', deletedIds)
      }

      // Upsert remaining branches
      if (validBranches.length > 0) {
        const branchPayload = validBranches.map((b, i) => ({
          ...(b.id ? { id: b.id } : {}),
          location_id: editId,
          label: b.label.trim() || null,
          address: b.address,
          lat: b.lat,
          lng: b.lng,
          sort_order: i,
        }))
        await supabase.from('location_branches').upsert(branchPayload, { onConflict: 'id' })
      }
    } else {
      const { data, error: err } = await supabase
        .from('saved_locations')
        .insert(payload)
        .select('id')
        .single()
      if (err) { setSaving(false); return setError(err.message) }

      if (validBranches.length > 0) {
        const branchPayload = validBranches.map((b, i) => ({
          location_id: data.id,
          label: b.label.trim() || null,
          address: b.address,
          lat: b.lat,
          lng: b.lng,
          sort_order: i,
        }))
        await supabase.from('location_branches').insert(branchPayload)
      }
    }

    setSaving(false)
    cancel()
    load()
  }

  async function remove(loc) {
    if (!confirm(`Delete "${loc.name}"?`)) return
    setDeletingId(loc.id)
    await invalidateLocationCache(loc.id)
    await supabase.from('saved_locations').delete().eq('id', loc.id)
    setDeletingId(null)
    load()
  }

  // Group by category
  const grouped = {}
  locations.forEach(loc => {
    const key = loc.category || 'Uncategorized'
    if (!grouped[key]) grouped[key] = []
    grouped[key].push(loc)
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Places</h1>
          <p className="text-gray-500 text-sm mt-1">Locations you visit regularly — work, family, friends, gym, etc.</p>
        </div>
        {!showForm && (
          <button
            onClick={startAdd}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-blue-700 transition-colors"
          >
            <Plus size={16} /> Add place
          </button>
        )}
      </div>

      {/* Form */}
      {showForm && (
        <div className="bg-white border border-gray-200 rounded-2xl p-6 space-y-4">
          <h2 className="font-semibold text-gray-900">{editId ? 'Edit place' : 'Add a new place'}</h2>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Name *</label>
              <input
                type="text"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Mom's house, Planet Fitness"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Category</label>
              <input
                type="text"
                value={form.category}
                onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                placeholder="e.g. Family, Friends, Gym…"
                list="category-suggestions"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <datalist id="category-suggestions">
                {SUGGESTED_CATEGORIES.map(c => <option key={c} value={c} />)}
              </datalist>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {SUGGESTED_CATEGORIES.map(c => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setForm(f => ({ ...f, category: c }))}
                    className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${
                      form.category === c
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white text-gray-500 border-gray-300 hover:border-gray-400'
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="sm:max-w-xs">
            <label className="block text-xs font-medium text-gray-600 mb-1">Visits per week</label>
            <input
              type="number"
              min="0.1"
              step="0.5"
              value={form.visits_per_week}
              onChange={e => setForm(f => ({ ...f, visits_per_week: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-gray-400 mt-1">Used for frequency-weighted scoring on Compare.</p>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Primary address *</label>
            <AddressAutocomplete
              key={editId || 'new'}
              defaultValue={form.address}
              onSelect={({ address, lat, lng }) => setForm(f => ({ ...f, address, lat, lng }))}
              placeholder="Search for an address..."
            />
            {form.address && <p className="text-xs text-gray-400 mt-1">{form.address}</p>}
          </div>

          {/* Additional branches */}
          <div className="space-y-3">
            <div>
              <p className="text-xs font-medium text-gray-600">Other branches / locations</p>
              <p className="text-xs text-gray-400 mt-0.5">The primary address above is always included. Add other branches — the closest one will be used automatically.</p>
            </div>
            {branches.map((branch, idx) => (
              <div key={branch.id || `new-${idx}`} className="flex gap-2 items-start">
                <div className="flex-1 space-y-1.5">
                  <input
                    type="text"
                    value={branch.label}
                    onChange={e => updateBranch(idx, { label: e.target.value })}
                    placeholder="Branch label (optional, e.g. Northside)"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <AddressAutocomplete
                    key={branch.id || `new-${idx}`}
                    defaultValue={branch.address}
                    onSelect={({ address, lat, lng }) => updateBranch(idx, { address, lat, lng })}
                    placeholder="Search for an address..."
                  />
                  {branch.address && <p className="text-xs text-gray-400">{branch.address}</p>}
                </div>
                <button
                  type="button"
                  onClick={() => removeBranch(idx)}
                  className="mt-2 p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                >
                  <X size={14} />
                </button>
              </div>
            ))}
            {branches.length < 10 && (
              <button
                type="button"
                onClick={addBranch}
                className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-700 font-medium"
              >
                <Plus size={13} /> Add another branch
              </button>
            )}
          </div>

          {error && <p className="text-red-500 text-sm">{error}</p>}

          <div className="flex gap-3">
            <button
              onClick={save}
              disabled={saving}
              className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              <Check size={15} /> {saving ? 'Saving...' : 'Save'}
            </button>
            <button onClick={cancel} className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800 px-4 py-2">
              <X size={15} /> Cancel
            </button>
          </div>
        </div>
      )}

      {/* Location list */}
      {locations.length === 0 && !showForm ? (
        <div className="text-center py-16 text-gray-400">
          <MapPin className="mx-auto mb-3 opacity-30" size={40} />
          <p className="font-medium">No places yet</p>
          <p className="text-sm mt-1">Add the places you visit regularly to get started.</p>
        </div>
      ) : (
        Object.entries(grouped).map(([category, locs]) => (
          <div key={category}>
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">{category}</h3>
            <div className="space-y-2">
              {locs.map(loc => (
                <div
                  key={loc.id}
                  className="flex items-center justify-between bg-white border border-gray-200 rounded-xl px-4 py-3"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-gray-900 text-sm">{loc.name}</span>
                      <CategoryBadge category={loc.category} />
                      {loc.location_branches?.length > 0 && (
                        <span className="text-xs text-gray-400">
                          +{loc.location_branches.length} branch{loc.location_branches.length !== 1 ? 'es' : ''}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5 truncate">{loc.address}</p>
                  </div>
                  <div className="flex items-center gap-1 ml-3 shrink-0">
                    <button
                      onClick={() => startEdit(loc)}
                      className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={() => remove(loc)}
                      disabled={deletingId === loc.id}
                      className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-40"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  )
}
