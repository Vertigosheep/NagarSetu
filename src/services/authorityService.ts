import { supabase } from '@/lib/supabase'

export interface AuthorityStats {
  totalReports: number
  pendingIssues: number
  resolvedToday: number
  inProgress: number
  avgResponseTime: string
  satisfactionRate: number
}

export interface IssueWithPriority {
  id: string
  title: string
  description: string
  location: string
  category: string
  status: string
  created_at: string
  image?: string
  priority: 'low' | 'medium' | 'high' | 'critical'
  assigned_to?: string
  department?: string
}

// Get dashboard statistics with real-time data
export const getDashboardStats = async (): Promise<AuthorityStats> => {
  try {
    const { data: issues, error } = await supabase
      .from('issues')
      .select('*')

    if (error) throw error

    const total = issues?.length || 0
    const pending = issues?.filter(issue => issue.status === 'reported' || issue.status === 'assigned').length || 0
    const inProgress = issues?.filter(issue => issue.status === 'in_progress').length || 0
    const resolved = issues?.filter(issue => issue.status === 'resolved' || issue.status === 'closed').length || 0
    
    // Calculate resolved today using actual timestamps
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const todayISO = today.toISOString()
    
    const resolvedToday = issues?.filter(issue => {
      if (issue.status !== 'resolved' && issue.status !== 'closed') return false
      const issueDate = new Date(issue.updated_at || issue.created_at)
      return issueDate >= today
    }).length || 0

    // Calculate average response time from real data
    const resolvedIssues = issues?.filter(issue => issue.status === 'resolved' || issue.status === 'closed') || []
    let avgResponseHours = 0
    
    if (resolvedIssues.length > 0) {
      const totalResponseTime = resolvedIssues.reduce((sum, issue) => {
        const created = new Date(issue.created_at)
        const resolved = new Date(issue.updated_at || issue.created_at)
        const diffHours = (resolved.getTime() - created.getTime()) / (1000 * 60 * 60)
        return sum + diffHours
      }, 0)
      avgResponseHours = totalResponseTime / resolvedIssues.length
    }

    const avgResponseTime = avgResponseHours > 0 
      ? `${Math.round(avgResponseHours)}h` 
      : '0h'

    // Calculate satisfaction rate from actual feedback
    const issuesWithFeedback = issues?.filter(issue => issue.citizen_feedback) || []
    const satisfiedCount = issuesWithFeedback.filter(issue => issue.citizen_feedback === 'satisfied').length
    const satisfactionRate = issuesWithFeedback.length > 0 
      ? Math.round((satisfiedCount / issuesWithFeedback.length) * 100)
      : 0

    return {
      totalReports: total,
      pendingIssues: pending,
      resolvedToday,
      inProgress,
      avgResponseTime,
      satisfactionRate
    }
  } catch (error) {
    console.error('Error fetching dashboard stats:', error)
    throw error
  }
}

// Get issues with priority calculation
export const getIssuesWithPriority = async (): Promise<IssueWithPriority[]> => {
  try {
    const { data: issues, error } = await supabase
      .from('issues')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) throw error

    return (issues || []).map(issue => ({
      ...issue,
      priority: calculatePriority(issue.category, issue.created_at)
    }))
  } catch (error) {
    console.error('Error fetching issues:', error)
    throw error
  }
}

// Calculate priority based on category and age
const calculatePriority = (category: string, createdAt: string): 'low' | 'medium' | 'high' | 'critical' => {
  const priorityMap: { [key: string]: 'low' | 'medium' | 'high' | 'critical' } = {
    'Safety': 'critical',
    'Water': 'high',
    'Electricity': 'high',
    'Infrastructure': 'medium',
    'Transportation': 'medium',
    'Trash': 'low',
    'Noise': 'low',
    'Drainage': 'medium',
    'Public Space': 'low'
  }

  let basePriority = priorityMap[category] || 'medium'
  
  // Increase priority based on age
  const daysSinceCreated = Math.floor(
    (Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60 * 24)
  )

  if (daysSinceCreated > 7) {
    // Escalate priority for old issues
    const priorities: ('low' | 'medium' | 'high' | 'critical')[] = ['low', 'medium', 'high', 'critical']
    const currentIndex = priorities.indexOf(basePriority)
    if (currentIndex < priorities.length - 1) {
      basePriority = priorities[currentIndex + 1]
    }
  }

  return basePriority
}

// Update issue status
export const updateIssueStatus = async (issueId: string, status: string, assignedTo?: string) => {
  try {
    const updateData: any = { 
      status,
      updated_at: new Date().toISOString()
    }

    if (assignedTo) {
      updateData.assigned_to = assignedTo
    }

    const { error } = await supabase
      .from('issues')
      .update(updateData)
      .eq('id', issueId)

    if (error) {
      console.error('Supabase error details:', error)
      throw error
    }

    return { success: true }
  } catch (error) {
    console.error('Error updating issue status:', error)
    throw error
  }
}

// Assign issue to department/user
export const assignIssue = async (issueId: string, assignedTo: string, department?: string) => {
  try {
    const updateData: any = {
      assigned_to: assignedTo,
      status: 'assigned',
      updated_at: new Date().toISOString()
    }

    if (department) {
      updateData.department = department
    }

    const { error } = await supabase
      .from('issues')
      .update(updateData)
      .eq('id', issueId)

    if (error) throw error

    return { success: true }
  } catch (error) {
    console.error('Error assigning issue:', error)
    throw error
  }
}

// Get category breakdown for analytics
export const getCategoryBreakdown = async () => {
  try {
    const { data: issues, error } = await supabase
      .from('issues')
      .select('category')

    if (error) throw error

    const categoryCount: { [key: string]: number } = {}
    issues?.forEach(issue => {
      categoryCount[issue.category] = (categoryCount[issue.category] || 0) + 1
    })

    return Object.entries(categoryCount)
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count)
  } catch (error) {
    console.error('Error fetching category breakdown:', error)
    throw error
  }
}

// Auto-assign all unassigned issues to Pradhan
export const autoAssignToPradhan = async () => {
  try {
    // Get Pradhan's user ID
    const { data: pradhanUser, error: userError } = await supabase
      .from('user_profiles')
      .select('id')
      .eq('email', 'abhitest1290@gmail.com')
      .single()

    if (userError || !pradhanUser) {
      console.error('Pradhan user not found:', userError)
      return { success: false, message: 'Pradhan user not found' }
    }

    // Get all unassigned issues
    const { data: unassignedIssues, error: issuesError } = await supabase
      .from('issues')
      .select('id, title, category')
      .is('assigned_to', null)

    if (issuesError) throw issuesError

    if (!unassignedIssues || unassignedIssues.length === 0) {
      return { success: true, message: 'No unassigned issues found', count: 0 }
    }

    // Auto-assign all unassigned issues to Pradhan
    const { error: updateError } = await supabase
      .from('issues')
      .update({
        assigned_to: pradhanUser.id,
        status: 'assigned',
        updated_at: new Date().toISOString()
      })
      .in('id', unassignedIssues.map(issue => issue.id))

    if (updateError) throw updateError

    console.log(`Auto-assigned ${unassignedIssues.length} issues to Pradhan`)

    return { 
      success: true, 
      message: `Successfully assigned ${unassignedIssues.length} issues to Pradhan`,
      count: unassignedIssues.length
    }
  } catch (error) {
    console.error('Error auto-assigning to Pradhan:', error)
    return { success: false, message: 'Failed to auto-assign issues' }
  }
}

// Check if current user is an admin/authority
export const checkAdminPermissions = async () => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { isAdmin: false, message: 'User not authenticated' };
    }

    // Check admin permissions - try both user_type column and email-based approach
    const { data: profile, error } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (error) {
      console.error('Error checking admin permissions:', error);
      return { 
        isAdmin: false, 
        message: `Could not verify permissions: ${error.message}`,
        details: {
          userId: user.id,
          userEmail: user.email,
          error: error.message
        }
      };
    }

    // Check if user is admin - either by user_type column or by email
    const isAdminByType = profile?.user_type === 'authority';
    const isAdminByEmail = profile?.email === 'abhitest1290@gmail.com' || user.email === 'abhitest1290@gmail.com';
    const isAdmin = isAdminByType || isAdminByEmail;
    
    console.log('Admin permission check:', {
      userId: user.id,
      email: user.email,
      profileEmail: profile?.email,
      userType: profile?.user_type,
      fullName: profile?.full_name,
      isAdminByType,
      isAdminByEmail,
      isAdmin,
      profileCreated: profile?.created_at
    });

    let message = '';
    if (isAdmin) {
      if (isAdminByType) {
        message = `Admin permissions confirmed by user_type for ${profile.full_name || profile.email}`;
      } else {
        message = `Admin permissions confirmed by email for ${profile.full_name || profile.email}`;
      }
    } else {
      message = `User is not an admin (email: ${user.email}, type: ${profile?.user_type || 'unknown'})`;
    }

    return { 
      isAdmin, 
      message,
      profile,
      details: {
        userId: user.id,
        userEmail: user.email,
        profileEmail: profile?.email,
        userType: profile?.user_type,
        fullName: profile?.full_name,
        isAdmin,
        isAdminByType,
        isAdminByEmail
      }
    };
  } catch (error) {
    console.error('Error in admin permission check:', error);
    return { 
      isAdmin: false, 
      message: 'Permission check failed',
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

// Delete issue (Admin only)
export const deleteIssue = async (issueId: string, reason: string, deletedBy: string) => {
  try {
    // First, check if the user has authority permissions
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('User not authenticated');
    }

    // Check if user is an authority - try both approaches
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (profileError) {
      console.error('Error checking user profile:', profileError);
      throw new Error('Could not verify admin permissions - user profile not found');
    }

    // Check admin permissions - either by user_type or by email
    const isAdminByType = profile?.user_type === 'authority';
    const isAdminByEmail = profile?.email === 'abhitest1290@gmail.com' || user.email === 'abhitest1290@gmail.com';
    const isAdmin = isAdminByType || isAdminByEmail;

    if (!isAdmin) {
      throw new Error(`Access denied: User is not an admin (email: ${user.email}, type: ${profile?.user_type || 'unknown'})`);
    }

    // Log deletion attempt for audit trail
    console.log('Admin attempting to delete issue:', {
      issueId,
      reason,
      deletedBy,
      adminId: user.id,
      adminEmail: profile.email,
      userType: profile.user_type,
      isAdminByType,
      isAdminByEmail,
      timestamp: new Date().toISOString()
    });

    // First, try to fetch the issue to make sure it exists and get full data for audit
    const { data: existingIssue, error: fetchError } = await supabase
      .from('issues')
      .select('*')
      .eq('id', issueId)
      .single();

    if (fetchError) {
      console.error('Error fetching issue before deletion:', fetchError);
      throw new Error('Issue not found or could not be accessed');
    }

    console.log('Issue found, proceeding with deletion:', {
      id: existingIssue.id,
      title: existingIssue.title,
      status: existingIssue.status,
      created_by: existingIssue.created_by
    });

    // Create audit log entry before deletion (if audit table exists)
    try {
      const { error: auditError } = await supabase
        .from('issue_audit_log')
        .insert({
          issue_id: issueId,
          action: 'DELETE',
          performed_by: user.id,
          reason: reason,
          issue_data: existingIssue
        });

      if (auditError) {
        console.warn('Failed to create audit log (continuing with deletion):', auditError);
      } else {
        console.log('Audit log created successfully');
      }
    } catch (auditError) {
      console.warn('Audit logging failed (continuing with deletion):', auditError);
    }

    // Attempt to delete the issue
    const { error: deleteError, data: deleteData } = await supabase
      .from('issues')
      .delete()
      .eq('id', issueId)
      .select(); // This will return the deleted row if successful

    if (deleteError) {
      console.error('Delete operation failed:', deleteError);
      
      // Provide more specific error messages
      if (deleteError.code === 'PGRST116') {
        throw new Error('Delete failed: No matching rows found or insufficient permissions');
      } else if (deleteError.message.includes('policy')) {
        throw new Error('Delete failed: Row Level Security policy violation - admin permissions not properly configured');
      } else if (deleteError.message.includes('permission')) {
        throw new Error('Delete failed: Database permission denied - check admin user setup');
      } else {
        throw new Error(`Delete failed: ${deleteError.message}`);
      }
    }

    console.log('Delete operation result:', deleteData);

    if (!deleteData || deleteData.length === 0) {
      throw new Error('Delete operation did not affect any rows - issue may not exist or RLS policies are blocking deletion');
    }

    // Log successful deletion
    console.log('Issue successfully deleted:', {
      issueId,
      title: existingIssue.title,
      reason,
      deletedBy,
      adminId: user.id,
      adminEmail: profile.email,
      timestamp: new Date().toISOString()
    });

    return { 
      success: true, 
      message: 'Issue deleted successfully',
      deletedIssue: {
        id: existingIssue.id,
        title: existingIssue.title
      }
    };
  } catch (error) {
    console.error('Error deleting issue:', error);
    throw error;
  }
}

// Get performance metrics with real-time data
export const getPerformanceMetrics = async () => {
  try {
    const { data: issues, error } = await supabase
      .from('issues')
      .select('*')

    if (error) throw error

    const total = issues?.length || 0
    const resolved = issues?.filter(issue => issue.status === 'resolved' || issue.status === 'closed').length || 0
    const resolutionRate = total > 0 ? Math.round((resolved / total) * 100) : 0

    // Calculate average response time from real data
    const resolvedIssues = issues?.filter(issue => issue.status === 'resolved' || issue.status === 'closed') || []
    let avgResponseHours = 0
    
    if (resolvedIssues.length > 0) {
      const totalResponseTime = resolvedIssues.reduce((sum, issue) => {
        const created = new Date(issue.created_at)
        const resolved = new Date(issue.updated_at || issue.created_at)
        const diffHours = (resolved.getTime() - created.getTime()) / (1000 * 60 * 60)
        return sum + diffHours
      }, 0)
      avgResponseHours = totalResponseTime / resolvedIssues.length
    }

    const avgResponseTime = avgResponseHours > 0 
      ? `${Math.round(avgResponseHours)}h` 
      : '0h'

    // Calculate satisfaction rate from actual feedback
    const issuesWithFeedback = issues?.filter(issue => issue.citizen_feedback) || []
    const satisfiedCount = issuesWithFeedback.filter(issue => issue.citizen_feedback === 'satisfied').length
    const satisfactionRate = issuesWithFeedback.length > 0 
      ? Math.round((satisfiedCount / issuesWithFeedback.length) * 100)
      : 0

    return {
      resolutionRate,
      avgResponseTime,
      satisfactionRate,
      totalIssues: total,
      resolvedIssues: resolved
    }
  } catch (error) {
    console.error('Error fetching performance metrics:', error)
    throw error
  }
}