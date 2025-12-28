-- Setup Voting System for Issues
-- This script ensures proper upvoting functionality with real-time updates

-- Ensure upvotes_count column exists (alternative to volunteers_count)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'issues' AND column_name = 'upvotes_count'
    ) THEN
        ALTER TABLE issues ADD COLUMN upvotes_count INTEGER DEFAULT 0;
        RAISE NOTICE 'Added upvotes_count column to issues table';
        
        -- Copy existing volunteers_count to upvotes_count if volunteers_count exists
        IF EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'issues' AND column_name = 'volunteers_count'
        ) THEN
            UPDATE issues SET upvotes_count = COALESCE(volunteers_count, 0);
            RAISE NOTICE 'Copied volunteers_count data to upvotes_count';
        END IF;
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
        
        -- Copy existing upvotes_count to volunteers_count if upvotes_count exists
        UPDATE issues SET volunteers_count = COALESCE(upvotes_count, 0);
        RAISE NOTICE 'Copied upvotes_count data to volunteers_count';
    END IF;
END $$;

-- Create issue_upvotes table to track individual user votes
CREATE TABLE IF NOT EXISTS issue_upvotes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    issue_id UUID NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(issue_id, user_id) -- Prevent duplicate votes from same user
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_issue_upvotes_issue_id ON issue_upvotes(issue_id);
CREATE INDEX IF NOT EXISTS idx_issue_upvotes_user_id ON issue_upvotes(user_id);
CREATE INDEX IF NOT EXISTS idx_issues_upvotes_count ON issues(upvotes_count DESC);
CREATE INDEX IF NOT EXISTS idx_issues_volunteers_count ON issues(volunteers_count DESC);

-- Enable RLS on issue_upvotes
ALTER TABLE issue_upvotes ENABLE ROW LEVEL SECURITY;

-- RLS policies for issue_upvotes
CREATE POLICY "Users can view all upvotes" ON issue_upvotes
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Users can insert their own upvotes" ON issue_upvotes
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own upvotes" ON issue_upvotes
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Function to update upvote counts
CREATE OR REPLACE FUNCTION update_issue_upvote_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        -- Increment upvote count
        UPDATE issues 
        SET upvotes_count = COALESCE(upvotes_count, 0) + 1,
            volunteers_count = COALESCE(volunteers_count, 0) + 1,
            updated_at = NOW()
        WHERE id = NEW.issue_id;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        -- Decrement upvote count
        UPDATE issues 
        SET upvotes_count = GREATEST(COALESCE(upvotes_count, 0) - 1, 0),
            volunteers_count = GREATEST(COALESCE(volunteers_count, 0) - 1, 0),
            updated_at = NOW()
        WHERE id = OLD.issue_id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for automatic upvote count updates
DROP TRIGGER IF EXISTS trigger_update_issue_upvote_count ON issue_upvotes;
CREATE TRIGGER trigger_update_issue_upvote_count
    AFTER INSERT OR DELETE ON issue_upvotes
    FOR EACH ROW
    EXECUTE FUNCTION update_issue_upvote_count();

-- Function for upvoting (prevents duplicate votes)
CREATE OR REPLACE FUNCTION upvote_issue(issue_uuid UUID, user_uuid UUID)
RETURNS JSON AS $$
DECLARE
    existing_vote UUID;
    current_count INTEGER;
    result JSON;
BEGIN
    -- Check if user already voted
    SELECT id INTO existing_vote
    FROM issue_upvotes
    WHERE issue_id = issue_uuid AND user_id = user_uuid;
    
    IF existing_vote IS NOT NULL THEN
        -- Remove existing vote
        DELETE FROM issue_upvotes WHERE id = existing_vote;
        
        -- Get updated count
        SELECT COALESCE(upvotes_count, 0) INTO current_count
        FROM issues WHERE id = issue_uuid;
        
        result := json_build_object(
            'success', true,
            'action', 'removed',
            'count', current_count,
            'message', 'Vote removed successfully'
        );
    ELSE
        -- Add new vote
        INSERT INTO issue_upvotes (issue_id, user_id) VALUES (issue_uuid, user_uuid);
        
        -- Get updated count
        SELECT COALESCE(upvotes_count, 0) INTO current_count
        FROM issues WHERE id = issue_uuid;
        
        result := json_build_object(
            'success', true,
            'action', 'added',
            'count', current_count,
            'message', 'Vote added successfully'
        );
    END IF;
    
    RETURN result;
EXCEPTION
    WHEN OTHERS THEN
        RETURN json_build_object(
            'success', false,
            'error', SQLERRM,
            'message', 'Failed to process vote'
        );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT ALL ON issue_upvotes TO authenticated;
GRANT EXECUTE ON FUNCTION upvote_issue(UUID, UUID) TO authenticated;

-- Sync existing data (ensure both columns have same values)
UPDATE issues 
SET upvotes_count = COALESCE(volunteers_count, 0),
    volunteers_count = COALESCE(upvotes_count, volunteers_count, 0)
WHERE upvotes_count != volunteers_count OR upvotes_count IS NULL OR volunteers_count IS NULL;

-- Create view for issues with vote information
CREATE OR REPLACE VIEW issues_with_votes AS
SELECT 
    i.*,
    COALESCE(i.upvotes_count, i.volunteers_count, 0) as total_votes,
    (
        SELECT COUNT(*) 
        FROM issue_upvotes uv 
        WHERE uv.issue_id = i.id
    ) as actual_vote_count
FROM issues i;

-- Grant access to the view
GRANT SELECT ON issues_with_votes TO authenticated;

-- Verification queries
SELECT 
    'Voting System Setup' as test_name,
    (SELECT COUNT(*) FROM information_schema.columns 
     WHERE table_name = 'issues' AND column_name IN ('upvotes_count', 'volunteers_count')) as vote_columns,
    (SELECT COUNT(*) FROM information_schema.tables WHERE table_name = 'issue_upvotes') as upvote_table,
    (SELECT COUNT(*) FROM issue_upvotes) as total_votes,
    (SELECT COUNT(*) FROM issues WHERE upvotes_count > 0 OR volunteers_count > 0) as issues_with_votes;

-- Sample data for testing (optional)
/*
-- Add some sample votes for testing
INSERT INTO issue_upvotes (issue_id, user_id)
SELECT 
    i.id,
    (SELECT id FROM auth.users LIMIT 1)
FROM issues i
LIMIT 3
ON CONFLICT (issue_id, user_id) DO NOTHING;
*/

-- Final verification
SELECT 
    '=== VOTING SYSTEM SETUP COMPLETE ===' as summary,
    (SELECT COUNT(*) FROM issues) as total_issues,
    (SELECT COUNT(*) FROM issue_upvotes) as total_votes,
    (SELECT AVG(COALESCE(upvotes_count, 0)) FROM issues) as avg_votes_per_issue,
    (SELECT MAX(COALESCE(upvotes_count, 0)) FROM issues) as max_votes_on_issue;