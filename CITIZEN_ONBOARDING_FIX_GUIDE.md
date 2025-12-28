# Citizen Onboarding Fix Guide

## Problem Description
Citizens are getting stuck in an onboarding loop where:
1. They complete the profile creation form
2. Profile shows as "completed" in the UI
3. But when trying to report issues, they're asked to create profile again
4. This creates an infinite loop

## Root Causes Identified

### 1. Database Schema Issues
- Missing or mismatched column names in `user_profiles` table
- `user_type` vs `role` column confusion
- Missing `is_onboarding_complete` column

### 2. Auth Context Not Refreshing
- After profile completion, `isNewUser` state doesn't update
- `refreshProfile()` function not being called properly
- Context state gets out of sync with database

### 3. Column Name Mismatches
- UserOnboarding component uses `role: 'resident'` but database expects `user_type: 'citizen'`
- Inconsistent column naming between components and database

## Complete Fix Applied

### 1. Database Schema Fix
**File:** `FIX_CITIZEN_ONBOARDING.sql`
- Ensures all required columns exist
- Fixes data type mismatches
- Migrates old `role` data to `user_type`
- Sets up proper RLS policies
- Provides verification queries

### 2. UserOnboarding Component Fix
**File:** `src/pages/UserOnboarding.tsx`
- Added `refreshProfile` from auth context
- Fixed column name: `user_type: 'citizen'` instead of `role: 'resident'`
- Added proper context refresh after profile completion
- Enhanced error handling with specific messages
- Added debugging logs

### 3. Auth Context Enhancement
**File:** `src/contexts/SupabaseAuthContext.tsx`
- Added detailed logging to `loadUserProfile` function
- Enhanced `refreshProfile` with better logging
- Improved error handling and debugging

### 4. Debug Component
**File:** `src/components/ProfileDebugger.tsx`
- Shows real-time profile status
- Displays all profile fields
- Manual refresh button for testing
- Raw JSON data view

## Step-by-Step Fix Instructions

### Step 1: Run Database Script
```sql
-- Execute this in your Supabase SQL editor
-- File: FIX_CITIZEN_ONBOARDING.sql
```
This will:
- Create missing columns
- Fix data inconsistencies
- Set up proper permissions
- Verify the setup

### Step 2: Test the Flow
1. **Create a new user account**
2. **Go through onboarding process**
3. **Check browser console** for debugging logs
4. **Verify profile completion** using ProfileDebugger component

### Step 3: Add Debug Component (Temporary)
Add to any page for testing:
```tsx
import ProfileDebugger from '@/components/ProfileDebugger';

// Add this to your component JSX
<ProfileDebugger />
```

### Step 4: Verify Fix
1. **Complete onboarding** → Should see "Profile complete, setting isNewUser = false"
2. **Try to report issue** → Should work without onboarding prompt
3. **Check ProfileDebugger** → Should show "Is New User: No"

## Common Issues and Solutions

### Issue 1: "Column does not exist" Error
**Solution:** Run `FIX_CITIZEN_ONBOARDING.sql` script

### Issue 2: Profile shows complete but still asks for onboarding
**Solution:** 
1. Check browser console for auth context logs
2. Use ProfileDebugger to see actual profile state
3. Manually refresh profile using the debug button

### Issue 3: Permission denied errors
**Solution:** 
1. Ensure RLS policies are set up correctly
2. Check that user is properly authenticated
3. Verify user ID matches between auth and profile

### Issue 4: Data not saving properly
**Solution:**
1. Check column names match between component and database
2. Verify data types are correct
3. Check for any validation errors

## Testing Checklist

### New User Flow
- [ ] Sign up with new email
- [ ] Complete onboarding form
- [ ] See success message
- [ ] Get redirected to dashboard
- [ ] Can report issues without onboarding prompt

### Existing User Flow
- [ ] Login with existing account
- [ ] Profile shows as complete
- [ ] Can access all features
- [ ] No onboarding prompts

### Debug Information
- [ ] Console shows proper auth context logs
- [ ] ProfileDebugger shows correct status
- [ ] Database has correct profile data
- [ ] `is_onboarding_complete = true`
- [ ] `user_type = 'citizen'`

## Verification Queries

### Check Profile Status
```sql
SELECT 
    id,
    email,
    full_name,
    user_type,
    is_onboarding_complete,
    age,
    address,
    city
FROM user_profiles 
WHERE email = 'your-test-email@example.com';
```

### Check Column Structure
```sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'user_profiles'
ORDER BY column_name;
```

## Rollback Plan
If issues persist:
1. **Backup current data**
2. **Check original schema** in `COMPLETE_DATABASE_SETUP.sql`
3. **Restore from backup** if needed
4. **Contact support** with specific error messages

## Success Indicators
- ✅ No onboarding loops
- ✅ Profile data saves correctly
- ✅ Auth context updates properly
- ✅ Citizens can report issues immediately after onboarding
- ✅ Console logs show proper state transitions

This comprehensive fix addresses all identified issues and provides tools for debugging any remaining problems.