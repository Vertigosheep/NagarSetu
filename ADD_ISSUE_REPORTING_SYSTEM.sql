-- Add Issue Reporting System for Pradhan to Report Suspicious Issues to Admin
-- This allows Pradhan to flag issues as spam/fake/duplicate for admin review

-- Create issue_reports table for tracking reported issues
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

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_issue_reports_issue_id ON issue_reports(issue_id);
CREATE INDEX IF NOT EXISTS idx_issue_reports_status ON issue_reports(status);
CREATE INDEX IF NOT EXISTS idx_issue_reports_reported_by ON issue_reports(reported_by);

-- Enable RLS on issue_reports table
ALTER TABLE issue_reports ENABLE ROW LEVEL SECURITY;

-- Policy for Pradhan to create reports
CREATE POLICY "Pradhan can create issue reports" ON issue_reports
FOR INSERT
TO authenticated
WITH CHECK (
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

-- Policy for Pradhan to view their own reports
CREATE POLICY "Pradhan can view issue reports" ON issue_reports
FOR SELECT
TO authenticated
USING (
    reported_by = auth.uid()
    OR
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

-- Policy for Admin to view and update all reports
CREATE POLICY "Admin can manage all issue reports" ON issue_reports
FOR ALL
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

-- Grant permissions
GRANT ALL ON issue_reports TO authenticated;

-- Add a flag to issues table to mark reported issues
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'issues' AND column_name = 'is_reported'
    ) THEN
        ALTER TABLE issues ADD COLUMN is_reported BOOLEAN DEFAULT FALSE;
        RAISE NOTICE 'Added is_reported column to issues table';
    END IF;
END $$;

-- Add report count column to issues table
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'issues' AND column_name = 'report_count'
    ) THEN
        ALTER TABLE issues ADD COLUMN report_count INTEGER DEFAULT 0;
        RAISE NOTICE 'Added report_count column to issues table';
    END IF;
END $$;

-- Create function to update issue report status
CREATE OR REPLACE FUNCTION update_issue_report_status()
RETURNS TRIGGER AS $$
BEGIN
    -- Update the issues table when a report is created
    IF TG_OP = 'INSERT' THEN
        UPDATE issues 
        SET is_reported = TRUE,
            report_count = COALESCE(report_count, 0) + 1,
            updated_at = NOW()
        WHERE id = NEW.issue_id;
        RETURN NEW;
    END IF;
    
    -- Update when report status changes
    IF TG_OP = 'UPDATE' AND OLD.status != NEW.status THEN
        -- If report is approved, we'll handle deletion in the application
        -- If report is rejected, remove the reported flag if no other pending reports
        IF NEW.status = 'rejected' THEN
            UPDATE issues 
            SET is_reported = CASE 
                WHEN (SELECT COUNT(*) FROM issue_reports 
                      WHERE issue_id = NEW.issue_id AND status = 'pending') = 0 
                THEN FALSE 
                ELSE TRUE 
            END,
            updated_at = NOW()
            WHERE id = NEW.issue_id;
        END IF;
        RETURN NEW;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for automatic issue status updates
DROP TRIGGER IF EXISTS trigger_update_issue_report_status ON issue_reports;
CREATE TRIGGER trigger_update_issue_report_status
    AFTER INSERT OR UPDATE ON issue_reports
    FOR EACH ROW
    EXECUTE FUNCTION update_issue_report_status();

-- Insert some sample report reasons for reference
CREATE TABLE IF NOT EXISTS report_reasons (
    id SERIAL PRIMARY KEY,
    reason VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    severity VARCHAR(20) DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

INSERT INTO report_reasons (reason, description, severity) VALUES
('Spam Report', 'Issue appears to be spam or automated posting', 'high'),
('Duplicate Issue', 'This issue is a duplicate of another existing issue', 'medium'),
('Fake/False Report', 'Issue appears to be fabricated or false', 'high'),
('Inappropriate Content', 'Issue contains inappropriate or offensive content', 'high'),
('Not a Real Issue', 'Reported problem does not actually exist', 'medium'),
('Wrong Location', 'Issue is reported for wrong or non-existent location', 'low'),
('Test Issue', 'Issue appears to be a test submission', 'low'),
('Resolved Elsewhere', 'Issue has already been resolved through other means', 'low')
ON CONFLICT (reason) DO NOTHING;

-- Grant permissions on report_reasons
GRANT SELECT ON report_reasons TO authenticated;

-- Verification query
SELECT 
    'Issue Reporting System Setup Complete' as message,
    (SELECT COUNT(*) FROM issue_reports) as total_reports,
    (SELECT COUNT(*) FROM report_reasons) as available_reasons,
    (SELECT COUNT(*) FROM issues WHERE is_reported = TRUE) as reported_issues;