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
  ArrowUpDown
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { OfficialDashboardStats, OfficialTaskCard, User as UserType } from '@/types';

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

  useEffect(() => {
    fetchUserAndData();
    setupRealtimeSubscription();
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

      // TEMPORARY: Allow all user types for testing
      // TODO: In production, uncomment the check below
      /*
      if (profile?.user_type !== 'official') {
        navigate('/official/login');
        return;
      }
      */

      setUser(profile);

      // DEMO MODE: Fetch ALL issues instead of just assigned ones
      // TODO: In production, uncomment the assigned filter below
      
      // Fetch all issues for demo
      const { data: tasksData } = await supabase
        .from('issues')
        .select('*')
        .order('created_at', { ascending: false });

      if (tasksData) {
        setTasks(tasksData);
        
        // Calculate demo stats from all issues
        const demoStats = {
          new_assigned: tasksData.filter(t => t.status === 'assigned' || t.status === 'reported').length,
          in_progress: tasksData.filter(t => t.status === 'in_progress').length,
          pending_approval: tasksData.filter(t => t.status === 'pending_approval').length,
          critical_count: tasksData.filter(t => t.urgency === 'critical').length,
          total_assigned: tasksData.length
        };
        setStats(demoStats);
      }
      
      /* PRODUCTION CODE - Uncomment when ready:
      // Fetch dashboard stats
      const { data: statsData } = await supabase
        .from('official_dashboard_stats')
        .select('*')
        .eq('official_id', authUser.id)
        .single();

      if (statsData) {
        setStats(statsData);
      }

      // Fetch only assigned tasks
      const { data: tasksData } = await supabase
        .from('issues')
        .select('*')
        .eq('assigned_to', authUser.id)
        .order('created_at', { ascending: false });

      if (tasksData) {
        setTasks(tasksData);
      }
      */
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const setupRealtimeSubscription = () => {
    const subscription = supabase
      .channel('official-tasks')
      .on('postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'issues'
        },
        () => {
          fetchUserAndData();
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
      filtered = filtered.filter(task => task.status === filterStatus);
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
      {/* Demo Mode Banner */}
      <div className="bg-gradient-to-r from-purple-500 to-pink-500 text-white text-center py-3 px-4 text-sm font-medium shadow-lg">
        🎬 DEMO MODE: Showing ALL issues from the system (not filtered by department or assignment)
      </div>
      
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                Welcome, {user?.full_name}
              </h1>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {user?.department} {user?.employee_id && `• ${user.employee_id}`}
              </p>
            </div>
            <div className="flex items-center gap-4">
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
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
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
            <p className="text-sm font-medium">NEW ASSIGNED</p>
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
            <p className="text-sm font-medium">IN-PROGRESS</p>
          </button>

          {/* Pending Approval */}
          <button
            onClick={() => setFilterStatus(filterStatus === 'pending_approval' ? 'all' : 'pending_approval')}
            className={`p-6 rounded-xl shadow-sm transition-all ${
              filterStatus === 'pending_approval'
                ? 'bg-green-600 text-white ring-4 ring-green-200'
                : 'bg-white dark:bg-gray-800 hover:shadow-md'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <CheckCircle className="w-8 h-8" />
              <span className="text-3xl font-bold">{stats.pending_approval}</span>
            </div>
            <p className="text-sm font-medium">PENDING ADMIN APPROVAL</p>
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
                No tasks found
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                {filterStatus === 'all' 
                  ? 'You have no assigned tasks at the moment.'
                  : `No tasks with status: ${filterStatus.replace('_', ' ')}`
                }
              </p>
            </div>
          ) : (
            filteredTasks.map((task) => (
              <button
                key={task.id}
                onClick={() => navigate(`/official/issue/${task.id}`)}
                className="w-full bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 hover:shadow-md transition-shadow text-left"
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
                      task.status === 'in_progress' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/20' :
                      task.status === 'pending_approval' ? 'bg-green-100 text-green-700 dark:bg-green-900/20' :
                      'bg-gray-100 text-gray-700 dark:bg-gray-700'
                    }`}>
                      {task.status.replace('_', ' ').toUpperCase()}
                    </span>
                  </div>
                  <span className="text-blue-600 dark:text-blue-400 font-medium">
                    View Details →
                  </span>
                </div>
              </button>
            ))
          )}
        </div>
      </main>
    </div>
  );
};

export default OfficialDashboard;
