import { supabase } from '@/lib/supabase'

export interface IssueReport {
  id: string
  issue_id: string
  reported_by: string
  report_reason: string
  report_description?: string
  status: 'pending' | 'approved' | 'rejected'
  reviewed_by?: string
  review_notes?: string
  created_at: string
  reviewed_at?: string
  updated_at: string
}

export interface IssueReportWithDetails extends IssueReport {
  issue: {
    id: string
    title: string
    description: string
    location: string
    category: string
    status: string
    created_at: string
    image?: string
  }
  reporter: {
    full_name?: string
    email: string
  }
  reviewer?: {
    full_name?: string
    email: string
  }
}

export interface ReportReason {
  id: number
  reason: string
  description: string
  severity: 'low' | 'medium' | 'high'
}

// Get available report reasons
export const getReportReasons = async (): Promise<ReportReason[]> => {
  try {
    const { data, error } = await supabase
      .from('report_reasons')
      .select('*')
      .order('severity DESC, reason ASC')

    if (error) {
      console.warn('report_reasons table not found, using fallback reasons:', error)
      // Fallback to hardcoded reasons if table doesn't exist
      return [
        { id: 1, reason: 'Spam Report', description: 'Issue appears to be spam or automated posting', severity: 'high' },
        { id: 2, reason: 'Duplicate Issue', description: 'This issue is a duplicate of another existing issue', severity: 'medium' },
        { id: 3, reason: 'Fake/False Report', description: 'Issue appears to be fabricated or false', severity: 'high' },
        { id: 4, reason: 'Inappropriate Content', description: 'Issue contains inappropriate or offensive content', severity: 'high' },
        { id: 5, reason: 'Not a Real Issue', description: 'Reported problem does not actually exist', severity: 'medium' },
        { id: 6, reason: 'Wrong Location', description: 'Issue is reported for wrong or non-existent location', severity: 'low' },
        { id: 7, reason: 'Test Issue', description: 'Issue appears to be a test submission', severity: 'low' },
        { id: 8, reason: 'Resolved Elsewhere', description: 'Issue has already been resolved through other means', severity: 'low' }
      ]
    }
    
    return data || []
  } catch (error) {
    console.error('Error fetching report reasons:', error)
    // Return fallback reasons on any error
    return [
      { id: 1, reason: 'Spam Report', description: 'Issue appears to be spam or automated posting', severity: 'high' },
      { id: 2, reason: 'Duplicate Issue', description: 'This issue is a duplicate of another existing issue', severity: 'medium' },
      { id: 3, reason: 'Fake/False Report', description: 'Issue appears to be fabricated or false', severity: 'high' },
      { id: 4, reason: 'Inappropriate Content', description: 'Issue contains inappropriate or offensive content', severity: 'high' },
      { id: 5, reason: 'Not a Real Issue', description: 'Reported problem does not actually exist', severity: 'medium' },
      { id: 6, reason: 'Wrong Location', description: 'Issue is reported for wrong or non-existent location', severity: 'low' },
      { id: 7, reason: 'Test Issue', description: 'Issue appears to be a test submission', severity: 'low' },
      { id: 8, reason: 'Resolved Elsewhere', description: 'Issue has already been resolved through other means', severity: 'low' }
    ]
  }
}

// Report an issue (Pradhan only)
export const reportIssue = async (
  issueId: string, 
  reason: string, 
  description?: string
): Promise<{ success: boolean; message: string; reportId?: string }> => {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      throw new Error('User not authenticated')
    }

    console.log('Attempting to report issue:', {
      issueId,
      reason,
      userId: user.id,
      userEmail: user.email
    })

    // Check if user is Pradhan
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('email')
      .eq('id', user.id)
      .single()

    const isPradhan = profile?.email === 'abhitest1290@gmail.com' || user.email === 'abhitest1290@gmail.com'
    
    console.log('Pradhan check:', {
      profileEmail: profile?.email,
      authEmail: user.email,
      isPradhan
    })
    
    if (!isPradhan) {
      throw new Error('Only Pradhan can report issues')
    }

    // Check if issue is already reported by this user
    const { data: existingReport, error: checkError } = await supabase
      .from('issue_reports')
      .select('id, status')
      .eq('issue_id', issueId)
      .eq('reported_by', user.id)
      .eq('status', 'pending')
      .single()

    if (checkError && checkError.code !== 'PGRST116') {
      console.error('Error checking existing reports:', checkError)
      throw new Error(`Database error: ${checkError.message}`)
    }

    if (existingReport) {
      return {
        success: false,
        message: 'You have already reported this issue and it is pending review'
      }
    }

    // Create the report
    console.log('Creating report with data:', {
      issue_id: issueId,
      reported_by: user.id,
      report_reason: reason,
      report_description: description,
      status: 'pending'
    })

    const { data: report, error } = await supabase
      .from('issue_reports')
      .insert({
        issue_id: issueId,
        reported_by: user.id,
        report_reason: reason,
        report_description: description,
        status: 'pending'
      })
      .select('id')
      .single()

    if (error) {
      console.error('Error creating report:', error)
      
      // Provide specific error messages
      if (error.code === '42501') {
        throw new Error('Permission denied: Please ensure you are logged in as Pradhan and the database is properly set up')
      } else if (error.code === '23503') {
        throw new Error('Invalid issue ID or user ID')
      } else if (error.message.includes('policy')) {
        throw new Error('Database permission error: RLS policies may not be configured correctly')
      } else {
        throw new Error(`Database error: ${error.message}`)
      }
    }

    // Also mark the issue as reported
    try {
      await supabase
        .from('issues')
        .update({
          is_reported: true,
          report_count: 1,
          updated_at: new Date().toISOString()
        })
        .eq('id', issueId)
    } catch (updateError) {
      console.warn('Could not update issue reported status:', updateError)
    }

    console.log('Issue reported successfully:', {
      reportId: report.id,
      issueId,
      reason,
      reportedBy: user.email
    })

    return {
      success: true,
      message: 'Issue reported successfully. Admin will review it shortly.',
      reportId: report.id
    }
  } catch (error: any) {
    console.error('Error reporting issue:', error)
    throw error
  }
}

// Get all pending reports for admin review
export const getPendingReports = async (): Promise<IssueReportWithDetails[]> => {
  try {
    const { data, error } = await supabase
      .from('issue_reports')
      .select(`
        *,
        issue:issues(*),
        reporter:user_profiles!issue_reports_reported_by_fkey(full_name, email)
      `)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })

    if (error) {
      console.warn('issue_reports table not found or error:', error)
      return [] // Return empty array if table doesn't exist
    }

    return (data || []).map(report => ({
      ...report,
      issue: report.issue,
      reporter: report.reporter
    })) as IssueReportWithDetails[]
  } catch (error) {
    console.error('Error fetching pending reports:', error)
    return [] // Return empty array on error
  }
}

// Get all reports (for admin dashboard)
export const getAllReports = async (): Promise<IssueReportWithDetails[]> => {
  try {
    const { data, error } = await supabase
      .from('issue_reports')
      .select(`
        *,
        issue:issues(*),
        reporter:user_profiles!issue_reports_reported_by_fkey(full_name, email),
        reviewer:user_profiles!issue_reports_reviewed_by_fkey(full_name, email)
      `)
      .order('created_at', { ascending: false })

    if (error) {
      console.warn('issue_reports table not found or error:', error)
      return [] // Return empty array if table doesn't exist
    }

    return (data || []).map(report => ({
      ...report,
      issue: report.issue,
      reporter: report.reporter,
      reviewer: report.reviewer
    })) as IssueReportWithDetails[]
  } catch (error) {
    console.error('Error fetching all reports:', error)
    return [] // Return empty array on error
  }
}

// Get reports by Pradhan (for Pradhan dashboard)
export const getMyReports = async (): Promise<IssueReportWithDetails[]> => {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('User not authenticated')

    const { data, error } = await supabase
      .from('issue_reports')
      .select(`
        *,
        issue:issues(*),
        reviewer:user_profiles!issue_reports_reviewed_by_fkey(full_name, email)
      `)
      .eq('reported_by', user.id)
      .order('created_at', { ascending: false })

    if (error) {
      console.warn('issue_reports table not found or error:', error)
      return [] // Return empty array if table doesn't exist
    }

    return (data || []).map(report => ({
      ...report,
      issue: report.issue,
      reporter: { email: user.email || '', full_name: '' },
      reviewer: report.reviewer
    })) as IssueReportWithDetails[]
  } catch (error) {
    console.error('Error fetching my reports:', error)
    return [] // Return empty array on error
  }
}

// Admin approve report and delete issue
export const approveReportAndDeleteIssue = async (
  reportId: string, 
  reviewNotes?: string
): Promise<{ success: boolean; message: string }> => {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('User not authenticated')

    // Check admin permissions
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('email')
      .eq('id', user.id)
      .single()

    const isAdmin = profile?.email === 'abhitest1290@gmail.com' || user.email === 'abhitest1290@gmail.com'
    
    if (!isAdmin) {
      throw new Error('Only admin can approve reports')
    }

    // Get the report details
    const { data: report, error: reportError } = await supabase
      .from('issue_reports')
      .select('*, issue:issues(*)')
      .eq('id', reportId)
      .single()

    if (reportError || !report) {
      throw new Error('Report not found')
    }

    if (report.status !== 'pending') {
      throw new Error('Report has already been reviewed')
    }

    // Start transaction-like operations
    // 1. Update report status to approved
    const { error: updateError } = await supabase
      .from('issue_reports')
      .update({
        status: 'approved',
        reviewed_by: user.id,
        review_notes: reviewNotes,
        reviewed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', reportId)

    if (updateError) throw updateError

    // 2. Delete the issue
    const { error: deleteError } = await supabase
      .from('issues')
      .delete()
      .eq('id', report.issue_id)

    if (deleteError) {
      // If deletion fails, revert the report status
      await supabase
        .from('issue_reports')
        .update({
          status: 'pending',
          reviewed_by: null,
          review_notes: null,
          reviewed_at: null
        })
        .eq('id', reportId)
      
      throw new Error(`Failed to delete issue: ${deleteError.message}`)
    }

    console.log('Report approved and issue deleted:', {
      reportId,
      issueId: report.issue_id,
      issueTitle: report.issue?.title,
      reason: report.report_reason,
      reviewedBy: user.email
    })

    return {
      success: true,
      message: `Issue "${report.issue?.title}" has been deleted successfully`
    }
  } catch (error) {
    console.error('Error approving report:', error)
    throw error
  }
}

// Admin reject report
export const rejectReport = async (
  reportId: string, 
  reviewNotes?: string
): Promise<{ success: boolean; message: string }> => {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('User not authenticated')

    // Check admin permissions
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('email')
      .eq('id', user.id)
      .single()

    const isAdmin = profile?.email === 'abhitest1290@gmail.com' || user.email === 'abhitest1290@gmail.com'
    
    if (!isAdmin) {
      throw new Error('Only admin can reject reports')
    }

    // Update report status to rejected
    const { error } = await supabase
      .from('issue_reports')
      .update({
        status: 'rejected',
        reviewed_by: user.id,
        review_notes: reviewNotes,
        reviewed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', reportId)
      .eq('status', 'pending') // Only update if still pending

    if (error) throw error

    return {
      success: true,
      message: 'Report has been rejected'
    }
  } catch (error) {
    console.error('Error rejecting report:', error)
    throw error
  }
}

// Get report statistics
export const getReportStatistics = async () => {
  try {
    const { data: reports, error } = await supabase
      .from('issue_reports')
      .select('status, report_reason, created_at')

    if (error) throw error

    const stats = {
      total: reports?.length || 0,
      pending: reports?.filter(r => r.status === 'pending').length || 0,
      approved: reports?.filter(r => r.status === 'approved').length || 0,
      rejected: reports?.filter(r => r.status === 'rejected').length || 0,
      byReason: {} as Record<string, number>,
      thisMonth: 0
    }

    // Count by reason
    reports?.forEach(report => {
      stats.byReason[report.report_reason] = (stats.byReason[report.report_reason] || 0) + 1
    })

    // Count this month
    const thisMonth = new Date()
    thisMonth.setDate(1)
    thisMonth.setHours(0, 0, 0, 0)
    
    stats.thisMonth = reports?.filter(r => 
      new Date(r.created_at) >= thisMonth
    ).length || 0

    return stats
  } catch (error) {
    console.error('Error fetching report statistics:', error)
    throw error
  }
}