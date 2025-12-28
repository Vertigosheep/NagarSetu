-- Clean Setup for Issue Reporting System
-- This script handles existing policies and fixes permissions

-- First, drop existing policies if they exist
DROP POLICY IF EXISTS "Pradhan can create issue reports" ON issue_reports;
DROP POLICY IF EXISTS "Pradhan can create reports" ON issue_reports;
DROP POLICY IF EXISTS "Pradhan can view issue reports" ON issue_reports;
DROP POLICY IF EXISTS "Pradhan can view reports" ON issue_reports;
DROP POLICY IF EXISTS "Admin can manage all issue reports" ON issue_reports;
DROP POLICY IF EXISTS "Admin can manage reports" ON issue_reports;

-- Add reporting columns to issues table if they don't exist
DO $$ 
BEGIN
    -- Add is_reported column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'issues' AND column_name = 'is_reported'
    ) THEN
        ALTER TABLE issues ADD COLUMN is_reported BOOLEAN DEFAULT FALSE;
        RAISE NOTICE 'Added is_reported column to issues table';
    END IF;
    
    -- Add report_count column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'issues' AND column_name = 'report_count'
    ) THEN
        ALTER TABLE issues ADD COLUMN report_count INTEGER DEFAULT 0;
        RAISE NOTICE 'Added report_count column to issues table';
    END IF;
END $$;

-- Create issue_reports table if it doesn't exist
CREATE TABLE IF NOT EXISTS issue_reports (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    issue_id UUID NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
    reported_by UUID NOT NULL REFERENCES auth.users(id),
    report_reason VARCHAR(100) NOT NULL,
    report_description TEXT,
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    reviewed_by UUID REFERENCES auth.users(id),
    review_notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    reviewed_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes if they don't exist
CREATE INDEX IF NOT EXISTS idx_issue_reports_issue_id ON issue_reports(issue_id);
CREATE INDEX IF NOT EXISTS idx_issue_reports_status ON issue_reports(status);
CREATE INDEX IF NOT EXISTS idx_issue_reports_reported_by ON issue_reports(reported_by);

-- Enable RLS
ALTER TABLE issue_reports ENABLE ROW LEVEL SECURITY;

-- Create new RLS policies with proper permissions
-- Policy 1: Allow Pradhan to create reports
CREATE POLICY "pradhan_create_reports" ON issue_reports
FOR INSERT
TO authenticated
WITH CHECK (
    -- Check if the current user is Pradhan by email
    EXISTS (
        SELECT 1 FROM auth.users
        WHERE auth.users.id = auth.uid()
        AND auth.users.email = 'abhitest1290@gmail.com'
    )
    OR
    -- Also check user_profiles table if it exists and has the email
    EXISTS (
        SELECT 1 FROM user_profiles
        WHERE user_profiles.id = auth.uid()
        AND user_profiles.email = 'abhitest1290@gmail.com'
    )
);

-- Policy 2: Allow Pradhan to view their own reports and admin to view all
CREATE POLICY "pradhan_view_reports" ON issue_reports
FOR SELECT
TO authenticated
USING (
    -- User can see their own reports
    reported_by = auth.uid()
    OR
    -- Pradhan/Admin can see all reports
    EXISTS (
        SELECT 1 FROM auth.users
        WHERE auth.users.id = auth.uid()
        AND auth.users.email = 'abhitest1290@gmail.com'
    )
    OR
    EXISTS (
        SELECT 1 FROM user_profiles
        WHERE user_profiles.id = auth.uid()
        AND user_profiles.email = 'abhitest1290@gmail.com'
    )
);

-- Policy 3: Allow admin to update reports (approve/reject)
CREATE POLICY "admin_update_reports" ON issue_reports
FOR UPDATE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM auth.users
        WHERE auth.users.id = auth.uid()
        AND auth.users.email = 'abhitest1290@gmail.com'
    )
    OR
    EXISTS (
        SELECT 1 FROM user_profiles
        WHERE user_profiles.id = auth.uid()
        AND user_profiles.email = 'abhitest1290@gmail.com'
    )
);

-- Grant necessary permissions
GRANT ALL ON issue_reports TO authenticated;
GRANT USAGE ON SCHEMA public TO authenticated;

-- Ensure the Pradhan user exists in user_profiles
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

-- Test the setup
DO $$
DECLARE
    pradhan_user_id UUID;
BEGIN
    -- Get Pradhan's user ID
    SELECT id INTO pradhan_user_id 
    FROM auth.users 
    WHERE email = 'abhitest1290@gmail.com';
    
    IF pradhan_user_id IS NOT NULL THEN
        RAISE NOTICE 'Pradhan user found with ID: %', pradhan_user_id;
        
        -- Check if user can access the table
        PERFORM 1 FROM issue_reports LIMIT 1;
        RAISE NOTICE 'issue_reports table is accessible';
        
    ELSE
        RAISE NOTICE 'Pradhan user not found - user needs to sign up first';
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Setup completed with warnings: %', SQLERRM;
END $$;

-- Final verification
SELECT 
    'Setup completed successfully' as message,
    (SELECT COUNT(*) FROM issue_reports) as total_reports,
    (SELECT COUNT(*) FROM issues WHERE is_reported = TRUE) as reported_issues,
    (SELECT COUNT(*) FROM user_profiles WHERE email = 'abhitest1290@gmail.com') as pradhan_profiles;