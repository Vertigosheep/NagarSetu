-- Check Database Schema to understand table structure

-- 1. Check user_profiles table structure
SELECT 
    'user_profiles table structure' as info,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'user_profiles'
ORDER BY ordinal_position;

-- 2. Check issues table structure
SELECT 
    'issues table structure' as info,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'issues'
ORDER BY ordinal_position;

-- 3. Check what tables exist in the public schema
SELECT 
    'Available tables' as info,
    table_name,
    table_type
FROM information_schema.tables 
WHERE table_schema = 'public'
ORDER BY table_name;

-- 4. Check current user_profiles data
SELECT 
    'Current user_profiles data' as info,
    *
FROM user_profiles
LIMIT 5;

-- 5. Check for any admin-related users
SELECT 
    'Admin users check' as info,
    *
FROM user_profiles
WHERE email LIKE '%abhitest1290%' OR email LIKE '%admin%';