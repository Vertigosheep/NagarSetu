# Issue Reporting System - Implementation Guide

## Overview
This system allows Pradhan to report suspicious issues (spam, fake, duplicate) to admin for review and deletion approval. It creates a workflow where Pradhan can flag problematic issues, and admin can review and approve/reject the reports.

## Database Setup

### 1. Run the Database Scripts
Execute these SQL scripts in your Supabase SQL editor in order:

1. **`ADD_ISSUE_REPORTING_SYSTEM.sql`** - Creates the reporting system tables and policies
2. **`FIX_ADMIN_DELETE_PERMISSIONS_SIMPLE.sql`** - Sets up admin deletion permissions (use this if you don't have user_type column)

### 2. Verify Setup
Run **`CHECK_DATABASE_SCHEMA.sql`** to verify your table structure and then run the appropriate permissions script.

## Features Implemented

### For Pradhan (Worker Dashboard)
- **Report Button**: Each issue card now has a "Report" button for Pradhan
- **Report Modal**: Comprehensive modal with predefined reasons and custom descriptions
- **My Reports Section**: Toggle view to see all reports submitted by Pradhan
- **Report Status Tracking**: See pending, approved, or rejected status of reports

### For Admin (Authority Dashboard)
- **Reported Issues Tab**: New tab showing all reported issues
- **Review Interface**: Detailed review modal for each report
- **Approve/Reject Actions**: Admin can approve (deletes issue) or reject reports
- **Statistics Dashboard**: Overview of report statistics
- **Audit Trail**: All actions are logged for transparency

## How It Works

### 1. Pradhan Reports an Issue
1. Pradhan sees a suspicious issue in their dashboard
2. Clicks "Report" button on the issue card
3. Selects reason from predefined list:
   - Spam Report
   - Duplicate Issue
   - Fake/False Report
   - Inappropriate Content
   - Not a Real Issue
   - Wrong Location
   - Test Issue
   - Resolved Elsewhere
4. Optionally adds additional description
5. Submits report to admin

### 2. Admin Reviews Report
1. Admin sees new report in "Reported Issues" tab
2. Reviews issue details and report reason
3. Can approve (permanently deletes issue) or reject report
4. Adds review notes explaining decision
5. System logs all actions for audit trail

### 3. Automatic Updates
- Issues marked as reported show "🚩 REPORTED" badge
- Report counts are tracked
- Real-time updates via Supabase subscriptions
- Email notifications can be added later

## Database Tables Created

### `issue_reports`
- Tracks all reports submitted by Pradhan
- Links to original issue and tracks review status
- Stores reason, description, and admin review

### `report_reasons`
- Predefined list of common report reasons
- Includes severity levels for prioritization

### `issue_audit_log` (optional)
- Tracks all deletion actions for transparency
- Stores full issue data before deletion

## Security Features

### Row Level Security (RLS)
- Pradhan can only create and view their own reports
- Admin can view and manage all reports
- Regular users cannot access reporting system

### Permission Checks
- Email-based admin verification (`abhitest1290@gmail.com`)
- Fallback to user_type column if available
- Multiple validation layers for deletion

## Usage Instructions

### For Pradhan
1. Login to worker dashboard
2. Look for suspicious issues in your assigned tasks
3. Click "Report" button on problematic issues
4. Fill out report form with reason and details
5. Check "My Reports" to track status

### For Admin
1. Login to authority dashboard
2. Go to "Reported Issues" tab
3. Review pending reports
4. Click "Review" on any report
5. Approve (deletes issue) or reject with notes

## Testing the System

### 1. Create Test Issues
- Login as a citizen and create some test issues
- Make some obviously fake or spam issues for testing

### 2. Test Pradhan Reporting
- Login as Pradhan (`abhitest1290@gmail.com`)
- Report some test issues with different reasons
- Check "My Reports" section

### 3. Test Admin Review
- Login as admin (same email as Pradhan in this setup)
- Go to "Reported Issues" tab
- Review and approve/reject reports
- Verify issues are deleted when approved

## Error Handling

### Common Issues and Solutions

1. **"Column user_type does not exist"**
   - Use `FIX_ADMIN_DELETE_PERMISSIONS_SIMPLE.sql` instead
   - This version uses email-based permissions

2. **"Permission denied for deletion"**
   - Run the admin permissions script
   - Verify admin user exists in database
   - Check RLS policies are created

3. **"Report submission failed"**
   - Verify Pradhan user exists in user_profiles
   - Check RLS policies allow report creation
   - Ensure issue_reports table exists

## Future Enhancements

### Possible Additions
- Email notifications for new reports
- Bulk report actions for admin
- Report analytics and trends
- Citizen reporting (with moderation)
- Integration with external moderation tools
- Automated spam detection

### Performance Optimizations
- Pagination for large report lists
- Caching for report statistics
- Background processing for bulk actions

## Troubleshooting

### Debug Steps
1. Check browser console for JavaScript errors
2. Verify database tables exist using schema check script
3. Test admin permissions using "Test Admin Access" button
4. Check Supabase logs for database errors
5. Verify RLS policies are active

### Support
- Check the SQL scripts for proper table creation
- Verify user permissions in Supabase dashboard
- Test with simple cases first before complex scenarios

This system provides a complete workflow for managing problematic issues while maintaining transparency and audit trails.