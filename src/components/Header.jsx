import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { LogOut } from 'lucide-react'

const NAV = [
  { path: '/', label: 'Dashboard' },
  { path: '/saved-locations', label: 'My Places' },
  { path: '/homes', label: 'Homes' },
  { path: '/compare', label: 'Compare' },
]

export default function Header() {
  const { user, signOut } = useAuth()
  const { pathname } = useLocation()

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <Link to="/" className="flex items-center gap-2 font-bold text-base">
            <img src="/logo.svg" alt="MyHomeCircle" className="w-7 h-7" />
            <span className="text-gray-800">My</span><span className="text-blue-600">HomeCircle</span>
          </Link>
          <nav className="hidden sm:flex items-center gap-1">
            {NAV.map(({ path, label }) => (
              <Link
                key={path}
                to={path}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  pathname === path
                    ? 'bg-blue-50 text-blue-600'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`}
              >
                {label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-400 hidden md:block truncate max-w-[180px]">
            {user?.email}
          </span>
          <button
            onClick={signOut}
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition-colors"
          >
            <LogOut size={15} />
            <span className="hidden sm:inline">Sign out</span>
          </button>
        </div>
      </div>
    </header>
  )
}
