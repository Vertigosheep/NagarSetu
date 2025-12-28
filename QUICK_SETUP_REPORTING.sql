-- Quick Setup for Issue Reporting System
-- Run this first to get basic functionality working

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

-- Create basic issue_reports table
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

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_issue_reports_issue_id ON issue_reports(issue_id);
CREATE INDEX IF NOT EXISTS idx_issue_reports_status ON issue_reports(status);
CREATE INDEX IF NOT EXISTS idx_issue_reports_reported_by ON issue_reports(reported_by);

-- Enable RLS
ALTER TABLE issue_reports ENABLE ROW LEVEL SECURITY;

-- Basic RLS policies for Pradhan (email-based)
CREATE POLICY "Pradhan can create reports" ON issue_reports
FOR INSERT
TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM auth.users
        WHERE auth.users.id = auth.uid()
        AND auth.users.email = 'abhitest1290@gmail.com'
    )
);

CREATE POLICY "Pradhan can view reports" ON issue_reports
FOR SELECT
TO authenticated
USING (
    reported_by = auth.uid()
    OR
    EXISTS (
        SELECT 1 FROM auth.users
        WHERE auth.users.id = auth.uid()
        AND auth.users.email = 'abhitest1290@gmail.com'
    )
);

CREATE POLICY "Admin can manage reports" ON issue_reports
FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM auth.users
        WHERE auth.users.id = auth.uid()
        AND auth.users.email = 'abhitest1290@gmail.com'
    )
);

-- Grant permissions
GRANT ALL ON issue_reports TO authenticated;

-- Verification
SELECT 
    'Quick setup completed' as message,
    (SELECT COUNT(*) FROM issue_reports) as total_reports,
    (SELECT COUNT(*) FROM issues WHERE is_reported = TRUE) as reported_issues;