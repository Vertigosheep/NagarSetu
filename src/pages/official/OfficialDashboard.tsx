import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ClipboardList, 
  Clock, 
  CheckCircle, 
  AlertTriangle,
  User,
  LogOut,
  Filter,
  ArrowUpDown,
  Flag,
  Eye
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { OfficialDashboardStats, OfficialTaskCard, User as UserType } from '@/types';
import ReportIssueModal from '@/components/ReportIssueModal';
import { getMyReports } from '@/services/issueReportingService';
import { toast } from '@/hooks/use-toast';

const OfficialDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<UserType | null>(null);
  const [stats, setStats] = useState<OfficialDashboardStats>({
    new_assigned: 0,
    in_progress: 0,
    pending_approval: 0,
    critical_count: 0,
    total_assigned: 0
  });
  const [tasks, setTasks] = useState<OfficialTaskCard[]>([]);
  const [filteredTasks, setFilteredTasks] = useState<OfficialTaskCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'priority'>('newest');
  
  // Report functionality state
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [selectedIssueForReport, setSelectedIssueForReport] = useState<OfficialTaskCard | null>(null);
  const [myReports, setMyReports] = useState<any[]>([]);
  const [showReports, setShowReports] = useState(false);

  useEffect(() => {
    fetchUserAndData();
    setupRealtimeSubscription();
    
    // Fetch reports if user is Pradhan
    if (user?.email === 'abhitest1290@gmail.com') {
      fetchMyReports();
    }
    
    // Set up interval to check for new unassigned issues (for Pradhan)
    const checkForNewIssues = async () => {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (authUser?.email === 'abhitest1290@gmail.com') {
        const { data: unassignedIssues } = await supabase
          .from('issues')
          .select('id, title, category')
          .is('assigned_to', null);
          
        if (unassignedIssues && unassignedIssues.length > 0) {
          console.log(`Found ${unassignedIssues.length} new unassigned issues, auto-assigning to Pradhan`);
          
          await supabase
            .from('issues')
            .update({ 
              assigned_to: authUser.id,
              status: 'assigned',
              updated_at: new Date().toISOString()
            })
            .in('id', unassignedIssues.map(issue => issue.id));
            
          // Refresh data after assignment
          fetchUserAndData();
        }
      }
    };
    
    // Check every 30 seconds for new issues (only for Pradhan)
    const interval = setInterval(checkForNewIssues, 30000);
    
    return () => {
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    applyFiltersAndSort();
  }, [tasks, filterStatus, sortBy]);

  const fetchUserAndData = async () => {
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      
      if (!authUser) {
        navigate('/official/login');
        return;
      }

      // Fetch user profile
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', authUser.id)
        .single();

      setUser(profile);

      // PRADHAN MODE: Check if this is the Pradhan account
      const isPradhan = authUser.email === 'abhitest1290@gmail.com';
      
      if (isPradhan) {
        // For Pradhan: Show all issues and assign them automatically (Pradhan handles all departments)
        const { data: allIssues } = await supabase
          .from('issues')
          .select('*')
          .order('created_at', { ascending: false });

        if (allIssues) {
          // Auto-assign ALL unassigned issues to Pradhan (regardless of department/category)
          const unassignedIssues = allIssues.filter(issue => !issue.assigned_to);
          
          if (unassignedIssues.length > 0) {
            console.log(`Auto-assigning ${unassignedIssues.length} issues to Pradhan (all departments)`);
            
            // Batch update unassigned issues
            const { error: assignError } = await supabase
              .from('issues')
              .update({ 
                assigned_to: authUser.id,
                status: 'assigned',
                updated_at: new Date().toISOString()
              })
              .in('id', unassignedIssues.map(issue => issue.id));

            if (assignError) {
              console.error('Error auto-assigning issues to Pradhan:', assignError);
            } else {
              console.log(`✅ Successfully auto-assigned ${unassignedIssues.length} issues to Pradhan`);
            }
          }

          // Fetch updated assigned tasks (all issues assigned to Pradhan)
          const { data: assignedTasks } = await supabase
            .from('issues')
            .select('*')
            .eq('assigned_to', authUser.id)
            .order('created_at', { ascending: false });

          if (assignedTasks) {
            setTasks(assignedTasks);
            
            // Calculate real-time stats from all assigned tasks
            const realTimeStats = {
              new_assigned: assignedTasks.filter(t => t.status === 'assigned' || t.status === 'reported').length,
              in_progress: assignedTasks.filter(t => t.status === 'in_progress').length,
              pending_approval: assignedTasks.filter(t => t.status === 'resolved' || t.status === 'pending_approval').length,
              critical_count: assignedTasks.filter(t => t.urgency === 'critical').length,
              total_assigned: assignedTasks.length
            };
            setStats(realTimeStats);
            
            // Debug logging with department breakdown
            const departmentBreakdown = assignedTasks.reduce((acc, task) => {
              const dept = task.category || task.department || 'General';
              acc[dept] = (acc[dept] || 0) + 1;
              return acc;
            }, {});
            
            console.log('Pradhan Dashboard Stats:', {
              userId: authUser.id,
              email: authUser.email,
              role: 'Pradhan (Village Head)',
              totalTasks: assignedTasks.length,
              stats: realTimeStats,
              departmentBreakdown,
              taskStatuses: assignedTasks.map(t => ({ 
                id: t.id.slice(0, 8), 
                status: t.status, 
                category: t.category || 'General'
              }))
            });
          }
        }
      } else {
        // For other workers: Show only their assigned tasks (if any)
        const { data: tasksData } = await supabase
          .from('issues')
          .select('*')
          .eq('assigned_to', authUser.id)
          .order('created_at', { ascending: false });

        if (tasksData) {
          setTasks(tasksData);
          
          // Calculate real-time stats from assigned tasks
          const realTimeStats = {
            new_assigned: tasksData.filter(t => t.status === 'assigned' || t.status === 'reported').length,
            in_progress: tasksData.filter(t => t.status === 'in_progress').length,
            pending_approval: tasksData.filter(t => t.status === 'resolved' || t.status === 'pending_approval').length,
            critical_count: tasksData.filter(t => t.urgency === 'critical').length,
            total_assigned: tasksData.length
          };
          setStats(realTimeStats);
        } else {
          // No assigned tasks
          setTasks([]);
          setStats({
            new_assigned: 0,
            in_progress: 0,
            pending_approval: 0,
            critical_count: 0,
            total_assigned: 0
          });
        }
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const setupRealtimeSubscription = async () => {
    const { data: { user: authUser } } = await supabase.auth.getUser();
    const isPradhan = authUser?.email === 'abhitest1290@gmail.com';
    
    const subscription = supabase
      .channel('official-tasks')
      .on('postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'issues'
        },
        (payload) => {
          if (authUser) {
            if (isPradhan) {
              // For Pradhan: refresh on any issue change (all issues are Pradhan's responsibility)
              fetchUserAndData();
            } else {
              // For other workers: only refresh if the change affects their assigned tasks
              if (payload.new?.assigned_to === authUser.id || 
                  payload.old?.assigned_to === authUser.id) {
                fetchUserAndData();
              }
            }
          }
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  };

  const applyFiltersAndSort = () => {
    let filtered = [...tasks];

    // Apply status filter
    if (filterStatus !== 'all') {
      if (filterStatus === 'resolved') {
        // Show both resolved and pending_approval as "resolved" work
        filtered = filtered.filter(task => task.status === 'resolved' || task.status === 'pending_approval');
      } else {
        filtered = filtered.filter(task => task.status === filterStatus);
      }
    }

    // Apply sorting
    filtered.sort((a, b) => {
      if (sortBy === 'newest') {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      } else if (sortBy === 'oldest') {
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      } else if (sortBy === 'priority') {
        const urgencyOrder = { critical: 0, high: 1, medium: 2, low: 3 };
        return (urgencyOrder[a.urgency || 'low'] || 3) - (urgencyOrder[b.urgency || 'low'] || 3);
      }
      return 0;
    });

    setFilteredTasks(filtered);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/official/login');
  };

  const fetchMyReports = async () => {
    try {
      const reports = await getMyReports();
      setMyReports(reports);
    } catch (error) {
      console.error('Error fetching reports:', error);
      setMyReports([]); // Set empty array on error
    }
  };

  const handleReportIssue = (task: OfficialTaskCard, event: React.MouseEvent) => {
    event.stopPropagation(); // Prevent navigation to issue details
    setSelectedIssueForReport(task);
    setReportModalOpen(true);
  };

  const handleReportSubmitted = () => {
    fetchMyReports(); // Refresh reports list
    toast({
      title: "Issue Reported",
      description: "Your report has been submitted to the admin for review",
    });
  };

  const getUrgencyColor = (urgency?: string) => {
    switch (urgency) {
      case 'critical': return 'text-red-600 bg-red-100 dark:bg-red-900/20';
      case 'high': return 'text-orange-600 bg-orange-100 dark:bg-orange-900/20';
      case 'medium': return 'text-yellow-600 bg-yellow-100 dark:bg-yellow-900/20';
      default: return 'text-blue-600 bg-blue-100 dark:bg-blue-900/20';
    }
  };

  const getUrgencyIcon = (urgency?: string) => {
    if (urgency === 'critical' || urgency === 'high') {
      return '🔴';
    }
    return '';
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) return `${diffMins} min ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    return date.toLocaleDateString();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Pradhan Mode Banner - Show only for Pradhan */}
      {user?.email === 'abhitest1290@gmail.com' && (
        <div className="bg-gradient-to-r from-green-500 to-blue-500 text-white text-center py-3 px-4 text-sm font-medium shadow-lg">
          🏛️ PRADHAN MODE: Village Head - All issues from all departments are assigned to you
        </div>
      )}
      
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                Welcome, {user?.email === 'abhitest1290@gmail.com' ? 'Pradhan Ji' : (user?.full_name || 'Worker')}
              </h1>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {user?.email === 'abhitest1290@gmail.com' 
                  ? 'Village Head • All Departments • All Issues'
                  : `${user?.department || 'Worker'} ${user?.employee_id ? `• ${user.employee_id}` : ''}`
                }
              </p>
            </div>
            <div className="flex items-center gap-4">
              {/* Show Reports Button for Pradhan */}
              {user?.email === 'abhitest1290@gmail.com' && (
                <button
                  onClick={() => setShowReports(!showReports)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                    showReports 
                      ? 'bg-red-100 text-red-700 dark:bg-red-900/20' 
                      : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                >
                  <Flag className="w-4 h-4" />
                  <span className="text-sm font-medium">
                    My Reports ({myReports.length})
                  </span>
                </button>
              )}
              <button
                onClick={() => navigate('/official/profile')}
                className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                <User className="w-6 h-6 text-gray-600 dark:text-gray-400" />
              </button>
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 px-4 py-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
              >
                <LogOut className="w-4 h-4" />
                <span className="text-sm font-medium">Logout</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* My Reports Section - Show only for Pradhan when toggled */}
        {user?.email === 'abhitest1290@gmail.com' && showReports && (
          <div className="mb-8">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <Flag className="w-5 h-5 text-red-500" />
                My Reported Issues ({myReports.length})
              </h2>
              {myReports.length === 0 ? (
                <p className="text-gray-600 dark:text-gray-400 text-center py-8">
                  You haven't reported any issues yet.
                </p>
              ) : (
                <div className="space-y-3">
                  {myReports.map((report) => (
                    <div key={report.id} className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                      <div className="flex-1">
                        <h3 className="font-medium text-gray-900 dark:text-white">
                          {report.issue?.title}
                        </h3>
                        <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400 mt-1">
                          <span>Reason: {report.report_reason}</span>
                          <span>•</span>
                          <span>Reported: {new Date(report.created_at).toLocaleDateString()}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          report.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                          report.status === 'approved' ? 'bg-green-100 text-green-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {report.status.toUpperCase()}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          {/* New Assigned */}
          <button
            onClick={() => setFilterStatus(filterStatus === 'assigned' ? 'all' : 'assigned')}
            className={`p-6 rounded-xl shadow-sm transition-all ${
              filterStatus === 'assigned'
                ? 'bg-blue-600 text-white ring-4 ring-blue-200'
                : 'bg-white dark:bg-gray-800 hover:shadow-md'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <ClipboardList className="w-8 h-8" />
              <span className="text-3xl font-bold">{stats.new_assigned}</span>
            </div>
            <p className="text-sm font-medium">NEW ISSUES</p>
          </button>

          {/* In Progress */}
          <button
            onClick={() => setFilterStatus(filterStatus === 'in_progress' ? 'all' : 'in_progress')}
            className={`p-6 rounded-xl shadow-sm transition-all ${
              filterStatus === 'in_progress'
                ? 'bg-yellow-600 text-white ring-4 ring-yellow-200'
                : 'bg-white dark:bg-gray-800 hover:shadow-md'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <Clock className="w-8 h-8" />
              <span className="text-3xl font-bold">{stats.in_progress}</span>
            </div>
            <p className="text-sm font-medium">IN PROGRESS</p>
          </button>

          {/* Resolved */}
          <button
            onClick={() => setFilterStatus(filterStatus === 'resolved' ? 'all' : 'resolved')}
            className={`p-6 rounded-xl shadow-sm transition-all ${
              filterStatus === 'resolved'
                ? 'bg-green-600 text-white ring-4 ring-green-200'
                : 'bg-white dark:bg-gray-800 hover:shadow-md'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <CheckCircle className="w-8 h-8" />
              <span className="text-3xl font-bold">{stats.pending_approval}</span>
            </div>
            <p className="text-sm font-medium">RESOLVED</p>
          </button>

          {/* Total Assigned */}
          <button
            onClick={() => setFilterStatus('all')}
            className={`p-6 rounded-xl shadow-sm transition-all ${
              filterStatus === 'all'
                ? 'bg-gray-600 text-white ring-4 ring-gray-200'
                : 'bg-white dark:bg-gray-800 hover:shadow-md'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <AlertTriangle className="w-8 h-8" />
              <span className="text-3xl font-bold">{stats.total_assigned}</span>
            </div>
            <p className="text-sm font-medium">TOTAL ISSUES</p>
          </button>
        </div>

        {/* Filter and Sort Bar */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4 mb-6">
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            <div className="flex items-center gap-2">
              <Filter className="w-5 h-5 text-gray-500" />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Showing: {filterStatus === 'all' ? 'All Tasks' : filterStatus.replace('_', ' ').toUpperCase()}
              </span>
              {filterStatus !== 'all' && (
                <button
                  onClick={() => setFilterStatus('all')}
                  className="text-xs text-blue-600 hover:text-blue-700"
                >
                  Clear
                </button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <ArrowUpDown className="w-5 h-5 text-gray-500" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-1.5 dark:bg-gray-700 dark:text-white"
              >
                <option value="newest">Newest First</option>
                <option value="oldest">Oldest First</option>
                <option value="priority">Priority</option>
              </select>
            </div>
          </div>
        </div>

        {/* Task List */}
        <div className="space-y-4">
          {filteredTasks.length === 0 ? (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-12 text-center">
              <ClipboardList className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                {tasks.length === 0 ? 'No assigned tasks' : 'No tasks found'}
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                {tasks.length === 0 
                  ? user?.email === 'abhitest1290@gmail.com' 
                    ? 'No issues reported in the village yet. Great job keeping everything running smoothly!'
                    : 'You have no assigned tasks at the moment. Check back later or contact your supervisor.'
                  : filterStatus === 'all' 
                  ? 'You have no assigned tasks at the moment.'
                  : filterStatus === 'resolved'
                  ? 'No resolved tasks found.'
                  : `No tasks with status: ${filterStatus.replace('_', ' ')}`
                }
              </p>
            </div>
          ) : (
            filteredTasks.map((task) => (
              <div
                key={task.id}
                className="w-full bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-sm font-mono text-gray-500">
                        {task.id.slice(0, 8).toUpperCase()}
                      </span>
                      {getUrgencyIcon(task.urgency) && (
                        <span className={`text-xs px-2 py-1 rounded-full font-semibold ${getUrgencyColor(task.urgency)}`}>
                          {getUrgencyIcon(task.urgency)} {task.urgency?.toUpperCase()}
                        </span>
                      )}
                      {/* Show if issue is reported */}
                      {task.is_reported && (
                        <span className="text-xs px-2 py-1 rounded-full font-semibold bg-red-100 text-red-800">
                          🚩 REPORTED
                        </span>
                      )}
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
                      {task.title}
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      📍 {task.location}
                    </p>
                  </div>
                  <AlertTriangle className="w-5 h-5 text-gray-400 flex-shrink-0" />
                </div>

                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-4 text-gray-500 dark:text-gray-400">
                    <span>Assigned: {formatDate(task.created_at)}</span>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      task.status === 'assigned' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/20' :
                      task.status === 'reported' ? 'bg-red-100 text-red-700 dark:bg-red-900/20' :
                      task.status === 'in_progress' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/20' :
                      task.status === 'resolved' ? 'bg-green-100 text-green-700 dark:bg-green-900/20' :
                      task.status === 'pending_approval' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/20' :
                      task.status === 'closed' ? 'bg-gray-100 text-gray-700 dark:bg-gray-900/20' :
                      'bg-gray-100 text-gray-700 dark:bg-gray-700'
                    }`}>
                      {task.status.replace('_', ' ').toUpperCase()}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {/* Report Button - Show only for Pradhan */}
                    {user?.email === 'abhitest1290@gmail.com' && !task.is_reported && (
                      <button
                        onClick={(e) => handleReportIssue(task, e)}
                        className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                      >
                        <Flag className="w-3 h-3" />
                        Report
                      </button>
                    )}
                    <button
                      onClick={() => navigate(`/official/issue/${task.id}`)}
                      className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                    >
                      <Eye className="w-3 h-3" />
                      View Details
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </main>

      {/* Report Issue Modal */}
      <ReportIssueModal
        issue={selectedIssueForReport}
        isOpen={reportModalOpen}
        onClose={() => {
          setReportModalOpen(false);
          setSelectedIssueForReport(null);
        }}
        onReportSubmitted={handleReportSubmitted}
      />
    </div>
  );
};

export default OfficialDashboard;
