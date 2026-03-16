import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { MapPin, Building2, BarChart3, Plus } from 'lucide-react'

export default function Dashboard() {
  const { user } = useAuth()
  const [counts, setCounts] = useState({ locations: 0, homes: 0 })
  const [recentHomes, setRecentHomes] = useState([])

  useEffect(() => {
    async function load() {
      const [{ count: lCount }, { count: hCount }, { data: homes }] = await Promise.all([
        supabase.from('saved_locations').select('*', { count: 'exact', head: true }),
        supabase.from('prospective_homes').select('*', { count: 'exact', head: true }),
        supabase.from('prospective_homes').select('id, label, address').order('created_at', { ascending: false }).limit(4),
      ])
      setCounts({ locations: lCount || 0, homes: hCount || 0 })
      setRecentHomes(homes || [])
    }
    load()
  }, [])

  const firstName = user?.user_metadata?.full_name?.split(' ')[0] || user?.email?.split('@')[0] || 'there'

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Hey, {firstName} 👋</h1>
        <p className="text-gray-500 mt-1">Compare prospective homes by what matters most — time to the places you actually go.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <StatCard icon={<MapPin size={20} className="text-violet-600" />} label="Saved places" value={counts.locations} bg="bg-violet-50" />
        <StatCard icon={<Building2 size={20} className="text-blue-600" />} label="Homes" value={counts.homes} bg="bg-blue-50" />
        <StatCard icon={<BarChart3 size={20} className="text-emerald-600" />} label="Comparisons" value={counts.homes > 1 ? 'Ready' : 'Need 2+ homes'} bg="bg-emerald-50" isText />
      </div>

      {/* Quick actions */}
      <div className="grid sm:grid-cols-2 gap-4">
        <ActionCard
          to="/saved-locations"
          icon={<MapPin size={22} className="text-violet-600" />}
          title="Manage My Places"
          desc="Add your work, gym, family, restaurants — anywhere you go regularly."
          cta="Add a place"
          bg="bg-violet-50"
        />
        <ActionCard
          to="/homes"
          icon={<Building2 size={22} className="text-blue-600" />}
          title="Evaluate Homes"
          desc="Add a prospective address and see driving times to all your saved places."
          cta="Add a home"
          bg="bg-blue-50"
        />
      </div>

      {/* Recent homes */}
      {recentHomes.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-700">Recent homes</h2>
            <Link to="/homes" className="text-xs text-blue-600 hover:underline">View all</Link>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            {recentHomes.map(home => (
              <Link
                key={home.id}
                to={`/homes/${home.id}`}
                className="flex items-start gap-3 bg-white rounded-xl border border-gray-200 p-4 hover:border-blue-300 hover:shadow-sm transition-all"
              >
                <div className="mt-0.5 text-blue-500"><Building2 size={16} /></div>
                <div className="min-w-0">
                  <p className="font-medium text-gray-900 text-sm truncate">{home.label}</p>
                  <p className="text-xs text-gray-400 truncate mt-0.5">{home.address}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {counts.locations === 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 text-sm text-amber-800">
          <strong>Start here:</strong> Add your saved places first (work, gym, family, etc.), then add homes to evaluate. We'll calculate driving times automatically.
        </div>
      )}
    </div>
  )
}

function StatCard({ icon, label, value, bg, isText }) {
  return (
    <div className={`${bg} rounded-xl p-4`}>
      <div className="mb-2">{icon}</div>
      <div className={`font-bold text-gray-900 ${isText ? 'text-sm' : 'text-2xl'}`}>{value}</div>
      <div className="text-xs text-gray-500 mt-0.5">{label}</div>
    </div>
  )
}

function ActionCard({ to, icon, title, desc, cta, bg }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 flex flex-col gap-3">
      <div className={`${bg} w-10 h-10 rounded-xl flex items-center justify-center`}>{icon}</div>
      <div>
        <h3 className="font-semibold text-gray-900 text-sm">{title}</h3>
        <p className="text-xs text-gray-500 mt-1">{desc}</p>
      </div>
      <Link
        to={to}
        className="mt-auto inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:underline"
      >
        <Plus size={13} /> {cta}
      </Link>
    </div>
  )
}
