-- ============================================================
-- HoodMatrix Database Schema
-- Run this in your Supabase SQL editor
-- ============================================================

-- Saved recurring locations (work, gym, family, etc.)
CREATE TABLE IF NOT EXISTS saved_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT,  -- NULL = uncategorized
  address TEXT NOT NULL,
  lat DECIMAL(10, 8) NOT NULL,
  lng DECIMAL(11, 8) NOT NULL,
  visits_per_week NUMERIC DEFAULT 1 CHECK (visits_per_week > 0),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- To add visits_per_week to an existing database, run:
--   ALTER TABLE saved_locations ADD COLUMN IF NOT EXISTS visits_per_week NUMERIC DEFAULT 1 CHECK (visits_per_week > 0);
--   UPDATE saved_locations SET visits_per_week = 1 WHERE visits_per_week IS NULL;

-- Prospective homes / locations being evaluated
CREATE TABLE IF NOT EXISTS prospective_homes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  address TEXT NOT NULL,
  lat DECIMAL(10, 8) NOT NULL,
  lng DECIMAL(11, 8) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Cached driving time results (avoids repeat API calls)
CREATE TABLE IF NOT EXISTS distance_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  home_id UUID NOT NULL REFERENCES prospective_homes(id) ON DELETE CASCADE,
  saved_location_id UUID NOT NULL REFERENCES saved_locations(id) ON DELETE CASCADE,
  driving_minutes INTEGER NOT NULL,
  driving_meters INTEGER NOT NULL,
  cached_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(home_id, saved_location_id)
);

-- ============================================================
-- Row Level Security
-- ============================================================

ALTER TABLE saved_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE prospective_homes ENABLE ROW LEVEL SECURITY;
ALTER TABLE distance_cache ENABLE ROW LEVEL SECURITY;

-- saved_locations policies
CREATE POLICY "select own saved_locations"
  ON saved_locations FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "insert own saved_locations"
  ON saved_locations FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "update own saved_locations"
  ON saved_locations FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "delete own saved_locations"
  ON saved_locations FOR DELETE USING (auth.uid() = user_id);

-- prospective_homes policies
CREATE POLICY "select own homes"
  ON prospective_homes FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "insert own homes"
  ON prospective_homes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "update own homes"
  ON prospective_homes FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "delete own homes"
  ON prospective_homes FOR DELETE USING (auth.uid() = user_id);

-- distance_cache policies (scoped through home ownership)
CREATE POLICY "select own distance_cache"
  ON distance_cache FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM prospective_homes
    WHERE id = home_id AND user_id = auth.uid()
  ));
CREATE POLICY "insert own distance_cache"
  ON distance_cache FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM prospective_homes
    WHERE id = home_id AND user_id = auth.uid()
  ));
CREATE POLICY "delete own distance_cache"
  ON distance_cache FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM prospective_homes
    WHERE id = home_id AND user_id = auth.uid()
  ));
