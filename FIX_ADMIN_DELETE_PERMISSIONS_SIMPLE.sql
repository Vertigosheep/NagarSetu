-- Simple Admin Delete Permissions Fix
-- This version works without requiring a user_type column

-- Create or update RLS policies for admin deletion based on email
-- First, drop existing policies if they exist
DROP POLICY IF EXISTS "Authority users can delete any issue" ON issues;
DROP POLICY IF EXISTS "Admin delete policy" ON issues;
DROP POLICY IF EXISTS "Authority delete access" ON issues;
DROP POLICY IF EXISTS "Admin email delete policy" ON issues;

-- Create RLS policy for admin deletion based on email
CREATE POLICY "Admin email delete policy" ON issues
FOR DELETE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM user_profiles 
        WHERE user_profiles.id = auth.uid() 
        AND user_profiles.email = 'abhitest1290@gmail.com'
    )
    OR
    EXISTS (
        SELECT 1 FROM auth.users
        WHERE auth.users.id = auth.uid()
        AND auth.users.email = 'abhitest1290@gmail.com'
    )
);

-- Ensure RLS is enabled on the issues table
ALTER TABLE issues ENABLE ROW LEVEL SECURITY;

-- Create policy for admin to view all issues (needed for deletion)
DROP POLICY IF EXISTS "Admin can view all issues" ON issues;
CREATE POLICY "Admin can view all issues" ON issues
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM user_profiles 
        WHERE user_profiles.id = auth.uid() 
        AND user_profiles.email = 'abhitest1290@gmail.com'
    )
    OR
    EXISTS (
        SELECT 1 FROM auth.users
        WHERE auth.users.id = auth.uid()
        AND auth.users.email = 'abhitest1290@gmail.com'
    )
    OR 
    created_by = auth.uid()
);

-- Create policy for admin to update any issue (needed for status changes)
DROP POLICY IF EXISTS "Admin can update any issue" ON issues;
CREATE POLICY "Admin can update any issue" ON issues
FOR UPDATE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM user_profiles 
        WHERE user_profiles.id = auth.uid() 
        AND user_profiles.email = 'abhitest1290@gmail.com'
    )
    OR
    EXISTS (
        SELECT 1 FROM auth.users
        WHERE auth.users.id = auth.uid()
        AND auth.users.email = 'abhitest1290@gmail.com'
    )
    OR 
    created_by = auth.uid()
);

-- Ensure the admin user exists in user_profiles
INSERT INTO user_profiles (id, email, full_name, created_at, updated_at)
SELECT 
    id,
    'abhitest1290@gmail.com',
    'Pradhan (Village Head)',
    NOW(),
    NOW()
FROM auth.users 
WHERE email = 'abhitest1290@gmail.com'
AND NOT EXISTS (
    SELECT 1 FROM user_profiles WHERE email = 'abhitest1290@gmail.com'
)
ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = EXCLUDED.full_name,
    updated_at = NOW();

-- Grant necessary permissions
GRANT ALL ON issues TO authenticated;
GRANT ALL ON user_profiles TO authenticated;

-- Verification query
SELECT 
    'Admin setup verification' as message,
    up.id,
    up.email,
    up.full_name,
    au.email as auth_email,
    'Admin permissions configured' as status
FROM user_profiles up
JOIN auth.users au ON up.id = au.id
WHERE up.email = 'abhitest1290@gmail.com';