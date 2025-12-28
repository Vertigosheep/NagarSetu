-- Test Reporting Permissions
-- Run this to verify the setup is working correctly

-- 1. Check if Pradhan user exists
SELECT 
    'Pradhan User Check' as test_name,
    au.id,
    au.email,
    up.full_name,
    CASE 
        WHEN au.id IS NOT NULL THEN '✅ PASS - User exists in auth.users'
        ELSE '❌ FAIL - User not found in auth.users'
    END as auth_result,
    CASE 
        WHEN up.id IS NOT NULL THEN '✅ PASS - Profile exists'
        ELSE '❌ FAIL - Profile missing'
    END as profile_result
FROM auth.users au
FULL OUTER JOIN user_profiles up ON au.id = up.id
WHERE au.email = 'abhitest1290@gmail.com' OR up.email = 'abhitest1290@gmail.com';

-- 2. Check table structure
SELECT 
    'Table Structure Check' as test_name,
    table_name,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_name IN ('issue_reports', 'issues')
AND column_name IN ('is_reported', 'report_count', 'report_reason', 'status')
ORDER BY table_name, column_name;

-- 3. Check RLS policies
SELECT 
    'RLS Policies Check' as test_name,
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd
FROM pg_policies 
WHERE tablename = 'issue_reports'
ORDER BY policyname;

-- 4. Check permissions
SELECT 
    'Table Permissions Check' as test_name,
    table_name,
    privilege_type,
    grantee
FROM information_schema.role_table_grants 
WHERE table_name = 'issue_reports'
AND grantee = 'authenticated';

-- 5. Test basic access (this should not fail)
SELECT 
    'Basic Access Test' as test_name,
    COUNT(*) as report_count,
    '✅ PASS - Can access issue_reports table' as result
FROM issue_reports;

-- 6. Check if issues table has reporting columns
SELECT 
    'Issues Table Check' as test_name,
    COUNT(*) as total_issues,
    COUNT(*) FILTER (WHERE is_reported = TRUE) as reported_issues,
    CASE 
        WHEN COUNT(*) FILTER (WHERE is_reported IS NOT NULL) > 0 
        THEN '✅ PASS - is_reported column exists'
        ELSE '❌ FAIL - is_reported column missing'
    END as column_check
FROM issues;

-- Summary
SELECT 
    '=== SETUP SUMMARY ===' as summary,
    (SELECT COUNT(*) FROM auth.users WHERE email = 'abhitest1290@gmail.com') as pradhan_auth_users,
    (SELECT COUNT(*) FROM user_profiles WHERE email = 'abhitest1290@gmail.com') as pradhan_profiles,
    (SELECT COUNT(*) FROM pg_policies WHERE tablename = 'issue_reports') as rls_policies,
    (SELECT COUNT(*) FROM issue_reports) as total_reports,
    CASE 
        WHEN EXISTS (SELECT 1 FROM auth.users WHERE email = 'abhitest1290@gmail.com')
        AND EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'issue_reports')
        THEN '✅ Setup appears complete'
        ELSE '❌ Setup incomplete'
    END as status;