import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { invalidateHomeCache } from '../lib/distanceService'
import AddressAutocomplete from '../components/AddressAutocomplete'
import { Building2, Plus, Trash2, X, Check, ArrowRight } from 'lucide-react'

const EMPTY_FORM = { label: '', address: '', lat: null, lng: null }

export default function Homes() {
  const { user } = useAuth()
  const [homes, setHomes] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState(null)
  const [error, setError] = useState(null)

  async function load() {
    const { data } = await supabase
      .from('prospective_homes')
      .select('*')
      .order('created_at', { ascending: false })
    setHomes(data || [])
  }

  useEffect(() => { load() }, [])

  function cancel() {
    setShowForm(false)
    setForm(EMPTY_FORM)
    setError(null)
  }

  async function save() {
    if (!form.label.trim()) return setError('Label is required.')
    if (!form.address || form.lat == null) return setError('Please select an address from the dropdown.')
    setSaving(true)
    setError(null)
    const { error } = await supabase.from('prospective_homes').insert({
      user_id: user.id,
      label: form.label.trim(),
      address: form.address,
      lat: form.lat,
      lng: form.lng,
    })
    setSaving(false)
    if (error) return setError(error.message)
    cancel()
    load()
  }

  async function remove(home) {
    if (!confirm(`Delete "${home.label}"?`)) return
    setDeletingId(home.id)
    await invalidateHomeCache(home.id)
    await supabase.from('prospective_homes').delete().eq('id', home.id)
    setDeletingId(null)
    load()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Homes</h1>
          <p className="text-gray-500 text-sm mt-1">Addresses you're considering. Click any to see driving times.</p>
        </div>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-blue-700 transition-colors"
          >
            <Plus size={16} /> Add home
          </button>
        )}
      </div>

      {/* Add form */}
      {showForm && (
        <div className="bg-white border border-gray-200 rounded-2xl p-6 space-y-4">
          <h2 className="font-semibold text-gray-900">Add a home to evaluate</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Label *</label>
              <input
                type="text"
                value={form.label}
                onChange={e => setForm(f => ({ ...f, label: e.target.value }))}
                placeholder="e.g. 123 Oak Street, The Blue House"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Address *</label>
              <AddressAutocomplete
                key="new-home"
                onSelect={({ address, lat, lng }) => setForm(f => ({ ...f, address, lat, lng }))}
                placeholder="Search for an address..."
              />
              {form.address && <p className="text-xs text-gray-400 mt-1">{form.address}</p>}
            </div>
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

      {/* Homes list */}
      {homes.length === 0 && !showForm ? (
        <div className="text-center py-16 text-gray-400">
          <Building2 className="mx-auto mb-3 opacity-30" size={40} />
          <p className="font-medium">No homes yet</p>
          <p className="text-sm mt-1">Add an address to start evaluating it.</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-4">
          {homes.map(home => (
            <div
              key={home.id}
              className="bg-white border border-gray-200 rounded-2xl p-5 flex flex-col gap-3 hover:border-blue-200 hover:shadow-sm transition-all"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <h3 className="font-semibold text-gray-900 truncate">{home.label}</h3>
                  <p className="text-xs text-gray-400 mt-1 truncate">{home.address}</p>
                </div>
                <button
                  onClick={() => remove(home)}
                  disabled={deletingId === home.id}
                  className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-40 shrink-0"
                >
                  <Trash2 size={14} />
                </button>
              </div>
              <Link
                to={`/homes/${home.id}`}
                className="flex items-center gap-2 text-sm font-semibold text-blue-600 hover:text-blue-700"
              >
                View driving times <ArrowRight size={14} />
              </Link>
            </div>
          ))}
        </div>
      )}

      {homes.length > 1 && (
        <div className="text-center">
          <Link
            to="/compare"
            className="inline-flex items-center gap-2 text-sm font-semibold text-blue-600 hover:underline"
          >
            Compare homes side by side <ArrowRight size={14} />
          </Link>
        </div>
      )}
    </div>
  )
}
