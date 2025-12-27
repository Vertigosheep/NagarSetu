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

// Get dashboard statistics
export const getDashboardStats = async (): Promise<AuthorityStats> => {
  try {
    const { data: issues, error } = await supabase
      .from('issues')
      .select('*')

    if (error) throw error

    const total = issues?.length || 0
    const pending = issues?.filter(issue => issue.status === 'reported').length || 0
    const inProgress = issues?.filter(issue => issue.status === 'in-progress').length || 0
    const resolved = issues?.filter(issue => issue.status === 'resolved').length || 0
    
    // Calculate resolved today (using created_at as approximation since updated_at doesn't exist)
    const today = new Date().toISOString().split('T')[0]
    const resolvedToday = issues?.filter(issue => 
      issue.status === 'resolved' && 
      issue.created_at?.startsWith(today)
    ).length || Math.floor(resolved * 0.1) // Mock data

    return {
      totalReports: total,
      pendingIssues: pending,
      resolvedToday,
      inProgress,
      avgResponseTime: '2.4h', // Mock data - calculate from actual response times
      satisfactionRate: 87 // Mock data - from user feedback
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
      status
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
      status: 'in-progress'
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

// Get performance metrics
export const getPerformanceMetrics = async () => {
  try {
    const { data: issues, error } = await supabase
      .from('issues')
      .select('*')

    if (error) throw error

    const total = issues?.length || 0
    const resolved = issues?.filter(issue => issue.status === 'resolved').length || 0
    const resolutionRate = total > 0 ? Math.round((resolved / total) * 100) : 0

    // Mock calculations for demo - in real app, calculate from actual data
    const avgResponseTime = '2.4h'
    const satisfactionRate = 87

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