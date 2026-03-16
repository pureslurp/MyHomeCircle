# HoodMatrix

A web app for evaluating prospective homes by calculating driving times to the places you visit regularly (work, gym, family, friends, restaurants, etc.).

## Stack

- **Frontend**: React + Vite + Tailwind CSS v4
- **Auth + Database**: Supabase (Postgres + Row Level Security)
- **Maps display**: Leaflet.js + OpenStreetMap (free, no key needed)
- **Geocoding + Driving times**: Google Maps Platform (Places API + Distance Matrix API)
- **Hosting target**: Vercel

## Project structure

```
src/
  contexts/AuthContext.jsx     # Supabase auth state, Google OAuth + email/password
  lib/supabase.js              # Supabase client (reads from .env)
  lib/googleMaps.js            # Singleton Google Maps JS API loader
  lib/distanceService.js       # getDrivingTimes() with Supabase cache layer
  components/
    ProtectedRoute.jsx         # Wraps auth-required routes, renders Header + Outlet
    Header.jsx                 # Nav bar with links and sign out
    AddressAutocomplete.jsx    # Uncontrolled input backed by Google Places Autocomplete
    LocationMap.jsx            # react-leaflet map with home + saved location markers
    CategoryBadge.jsx          # Colored pill badge + shared category color constants
  pages/
    Login.jsx                  # Google OAuth + email/password sign in/up
    Dashboard.jsx              # Stats overview and quick-action cards
    SavedLocations.jsx         # CRUD for recurring places (work, gym, family, etc.)
    Homes.jsx                  # List of prospective homes
    HomeDetail.jsx             # Driving times from one home to all saved places, with map
    Compare.jsx                # Side-by-side comparison table across multiple homes
supabase/schema.sql            # Full DB schema + RLS policies (run once in Supabase SQL editor)
```

## Environment variables

```
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
VITE_GOOGLE_MAPS_API_KEY      # Needs Places API + Distance Matrix API enabled
```

Copy `.env.example` to `.env` and fill in values.

## Database tables

- `saved_locations` — recurring places with name, category (nullable), address, lat/lng
- `prospective_homes` — addresses being evaluated with label, address, lat/lng
- `distance_cache` — cached driving times (home_id × saved_location_id) to minimize Google API calls

All tables have Row Level Security — users only see their own data.

## Key behaviors

- **API call optimization**: `getDrivingTimes()` checks Supabase cache first and only calls Google Distance Matrix for uncached pairs. Results are stored after each call. Use the "Recalculate" button on HomeDetail to force a refresh.
- **Cache invalidation**: editing or deleting a saved location clears its cache entries; deleting a home clears all its cache entries.
- **Categories**: freeform text with suggested quick-picks (Work, Family, Friends, Gym, Restaurant, Shopping, Healthcare). Null category = "Uncategorized".
- **Compare page**: highlights the "best" (lowest) time per category and shows an overall average row.

## Dev

```bash
npm run dev      # http://localhost:5173
npm run build
```
