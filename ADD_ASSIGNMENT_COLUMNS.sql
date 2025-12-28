-- Add missing assignment-related columns to issues table
-- Run this script to add assignment tracking columns

-- Add assignment_notes column for storing assignment instructions
ALTER TABLE issues 
ADD COLUMN IF NOT EXISTS assignment_notes TEXT;

-- Add assigned_at column for tracking when issue was assigned
ALTER TABLE issues 
ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMP WITH TIME ZONE;

-- Add priority column for issue priority tracking
ALTER TABLE issues 
ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'medium';

-- Add urgency column for compatibility
ALTER TABLE issues 
ADD COLUMN IF NOT EXISTS urgency TEXT DEFAULT 'medium';

-- Create index for assignment tracking
CREATE INDEX IF NOT EXISTS idx_issues_assigned_to ON issues(assigned_to);
CREATE INDEX IF NOT EXISTS idx_issues_assigned_at ON issues(assigned_at);
CREATE INDEX IF NOT EXISTS idx_issues_priority ON issues(priority);

-- Update existing issues to have default priority based on category
UPDATE issues 
SET priority = CASE 
  WHEN category = 'Safety' THEN 'critical'
  WHEN category IN ('Water', 'Electricity') THEN 'high'
  WHEN category IN ('Infrastructure', 'Transportation', 'Drainage') THEN 'medium'
  ELSE 'low'
END
WHERE priority IS NULL OR priority = 'medium';

-- Update urgency to match priority for compatibility
UPDATE issues SET urgency = priority WHERE urgency IS NULL OR urgency = 'medium';

-- Verify the changes
SELECT 
  'Assignment Columns Added' as status,
  COUNT(*) as total_issues,
  COUNT(assigned_to) as assigned_issues,
  COUNT(assignment_notes) as issues_with_notes
FROM issues;

-- Show column information
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'issues' 
AND column_name IN ('assignment_notes', 'assigned_at', 'priority', 'urgency')
ORDER BY column_name;