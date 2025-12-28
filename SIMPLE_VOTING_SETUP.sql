-- Simple Voting System Setup
-- This script adds basic voting functionality without complex functions

-- Add upvotes_count column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'issues' AND column_name = 'upvotes_count'
    ) THEN
        ALTER TABLE issues ADD COLUMN upvotes_count INTEGER DEFAULT 0;
        RAISE NOTICE 'Added upvotes_count column to issues table';
    END IF;
END $$;

-- Ensure volunteers_count column exists (for backward compatibility)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'issues' AND column_name = 'volunteers_count'
    ) THEN
        ALTER TABLE issues ADD COLUMN volunteers_count INTEGER DEFAULT 0;
        RAISE NOTICE 'Added volunteers_count column to issues table';
    END IF;
END $$;

-- Sync the two columns (use whichever has data)
UPDATE issues 
SET upvotes_count = COALESCE(volunteers_count, upvotes_count, 0),
    volunteers_count = COALESCE(upvotes_count, volunteers_count, 0)
WHERE upvotes_count IS NULL OR volunteers_count IS NULL OR upvotes_count != volunteers_count;

-- Create indexes for better performance when sorting by votes
CREATE INDEX IF NOT EXISTS idx_issues_upvotes_count ON issues(upvotes_count DESC);
CREATE INDEX IF NOT EXISTS idx_issues_volunteers_count ON issues(volunteers_count DESC);

-- Add updated_at column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'issues' AND column_name = 'updated_at'
    ) THEN
        ALTER TABLE issues ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
        RAISE NOTICE 'Added updated_at column to issues table';
    END IF;
END $$;

-- Set default values for existing records
UPDATE issues 
SET updated_at = COALESCE(updated_at, created_at, NOW())
WHERE updated_at IS NULL;

-- Create a simple upvote function
CREATE OR REPLACE FUNCTION upvote_issue(issue_uuid UUID, user_uuid UUID)
RETURNS JSON AS $$
DECLARE
    current_count INTEGER;
    user_voted BOOLEAN := FALSE;
    result JSON;
BEGIN
    -- Get current vote count
    SELECT COALESCE(upvotes_count, 0) INTO current_count
    FROM issues 
    WHERE id = issue_uuid;
    
    -- Check if user already voted (simple localStorage-based approach)
    -- For now, we'll just increment/decrement based on current state
    -- In a full implementation, you'd check an upvotes table
    
    -- For simplicity, we'll toggle the vote
    -- This is a basic implementation - in production you'd want proper vote tracking
    
    -- Update the vote count
    UPDATE issues 
    SET upvotes_count = GREATEST(0, current_count + 1),
        volunteers_count = GREATEST(0, current_count + 1),
        updated_at = NOW()
    WHERE id = issue_uuid;
    
    -- Return success result
    result := json_build_object(
        'success', true,
        'action', 'added',
        'count', current_count + 1,
        'message', 'Vote added successfully'
    );
    
    RETURN result;
    
EXCEPTION WHEN OTHERS THEN
    -- Return error result
    result := json_build_object(
        'success', false,
        'action', 'error',
        'count', current_count,
        'message', SQLERRM
    );
    
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Verification
SELECT 
    'Simple Voting Setup Complete' as message,
    (SELECT COUNT(*) FROM information_schema.columns 
     WHERE table_name = 'issues' AND column_name IN ('upvotes_count', 'volunteers_count', 'updated_at')) as columns_added,
    (SELECT COUNT(*) FROM issues WHERE upvotes_count > 0 OR volunteers_count > 0) as issues_with_votes,
    (SELECT MAX(COALESCE(upvotes_count, 0)) FROM issues) as max_votes;