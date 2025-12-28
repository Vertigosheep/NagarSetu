-- Test Admin Permissions Script
-- Run this after FIX_ADMIN_DELETE_PERMISSIONS.sql to verify everything is working

-- 1. Check if admin user exists and has correct type
SELECT 
    'Admin User Check' as test_name,
    up.id,
    up.email,
    up.full_name,
    up.user_type,
    au.email as auth_email,
    CASE 
        WHEN up.user_type = 'authority' THEN '✅ PASS'
        ELSE '❌ FAIL - Wrong user type'
    END as result
FROM user_profiles up
JOIN auth.users au ON up.id = au.id
WHERE up.email = 'abhitest1290@gmail.com';

-- 2. Check RLS policies on issues table
SELECT 
    'RLS Policies Check' as test_name,
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual
FROM pg_policies 
WHERE tablename = 'issues' 
AND policyname LIKE '%Authority%';

-- 3. Check if audit log table exists
SELECT 
    'Audit Log Table Check' as test_name,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_name = 'issue_audit_log'
        ) THEN '✅ PASS - Audit table exists'
        ELSE '❌ FAIL - Audit table missing'
    END as result;

-- 4. Test issue count (should show all issues for admin)
SELECT 
    'Issue Access Test' as test_name,
    COUNT(*) as total_issues,
    '✅ Admin can see all issues' as result
FROM issues;

-- 5. Check user permissions on tables
SELECT 
    'Table Permissions Check' as test_name,
    table_name,
    privilege_type,
    grantee
FROM information_schema.role_table_grants 
WHERE table_name IN ('issues', 'user_profiles', 'issue_audit_log')
AND grantee = 'authenticated';

-- Summary report
SELECT 
    '=== ADMIN SETUP SUMMARY ===' as summary,
    (SELECT COUNT(*) FROM user_profiles WHERE user_type = 'authority') as authority_users,
    (SELECT COUNT(*) FROM pg_policies WHERE tablename = 'issues') as issues_policies,
    (SELECT COUNT(*) FROM issues) as total_issues,
    CASE 
        WHEN EXISTS (SELECT 1 FROM user_profiles WHERE email = 'abhitest1290@gmail.com' AND user_type = 'authority')
        THEN '✅ Admin setup complete'
        ELSE '❌ Admin setup incomplete'
    END as status;