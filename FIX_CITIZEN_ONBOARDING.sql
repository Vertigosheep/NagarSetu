-- Fix Citizen Onboarding Issues
-- This script ensures citizen onboarding works properly

-- First, ensure all necessary columns exist
DO $$ 
BEGIN
    -- Add is_onboarding_complete column if missing
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'user_profiles' AND column_name = 'is_onboarding_complete'
    ) THEN
        ALTER TABLE user_profiles ADD COLUMN is_onboarding_complete BOOLEAN DEFAULT FALSE;
        RAISE NOTICE 'Added is_onboarding_complete column to user_profiles table';
    END IF;
    
    -- Add user_type column if missing
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'user_profiles' AND column_name = 'user_type'
    ) THEN
        ALTER TABLE user_profiles ADD COLUMN user_type VARCHAR(20) DEFAULT 'citizen';
        RAISE NOTICE 'Added user_type column to user_profiles table';
    END IF;
    
    -- Ensure other required columns exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'user_profiles' AND column_name = 'full_name'
    ) THEN
        ALTER TABLE user_profiles ADD COLUMN full_name TEXT;
        RAISE NOTICE 'Added full_name column to user_profiles table';
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'user_profiles' AND column_name = 'age'
    ) THEN
        ALTER TABLE user_profiles ADD COLUMN age INTEGER;
        RAISE NOTICE 'Added age column to user_profiles table';
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'user_profiles' AND column_name = 'gender'
    ) THEN
        ALTER TABLE user_profiles ADD COLUMN gender TEXT;
        RAISE NOTICE 'Added gender column to user_profiles table';
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'user_profiles' AND column_name = 'address'
    ) THEN
        ALTER TABLE user_profiles ADD COLUMN address TEXT;
        RAISE NOTICE 'Added address column to user_profiles table';
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'user_profiles' AND column_name = 'city'
    ) THEN
        ALTER TABLE user_profiles ADD COLUMN city TEXT;
        RAISE NOTICE 'Added city column to user_profiles table';
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'user_profiles' AND column_name = 'state'
    ) THEN
        ALTER TABLE user_profiles ADD COLUMN state TEXT;
        RAISE NOTICE 'Added state column to user_profiles table';
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'user_profiles' AND column_name = 'zip_code'
    ) THEN
        ALTER TABLE user_profiles ADD COLUMN zip_code TEXT;
        RAISE NOTICE 'Added zip_code column to user_profiles table';
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'user_profiles' AND column_name = 'bio'
    ) THEN
        ALTER TABLE user_profiles ADD COLUMN bio TEXT;
        RAISE NOTICE 'Added bio column to user_profiles table';
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'user_profiles' AND column_name = 'created_at'
    ) THEN
        ALTER TABLE user_profiles ADD COLUMN created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
        RAISE NOTICE 'Added created_at column to user_profiles table';
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'user_profiles' AND column_name = 'updated_at'
    ) THEN
        ALTER TABLE user_profiles ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
        RAISE NOTICE 'Added updated_at column to user_profiles table';
    END IF;
END $$;

-- Fix any existing profiles that might have wrong data
-- Set default user_type for profiles without it
UPDATE user_profiles 
SET user_type = 'citizen', 
    updated_at = NOW()
WHERE user_type IS NULL;

-- Fix any profiles that have 'role' instead of 'user_type' (if role column exists)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'user_profiles' AND column_name = 'role'
    ) THEN
        -- Copy role to user_type where user_type is null
        UPDATE user_profiles 
        SET user_type = CASE 
            WHEN role = 'resident' THEN 'citizen'
            WHEN role = 'authority' THEN 'authority'
            WHEN role = 'official' THEN 'official'
            ELSE 'citizen'
        END,
        updated_at = NOW()
        WHERE user_type IS NULL AND role IS NOT NULL;
        
        RAISE NOTICE 'Migrated role data to user_type column';
    END IF;
END $$;

-- Ensure RLS is properly configured
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- Create or update RLS policies for user profiles
DROP POLICY IF EXISTS "Users can view own profile" ON user_profiles;
CREATE POLICY "Users can view own profile" ON user_profiles
FOR SELECT
TO authenticated
USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON user_profiles;
CREATE POLICY "Users can update own profile" ON user_profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can insert own profile" ON user_profiles;
CREATE POLICY "Users can insert own profile" ON user_profiles
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = id);

-- Grant necessary permissions
GRANT ALL ON user_profiles TO authenticated;

-- Verification queries
SELECT 
    'Database Schema Check' as test_name,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'user_profiles'
AND column_name IN ('is_onboarding_complete', 'user_type', 'full_name', 'age', 'gender', 'address', 'city', 'state', 'zip_code', 'bio')
ORDER BY column_name;

-- Check existing profiles
SELECT 
    'Existing Profiles Check' as test_name,
    COUNT(*) as total_profiles,
    COUNT(*) FILTER (WHERE is_onboarding_complete = true) as completed_profiles,
    COUNT(*) FILTER (WHERE user_type = 'citizen') as citizen_profiles,
    COUNT(*) FILTER (WHERE user_type = 'official') as official_profiles,
    COUNT(*) FILTER (WHERE user_type = 'authority') as authority_profiles
FROM user_profiles;

-- Final verification
SELECT 
    '=== CITIZEN ONBOARDING FIX COMPLETE ===' as summary,
    (SELECT COUNT(*) FROM information_schema.columns 
     WHERE table_name = 'user_profiles' 
     AND column_name IN ('is_onboarding_complete', 'user_type', 'full_name', 'age', 'gender', 'address', 'city', 'state', 'zip_code', 'bio')
    ) as required_columns_count,
    (SELECT COUNT(*) FROM user_profiles) as total_profiles,
    CASE 
        WHEN (SELECT COUNT(*) FROM information_schema.columns 
              WHERE table_name = 'user_profiles' 
              AND column_name IN ('is_onboarding_complete', 'user_type', 'full_name', 'age', 'gender', 'address', 'city', 'state', 'zip_code', 'bio')
             ) >= 10
        THEN '✅ Schema setup complete'
        ELSE '❌ Schema setup incomplete'
    END as status;