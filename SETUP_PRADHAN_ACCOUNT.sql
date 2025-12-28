-- Setup Pradhan Account for Village Management
-- Run this script to ensure the Pradhan account is properly configured

-- Update or insert Pradhan profile
INSERT INTO user_profiles (
  id,
  email,
  full_name,
  user_type,
  department,
  employee_id,
  created_at,
  updated_at,
  is_onboarding_complete
) VALUES (
  -- You'll need to replace this with the actual UUID from auth.users table
  -- Get it by running: SELECT id FROM auth.users WHERE email = 'abhitest1290@gmail.com';
  (SELECT id FROM auth.users WHERE email = 'abhitest1290@gmail.com'),
  'abhitest1290@gmail.com',
  'Pradhan Ji',
  'official',
  'Village Administration',
  'PRADHAN001',
  NOW(),
  NOW(),
  true
) ON CONFLICT (id) DO UPDATE SET
  full_name = 'Pradhan Ji',
  user_type = 'official',
  department = 'Village Administration',
  employee_id = 'PRADHAN001',
  updated_at = NOW(),
  is_onboarding_complete = true;

-- Auto-assign ALL unassigned issues to Pradhan (Village Head handles all departments)
UPDATE issues 
SET 
  assigned_to = (SELECT id FROM auth.users WHERE email = 'abhitest1290@gmail.com'),
  status = CASE 
    WHEN status = 'reported' THEN 'assigned'
    ELSE status
  END,
  updated_at = NOW()
WHERE assigned_to IS NULL;

-- Verify the setup
SELECT 
  'Pradhan Profile' as check_type,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE email = 'abhitest1290@gmail.com' 
      AND user_type = 'official'
    ) THEN '✅ EXISTS' 
    ELSE '❌ MISSING' 
  END as status;

SELECT 
  'Total Issues Assigned to Pradhan' as check_type,
  COUNT(*) as count
FROM issues 
WHERE assigned_to = (SELECT id FROM auth.users WHERE email = 'abhitest1290@gmail.com');

-- Show Pradhan's task breakdown by status
SELECT 
  status,
  COUNT(*) as count
FROM issues 
WHERE assigned_to = (SELECT id FROM auth.users WHERE email = 'abhitest1290@gmail.com')
GROUP BY status
ORDER BY status;

-- Show Pradhan's task breakdown by department/category
SELECT 
  COALESCE(category, department, 'General') as department,
  COUNT(*) as count
FROM issues 
WHERE assigned_to = (SELECT id FROM auth.users WHERE email = 'abhitest1290@gmail.com')
GROUP BY COALESCE(category, department, 'General')
ORDER BY count DESC;

-- Show recent issues assigned to Pradhan
SELECT 
  id,
  title,
  COALESCE(category, department, 'General') as department,
  status,
  created_at
FROM issues 
WHERE assigned_to = (SELECT id FROM auth.users WHERE email = 'abhitest1290@gmail.com')
ORDER BY created_at DESC
LIMIT 10;