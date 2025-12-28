-- Fix Onboarding Columns for Official Portal
-- This script ensures all necessary columns exist for the onboarding flow

-- Add missing columns to user_profiles table
DO $$ 
BEGIN
    -- Add is_onboarding_complete column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'user_profiles' AND column_name = 'is_onboarding_complete'
    ) THEN
        ALTER TABLE user_profiles ADD COLUMN is_onboarding_complete BOOLEAN DEFAULT FALSE;
        RAISE NOTICE 'Added is_onboarding_complete column to user_profiles table';
    END IF;
    
    -- Add department column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'user_profiles' AND column_name = 'department'
    ) THEN
        ALTER TABLE user_profiles ADD COLUMN department VARCHAR(100);
        RAISE NOTICE 'Added department column to user_profiles table';
    END IF;
    
    -- Add employee_id column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'user_profiles' AND column_name = 'employee_id'
    ) THEN
        ALTER TABLE user_profiles ADD COLUMN employee_id VARCHAR(50);
        RAISE NOTICE 'Added employee_id column to user_profiles table';
    END IF;
    
    -- Add phone column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'user_profiles' AND column_name = 'phone'
    ) THEN
        ALTER TABLE user_profiles ADD COLUMN phone VARCHAR(20);
        RAISE NOTICE 'Added phone column to user_profiles table';
    END IF;
    
    -- Add address column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'user_profiles' AND column_name = 'address'
    ) THEN
        ALTER TABLE user_profiles ADD COLUMN address TEXT;
        RAISE NOTICE 'Added address column to user_profiles table';
    END IF;
    
    -- Add user_type column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'user_profiles' AND column_name = 'user_type'
    ) THEN
        ALTER TABLE user_profiles ADD COLUMN user_type VARCHAR(20) DEFAULT 'citizen';
        RAISE NOTICE 'Added user_type column to user_profiles table';
    END IF;
END $$;

-- Update existing Pradhan user to have completed onboarding
UPDATE user_profiles 
SET is_onboarding_complete = true,
    user_type = 'official',
    department = 'Village Administration',
    employee_id = 'PRADHAN001',
    updated_at = NOW()
WHERE email = 'abhitest1290@gmail.com';

-- Verification query
SELECT 
    'Column Check Complete' as message,
    (SELECT COUNT(*) FROM information_schema.columns 
     WHERE table_name = 'user_profiles' 
     AND column_name IN ('is_onboarding_complete', 'department', 'employee_id', 'phone', 'address', 'user_type')
    ) as columns_added,
    (SELECT COUNT(*) FROM user_profiles WHERE email = 'abhitest1290@gmail.com') as pradhan_users;