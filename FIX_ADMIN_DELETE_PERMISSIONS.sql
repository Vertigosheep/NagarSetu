-- Fix Admin Delete Permissions for Issue Management
-- This script sets up proper admin permissions and RLS policies for issue deletion

-- First, check if user_type column exists, if not create it
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'user_profiles' AND column_name = 'user_type'
    ) THEN
        ALTER TABLE user_profiles ADD COLUMN user_type VARCHAR(50) DEFAULT 'citizen';
        RAISE NOTICE 'Added user_type column to user_profiles table';
    END IF;
END $$;

-- Now ensure the admin user has the correct user_type
UPDATE user_profiles 
SET user_type = 'authority',
    updated_at = NOW()
WHERE email = 'abhitest1290@gmail.com';

-- If the admin user doesn't exist in user_profiles, create it
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM user_profiles WHERE email = 'abhitest1290@gmail.com') THEN
        -- First check if the user exists in auth.users
        IF EXISTS (SELECT 1 FROM auth.users WHERE email = 'abhitest1290@gmail.com') THEN
            INSERT INTO user_profiles (id, email, full_name, user_type, created_at, updated_at)
            SELECT 
                id,
                'abhitest1290@gmail.com',
                'Pradhan (Village Head)',
                'authority',
                NOW(),
                NOW()
            FROM auth.users 
            WHERE email = 'abhitest1290@gmail.com';
            RAISE NOTICE 'Created user profile for admin user';
        ELSE
            RAISE NOTICE 'Admin user not found in auth.users - user needs to sign up first';
        END IF;
    END IF;
END $$;

-- Create or update RLS policies for admin deletion
-- First, drop existing policies if they exist
DROP POLICY IF EXISTS "Authority users can delete any issue" ON issues;
DROP POLICY IF EXISTS "Admin delete policy" ON issues;
DROP POLICY IF EXISTS "Authority delete access" ON issues;

-- Create comprehensive RLS policy for admin deletion
CREATE POLICY "Authority users can delete any issue" ON issues
FOR DELETE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM user_profiles 
        WHERE user_profiles.id = auth.uid() 
        AND user_profiles.user_type = 'authority'
    )
);

-- Ensure RLS is enabled on the issues table
ALTER TABLE issues ENABLE ROW LEVEL SECURITY;

-- Create policy for authority users to view all issues (needed for deletion)
DROP POLICY IF EXISTS "Authority users can view all issues" ON issues;
CREATE POLICY "Authority users can view all issues" ON issues
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM user_profiles 
        WHERE user_profiles.id = auth.uid() 
        AND user_profiles.user_type = 'authority'
    )
    OR 
    created_by = auth.uid()
);

-- Create policy for authority users to update any issue (needed for status changes)
DROP POLICY IF EXISTS "Authority users can update any issue" ON issues;
CREATE POLICY "Authority users can update any issue" ON issues
FOR UPDATE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM user_profiles 
        WHERE user_profiles.id = auth.uid() 
        AND user_profiles.user_type = 'authority'
    )
    OR 
    created_by = auth.uid()
);

-- Verify the admin user setup
SELECT 
    up.id,
    up.email,
    up.full_name,
    up.user_type,
    au.email as auth_email,
    'Admin setup verified' as status
FROM user_profiles up
JOIN auth.users au ON up.id = au.id
WHERE up.email = 'abhitest1290@gmail.com';

-- Create audit log table for tracking deletions (optional but recommended)
CREATE TABLE IF NOT EXISTS issue_audit_log (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    issue_id UUID NOT NULL,
    action VARCHAR(50) NOT NULL,
    performed_by UUID REFERENCES auth.users(id),
    reason TEXT,
    issue_data JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on audit log
ALTER TABLE issue_audit_log ENABLE ROW LEVEL SECURITY;

-- Policy for authority users to insert audit logs
CREATE POLICY "Authority users can create audit logs" ON issue_audit_log
FOR INSERT
TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM user_profiles 
        WHERE user_profiles.id = auth.uid() 
        AND user_profiles.user_type = 'authority'
    )
);

-- Policy for authority users to view audit logs
CREATE POLICY "Authority users can view audit logs" ON issue_audit_log
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM user_profiles 
        WHERE user_profiles.id = auth.uid() 
        AND user_profiles.user_type = 'authority'
    )
);

-- Grant necessary permissions
GRANT ALL ON issues TO authenticated;
GRANT ALL ON user_profiles TO authenticated;
GRANT ALL ON issue_audit_log TO authenticated;

-- Final verification query
SELECT 
    'Admin permissions setup completed' as message,
    COUNT(*) as authority_users_count
FROM user_profiles 
WHERE user_type = 'authority';

-- Test query to verify deletion permissions
SELECT 
    'Deletion test query' as test_type,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM user_profiles 
            WHERE email = 'abhitest1290@gmail.com' 
            AND user_type = 'authority'
        ) THEN 'PASS: Admin user has authority type'
        ELSE 'FAIL: Admin user missing or wrong type'
    END as permission_check;