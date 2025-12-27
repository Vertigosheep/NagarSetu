import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { 
  ArrowLeft, 
  BarChart3, 
  MapPin, 
  Users, 
  AlertTriangle, 
  CheckCircle, 
  Clock,
  Search,
  Filter,
  Eye,
  MessageSquare,
  Calendar,
  TrendingUp,
  TrendingDown,
  Activity,
  FileText,
  Settings,
  Bell,
  Download,
  User,
  LogOut,
  Edit,
  UserPlus,
  Send
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from '@/hooks/use-toast';
import { getDashboardStats, getIssuesWithPriority } from '@/services/authorityService';
import NotificationCenter from '@/components/NotificationCenter';
import IssueDetailModal from '@/components/IssueDetailModal';
import IssueMap from '@/components/IssueMap';
import SimpleMap from '@/components/SimpleMap';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

interface Issue {
  id: string;
  title: string;
  description: string;
  location: string;
  category: string;
  status: string;
  created_at: string;
  image?: string;
  priority?: 'low' | 'medium' | 'high' | 'critical';
}

interface DashboardStats {
  totalReports: number;
  pendingIssues: number;
  resolvedToday: number;
  inProgress: number;
  avgResponseTime: string;
  satisfactionRate: number;
}

export default function AuthorityDashboard() {
  const navigate = useNavigate();
  const { currentUser, logOut } = useAuth();
  const [issues, setIssues] = useState<Issue[]>([]);
  const [stats, setStats] = useState<DashboardStats>({
    totalReports: 0,
    pendingIssues: 0,
    resolvedToday: 0,
    inProgress: 0,
    avgResponseTime: '0h',
    satisfactionRate: 0
  });
  const [loading, setLoading] = useState(true);
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [notificationCenterOpen, setNotificationCenterOpen] = useState(false);
  const [selectedIssue, setSelectedIssue] = useState<Issue | null>(null);
  const [issueDetailOpen, setIssueDetailOpen] = useState(false);
  
  // Profile related state
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [authorityProfile, setAuthorityProfile] = useState<any>(null);
  const [editingProfile, setEditingProfile] = useState(false);
  const [profileForm, setProfileForm] = useState({
    full_name: '',
    department: '',
    phone: '',
    bio: '',
    avatar_url: ''
  });
  const [tasksAssigned, setTasksAssigned] = useState(0);
  const [tasksSolved, setTasksSolved] = useState(0);

  // Assignment related state
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [selectedIssueForAssignment, setSelectedIssueForAssignment] = useState<Issue | null>(null);
  const [selectedDepartment, setSelectedDepartment] = useState('');
  const [assignmentNotes, setAssignmentNotes] = useState('');
  const [isAssigning, setIsAssigning] = useState(false);

  // Department list for assignment
  const departments = [
    'Public Works',
    'Transportation',
    'Water & Sewerage', 
    'Electricity',
    'Health Department',
    'Environmental Services',
    'Parks & Recreation',
    'Building & Planning',
    'Police Department',
    'Fire Department',
    'Emergency Services'
  ];

  useEffect(() => {
    fetchDashboardData();
    fetchAuthorityProfile();
    
    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchDashboardData, 30000);
    
    // Real-time subscription for new issues
    const subscription = supabase
      .channel('new-issues')
      .on('postgres_changes', 
        { 
          event: 'INSERT', 
          schema: 'public', 
          table: 'issues'
        }, 
        (payload) => {
          console.log('New issue reported:', payload);
          if (payload.new) {
            const newIssue = payload.new as Issue;
            
            // Add new issue to the list
            setIssues(prev => [newIssue, ...prev]);
            
            // Show notification for new issue
            toast({
              title: "🚨 New Issue Reported",
              description: `${newIssue.title} - ${newIssue.category}`,
            });
            
            // Auto-assign critical issues
            autoAssignCriticalIssue(newIssue);
          }
        }
      )
      .subscribe();
    
    return () => {
      clearInterval(interval);
      subscription.unsubscribe();
    };
  }, []);

  const fetchAuthorityProfile = async () => {
    if (!currentUser) return;
    
    try {
      const { data: profile, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', currentUser.id)
        .single();

      if (error) throw error;

      // Check if user is actually an authority
      if (profile?.user_type !== 'authority') {
        console.warn('User is not an authority:', profile?.user_type);
        toast({
          title: "Access Warning",
          description: "You may not have authority permissions to update issues",
          variant: "destructive",
        });
      }

      setAuthorityProfile(profile);
      setProfileForm({
        full_name: profile.full_name || '',
        department: profile.department || '',
        phone: profile.phone || '',
        bio: profile.bio || '',
        avatar_url: profile.avatar_url || ''
      });

      // Fetch task statistics
      const { data: assignedTasks, error: assignedError } = await supabase
        .from('issues')
        .select('id')
        .eq('assigned_to', currentUser.id);

      const { data: solvedTasks, error: solvedError } = await supabase
        .from('issues')
        .select('id')
        .eq('assigned_to', currentUser.id)
        .eq('status', 'resolved');

      if (!assignedError) setTasksAssigned(assignedTasks?.length || 0);
      if (!solvedError) setTasksSolved(solvedTasks?.length || 0);

    } catch (error) {
      console.error('Error fetching authority profile:', error);
    }
  };

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      
      // Fetch dashboard stats and issues
      const [statsData, issuesData] = await Promise.all([
        getDashboardStats(),
        getIssuesWithPriority()
      ]);

      setStats(statsData);
      setIssues(issuesData);

    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      toast({
        title: "Error",
        description: "Failed to load dashboard data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getPriorityByCategory = (category: string): string => {
    const priorityMap: { [key: string]: string } = {
      'Safety': 'critical',
      'Water': 'high',
      'Electricity': 'high',
      'Infrastructure': 'medium',
      'Transportation': 'medium',
      'Trash': 'low',
      'Noise': 'low',
      'Drainage': 'medium',
      'Public Space': 'low'
    };
    return priorityMap[category] || 'medium';
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical': return 'bg-red-100 text-red-800 border-red-200';
      case 'high': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'low': return 'bg-green-100 text-green-800 border-green-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'reported': return 'bg-blue-100 text-blue-800';
      case 'in-progress': return 'bg-yellow-100 text-yellow-800';
      case 'resolved': return 'bg-green-100 text-green-800';
      case 'closed': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  // Status updates are now handled by workers in the Official Portal
  // Authorities can only view status and assign work

  const handleViewIssue = (issue: Issue) => {
    setSelectedIssue(issue);
    setIssueDetailOpen(true);
  };

  const handleProfileUpdate = async () => {
    if (!currentUser) return;

    try {
      const { error } = await supabase
        .from('user_profiles')
        .update({
          full_name: profileForm.full_name,
          department: profileForm.department,
          phone: profileForm.phone,
          bio: profileForm.bio,
          avatar_url: profileForm.avatar_url,
          updated_at: new Date().toISOString()
        })
        .eq('id', currentUser.id);

      if (error) throw error;

      toast({
        title: "Profile Updated",
        description: "Your profile has been updated successfully",
      });

      setEditingProfile(false);
      fetchAuthorityProfile();
    } catch (error) {
      console.error('Error updating profile:', error);
      toast({
        title: "Error",
        description: "Failed to update profile",
        variant: "destructive",
      });
    }
  };

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !currentUser) return;

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${currentUser.id}-${Math.random()}.${fileExt}`;
      const filePath = `avatars/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('user-uploads')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('user-uploads')
        .getPublicUrl(filePath);

      setProfileForm(prev => ({ ...prev, avatar_url: publicUrl }));

      toast({
        title: "Image Uploaded",
        description: "Profile image uploaded successfully",
      });
    } catch (error) {
      console.error('Error uploading image:', error);
      toast({
        title: "Upload Error",
        description: "Failed to upload image",
        variant: "destructive",
      });
    }
  };

  const handleSignOut = async () => {
    try {
      await logOut();
      navigate('/');
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  const getUserInitials = () => {
    if (!authorityProfile?.full_name) return "A";
    const names = authorityProfile.full_name.split(" ");
    if (names.length === 1) return names[0].charAt(0).toUpperCase();
    return (names[0].charAt(0) + names[names.length - 1].charAt(0)).toUpperCase();
  };

  // Handle issue assignment
  const handleAssignWork = (issue: Issue) => {
    setSelectedIssueForAssignment(issue);
    setSelectedDepartment('');
    setAssignmentNotes('');
    setAssignModalOpen(true);
  };

  const handleAssignmentSubmit = async () => {
    if (!selectedIssueForAssignment || !selectedDepartment || !currentUser) return;

    setIsAssigning(true);
    try {
      const { error } = await supabase
        .from('issues')
        .update({
          status: 'in-progress',
          assigned_to: currentUser.id,
          department: selectedDepartment,
          assignment_notes: assignmentNotes,
          assigned_at: new Date().toISOString()
        })
        .eq('id', selectedIssueForAssignment.id);

      if (error) throw error;

      // Update local state
      setIssues(prev => prev.map(issue => 
        issue.id === selectedIssueForAssignment.id 
          ? { 
              ...issue, 
              status: 'in-progress',
              assigned_to: currentUser.id,
              department: selectedDepartment
            } 
          : issue
      ));

      toast({
        title: "Work Assigned Successfully",
        description: `Issue assigned to ${selectedDepartment} department`,
      });

      // Close modal and reset form
      setAssignModalOpen(false);
      setSelectedIssueForAssignment(null);
      setSelectedDepartment('');
      setAssignmentNotes('');

      // Refresh dashboard data
      fetchDashboardData();
    } catch (error: any) {
      console.error('Error assigning work:', error);
      toast({
        title: "Assignment Failed",
        description: error.message || "Failed to assign work to department",
        variant: "destructive",
      });
    } finally {
      setIsAssigning(false);
    }
  };

  // Auto-assign based on category
  const getRecommendedDepartment = (category: string): string => {
    const categoryToDepartment: { [key: string]: string } = {
      'Infrastructure': 'Public Works',
      'Water': 'Water & Sewerage',
      'Electricity': 'Electricity',
      'Transportation': 'Transportation',
      'Safety': 'Police Department',
      'Health': 'Health Department',
      'Environment': 'Environmental Services',
      'Parks': 'Parks & Recreation',
      'Building': 'Building & Planning',
      'Emergency': 'Emergency Services',
      'Trash': 'Environmental Services'
    };
    
    return categoryToDepartment[category] || 'Public Works';
  };

  // Auto-assign critical issues immediately
  const autoAssignCriticalIssue = async (issue: Issue) => {
    if (!currentUser) return;

    // Auto-assign critical categories immediately
    const criticalCategories = ['Safety', 'Water', 'Electricity'];
    if (criticalCategories.includes(issue.category)) {
      try {
        const recommendedDept = getRecommendedDepartment(issue.category);
        
        const { error } = await supabase
          .from('issues')
          .update({
            status: 'in-progress',
            assigned_to: currentUser.id,
            department: recommendedDept,
            assignment_notes: 'Auto-assigned due to critical priority',
            assigned_at: new Date().toISOString()
          })
          .eq('id', issue.id);

        if (!error) {
          toast({
            title: "Critical Issue Auto-Assigned",
            description: `${issue.title} assigned to ${recommendedDept}`,
            variant: "default",
          });
          
          // Refresh data to show updated status
          fetchDashboardData();
        }
      } catch (error) {
        console.error('Auto-assignment failed:', error);
      }
    }
  };

  const filteredIssues = issues.filter(issue => {
    const matchesStatus = selectedStatus === 'all' || issue.status === selectedStatus;
    const matchesCategory = selectedCategory === 'all' || issue.category === selectedCategory;
    const matchesSearch = issue.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         issue.location.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesStatus && matchesCategory && matchesSearch;
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto mb-4"></div>
          <p className="text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center">
              <Button 
                variant="ghost" 
                onClick={() => navigate('/')}
                className="mr-4"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Home
              </Button>
              <h1 className="text-2xl font-bold text-gray-900">Authority Dashboard</h1>
            </div>
            <div className="flex items-center space-x-4">
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setNotificationCenterOpen(true)}
              >
                <Bell className="h-4 w-4 mr-2" />
                Notifications
              </Button>
              <Button variant="outline" size="sm">
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
              
              {/* Profile Dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="gap-2">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={authorityProfile?.avatar_url || undefined} />
                      <AvatarFallback>{getUserInitials()}</AvatarFallback>
                    </Avatar>
                    <span className="hidden sm:inline">
                      {authorityProfile?.full_name || 'Authority User'}
                    </span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuItem onClick={() => setProfileModalOpen(true)}>
                    <User className="mr-2 h-4 w-4" />
                    <span>View Profile</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => {
                    setProfileModalOpen(true);
                    setEditingProfile(true);
                  }}>
                    <Edit className="mr-2 h-4 w-4" />
                    <span>Edit Profile</span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleSignOut}>
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>Sign out</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Reports</CardTitle>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalReports}</div>
              <p className="text-xs text-muted-foreground flex items-center">
                <TrendingUp className="h-3 w-3 mr-1 text-green-500" />
                +12% from last month
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending Issues</CardTitle>
              <AlertTriangle className="h-4 w-4 text-orange-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.pendingIssues}</div>
              <p className="text-xs text-muted-foreground">
                Requires immediate attention
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">In Progress</CardTitle>
              <Activity className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.inProgress}</div>
              <p className="text-xs text-muted-foreground">
                Currently being addressed
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Resolved Today</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.resolvedToday}</div>
              <p className="text-xs text-muted-foreground flex items-center">
                <TrendingUp className="h-3 w-3 mr-1 text-green-500" />
                +8% from yesterday
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Main Dashboard Tabs */}
        <Tabs defaultValue="issues" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="issues">Issue Management</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
            <TabsTrigger value="map">Issue Map</TabsTrigger>
            <TabsTrigger value="reports">Reports</TabsTrigger>
          </TabsList>

          {/* Issue Management Tab */}
          <TabsContent value="issues" className="space-y-6">
            {/* Filters */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Issue Management</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col sm:flex-row gap-4 mb-6">
                  <div className="flex-1">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <Input
                        placeholder="Search issues..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                  </div>
                  <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="Filter by status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="reported">Reported</SelectItem>
                      <SelectItem value="in-progress">In Progress</SelectItem>
                      <SelectItem value="resolved">Resolved</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="Filter by category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Categories</SelectItem>
                      <SelectItem value="Infrastructure">Infrastructure</SelectItem>
                      <SelectItem value="Water">Water</SelectItem>
                      <SelectItem value="Electricity">Electricity</SelectItem>
                      <SelectItem value="Safety">Safety</SelectItem>
                      <SelectItem value="Transportation">Transportation</SelectItem>
                      <SelectItem value="Trash">Trash</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Issues List */}
                <div className="space-y-4">
                  {filteredIssues.length === 0 ? (
                    <div className="text-center py-12 text-gray-500">
                      <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>No issues found matching your criteria</p>
                    </div>
                  ) : (
                    filteredIssues.map((issue) => (
                      <Card key={issue.id} className="hover:shadow-md transition-shadow">
                        <CardContent className="p-6">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-3 mb-2">
                                <h3 className="font-semibold text-lg">{issue.title}</h3>
                                <Badge className={getPriorityColor(issue.priority || 'medium')}>
                                  {issue.priority?.toUpperCase()}
                                </Badge>
                                <Badge className={getStatusColor(issue.status)}>
                                  {issue.status.replace('-', ' ').toUpperCase()}
                                </Badge>
                              </div>
                              <p className="text-gray-600 mb-3 line-clamp-2">{issue.description}</p>
                              <div className="flex items-center gap-4 text-sm text-gray-500">
                                <div className="flex items-center">
                                  <MapPin className="h-4 w-4 mr-1" />
                                  {issue.location}
                                </div>
                                <div className="flex items-center">
                                  <Calendar className="h-4 w-4 mr-1" />
                                  {new Date(issue.created_at).toLocaleDateString()}
                                </div>
                                <Badge variant="outline">{issue.category}</Badge>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 ml-4">
                              {/* Read-only Status Badge */}
                              <Badge className={getStatusColor(issue.status)}>
                                {issue.status.replace('_', ' ').replace('-', ' ').toUpperCase()}
                              </Badge>
                              
                              <Button 
                                variant="outline" 
                                size="sm"
                                onClick={() => handleViewIssue(issue)}
                              >
                                <Eye className="h-4 w-4 mr-1" />
                                View
                              </Button>
                              
                              {issue.status === 'reported' && (
                                <Button 
                                  variant="default" 
                                  size="sm"
                                  onClick={() => handleAssignWork(issue)}
                                  className="bg-blue-600 hover:bg-blue-700"
                                >
                                  <UserPlus className="h-4 w-4 mr-1" />
                                  Assign Work
                                </Button>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Analytics Tab */}
          <TabsContent value="analytics" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Performance Metrics</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">Average Response Time</span>
                    <span className="text-2xl font-bold text-blue-600">{stats.avgResponseTime}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">Satisfaction Rate</span>
                    <span className="text-2xl font-bold text-green-600">{stats.satisfactionRate}%</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">Resolution Rate</span>
                    <span className="text-2xl font-bold text-purple-600">78%</span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Category Breakdown</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {['Infrastructure', 'Water', 'Safety', 'Transportation', 'Other'].map((category, index) => (
                      <div key={category} className="flex items-center justify-between">
                        <span className="text-sm">{category}</span>
                        <div className="flex items-center gap-2">
                          <div className="w-20 bg-gray-200 rounded-full h-2">
                            <div 
                              className="bg-blue-600 h-2 rounded-full" 
                              style={{ width: `${Math.max(20, 80 - index * 15)}%` }}
                            ></div>
                          </div>
                          <span className="text-sm font-medium">{Math.max(5, 25 - index * 4)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Map Tab */}
          <TabsContent value="map" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <MapPin className="h-5 w-5 mr-2 text-blue-500" />
                  Interactive Issue Map
                </CardTitle>
                <p className="text-sm text-gray-600 mt-1">
                  Real-time visualization of all reported issues with priority-based color coding
                </p>
              </CardHeader>
              <CardContent>
                <SimpleMap 
                  issues={filteredIssues} 
                  onIssueSelect={handleViewIssue}
                />
              </CardContent>
            </Card>
          </TabsContent>

          {/* Reports Tab */}
          <TabsContent value="reports" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <FileText className="h-5 w-5 mr-2 text-green-500" />
                  Generate Reports
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <h3 className="font-semibold">Available Reports</h3>
                    <div className="space-y-2">
                      <Button variant="outline" className="w-full justify-start">
                        <BarChart3 className="h-4 w-4 mr-2" />
                        Monthly Performance Report
                      </Button>
                      <Button variant="outline" className="w-full justify-start">
                        <TrendingUp className="h-4 w-4 mr-2" />
                        Issue Trends Analysis
                      </Button>
                      <Button variant="outline" className="w-full justify-start">
                        <Users className="h-4 w-4 mr-2" />
                        Department Performance
                      </Button>
                      <Button variant="outline" className="w-full justify-start">
                        <MapPin className="h-4 w-4 mr-2" />
                        Geographic Distribution
                      </Button>
                    </div>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-6">
                    <h4 className="font-medium mb-4">Quick Stats</h4>
                    <div className="space-y-3 text-sm">
                      <div className="flex justify-between">
                        <span>This Month's Reports:</span>
                        <span className="font-semibold">{stats.totalReports}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Resolution Rate:</span>
                        <span className="font-semibold text-green-600">78%</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Avg. Response Time:</span>
                        <span className="font-semibold">{stats.avgResponseTime}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Citizen Satisfaction:</span>
                        <span className="font-semibold text-blue-600">{stats.satisfactionRate}%</span>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>

      {/* Notification Center */}
      <NotificationCenter 
        isOpen={notificationCenterOpen}
        onClose={() => setNotificationCenterOpen(false)}
      />

      {/* Issue Detail Modal */}
      <IssueDetailModal
        issue={selectedIssue}
        isOpen={issueDetailOpen}
        onClose={() => {
          setIssueDetailOpen(false);
          setSelectedIssue(null);
        }}
      />

      {/* Profile Modal */}
      <Dialog open={profileModalOpen} onOpenChange={setProfileModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold">
              {editingProfile ? 'Edit Profile' : 'Authority Profile'}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-6">
            {/* Profile Header */}
            <div className="flex items-center space-x-6">
              <div className="relative">
                <Avatar className="h-24 w-24">
                  <AvatarImage src={profileForm.avatar_url || authorityProfile?.avatar_url} />
                  <AvatarFallback className="text-2xl">{getUserInitials()}</AvatarFallback>
                </Avatar>
                {editingProfile && (
                  <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity cursor-pointer">
                    <label className="cursor-pointer">
                      <Edit className="h-6 w-6 text-white" />
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleImageUpload}
                        className="hidden"
                      />
                    </label>
                  </div>
                )}
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-semibold">
                  {authorityProfile?.full_name || 'Authority User'}
                </h3>
                <p className="text-gray-600">{authorityProfile?.department || 'Department not specified'}</p>
                <p className="text-sm text-gray-500">
                  Joined {new Date(authorityProfile?.created_at).toLocaleDateString('en-US', { 
                    month: 'long', 
                    year: 'numeric' 
                  })}
                </p>
              </div>
            </div>

            {/* Task Statistics */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-blue-50 p-4 rounded-lg text-center">
                <div className="text-2xl font-bold text-blue-600">{tasksAssigned}</div>
                <div className="text-sm text-blue-800">Tasks Assigned</div>
              </div>
              <div className="bg-green-50 p-4 rounded-lg text-center">
                <div className="text-2xl font-bold text-green-600">{tasksSolved}</div>
                <div className="text-sm text-green-800">Tasks Solved</div>
              </div>
            </div>

            {editingProfile ? (
              /* Edit Form */
              <div className="space-y-4">
                <div>
                  <Label htmlFor="full_name">Full Name</Label>
                  <Input
                    id="full_name"
                    value={profileForm.full_name}
                    onChange={(e) => setProfileForm(prev => ({ ...prev, full_name: e.target.value }))}
                    placeholder="Enter your full name"
                  />
                </div>
                
                <div>
                  <Label htmlFor="department">Department</Label>
                  <Input
                    id="department"
                    value={profileForm.department}
                    onChange={(e) => setProfileForm(prev => ({ ...prev, department: e.target.value }))}
                    placeholder="Enter your department"
                  />
                </div>
                
                <div>
                  <Label htmlFor="phone">Phone Number</Label>
                  <Input
                    id="phone"
                    value={profileForm.phone}
                    onChange={(e) => setProfileForm(prev => ({ ...prev, phone: e.target.value }))}
                    placeholder="Enter your phone number"
                  />
                </div>
                
                <div>
                  <Label htmlFor="bio">Bio</Label>
                  <Textarea
                    id="bio"
                    value={profileForm.bio}
                    onChange={(e) => setProfileForm(prev => ({ ...prev, bio: e.target.value }))}
                    placeholder="Tell us about yourself and your role"
                    rows={3}
                  />
                </div>

                <div className="flex justify-end gap-3 pt-4">
                  <Button 
                    variant="outline" 
                    onClick={() => {
                      setEditingProfile(false);
                      setProfileForm({
                        full_name: authorityProfile?.full_name || '',
                        department: authorityProfile?.department || '',
                        phone: authorityProfile?.phone || '',
                        bio: authorityProfile?.bio || '',
                        avatar_url: authorityProfile?.avatar_url || ''
                      });
                    }}
                  >
                    Cancel
                  </Button>
                  <Button onClick={handleProfileUpdate}>
                    Save Changes
                  </Button>
                </div>
              </div>
            ) : (
              /* View Profile */
              <div className="space-y-4">
                <div>
                  <Label className="text-sm font-medium text-gray-700">Email</Label>
                  <p className="text-gray-900">{currentUser?.email}</p>
                </div>
                
                <div>
                  <Label className="text-sm font-medium text-gray-700">Phone</Label>
                  <p className="text-gray-900">{authorityProfile?.phone || 'Not provided'}</p>
                </div>
                
                <div>
                  <Label className="text-sm font-medium text-gray-700">Bio</Label>
                  <p className="text-gray-900">{authorityProfile?.bio || 'No bio provided'}</p>
                </div>

                <div className="flex justify-end pt-4">
                  <Button onClick={() => setEditingProfile(true)}>
                    <Edit className="h-4 w-4 mr-2" />
                    Edit Profile
                  </Button>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Assignment Modal */}
      <Dialog open={assignModalOpen} onOpenChange={setAssignModalOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">Assign Work to Department</DialogTitle>
          </DialogHeader>
          
          {selectedIssueForAssignment && (
            <div className="space-y-6">
              {/* Issue Summary */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <h3 className="font-semibold text-lg mb-2">{selectedIssueForAssignment.title}</h3>
                <p className="text-gray-600 mb-2">{selectedIssueForAssignment.description}</p>
                <div className="flex gap-2 text-sm">
                  <Badge variant="outline">{selectedIssueForAssignment.category}</Badge>
                  <Badge variant="outline">📍 {selectedIssueForAssignment.location}</Badge>
                  <Badge variant="outline">📅 {new Date(selectedIssueForAssignment.created_at).toLocaleDateString()}</Badge>
                </div>
              </div>

              {/* Department Selection */}
              <div>
                <Label htmlFor="department" className="text-sm font-medium mb-2 block">
                  Assign to Department *
                </Label>
                <Select 
                  value={selectedDepartment} 
                  onValueChange={(value) => {
                    setSelectedDepartment(value);
                    // Auto-fill recommended department
                    if (!selectedDepartment) {
                      const recommended = getRecommendedDepartment(selectedIssueForAssignment.category);
                      setSelectedDepartment(recommended);
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={`Recommended: ${getRecommendedDepartment(selectedIssueForAssignment.category)}`} />
                  </SelectTrigger>
                  <SelectContent>
                    {departments.map((dept) => (
                      <SelectItem key={dept} value={dept}>
                        {dept}
                        {dept === getRecommendedDepartment(selectedIssueForAssignment.category) && (
                          <span className="ml-2 text-xs text-blue-600">(Recommended)</span>
                        )}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Assignment Notes */}
              <div>
                <Label htmlFor="notes" className="text-sm font-medium mb-2 block">
                  Assignment Notes (Optional)
                </Label>
                <Textarea
                  id="notes"
                  value={assignmentNotes}
                  onChange={(e) => setAssignmentNotes(e.target.value)}
                  placeholder="Add any specific instructions or priority notes for the assigned department..."
                  rows={3}
                />
              </div>

              {/* Priority Indicator */}
              <div className="bg-blue-50 p-3 rounded-lg">
                <div className="flex items-center gap-2 text-sm">
                  <AlertTriangle className="h-4 w-4 text-blue-600" />
                  <span className="font-medium">Assignment Priority:</span>
                  <Badge className={`${
                    selectedIssueForAssignment.category === 'Safety' ? 'bg-red-100 text-red-800' :
                    selectedIssueForAssignment.category === 'Water' || selectedIssueForAssignment.category === 'Electricity' ? 'bg-orange-100 text-orange-800' :
                    'bg-yellow-100 text-yellow-800'
                  }`}>
                    {selectedIssueForAssignment.category === 'Safety' ? 'CRITICAL' :
                     selectedIssueForAssignment.category === 'Water' || selectedIssueForAssignment.category === 'Electricity' ? 'HIGH' :
                     'MEDIUM'}
                  </Badge>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end gap-3 pt-4">
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setAssignModalOpen(false);
                    setSelectedIssueForAssignment(null);
                    setSelectedDepartment('');
                    setAssignmentNotes('');
                  }}
                  disabled={isAssigning}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleAssignmentSubmit}
                  disabled={!selectedDepartment || isAssigning}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  {isAssigning ? (
                    <span className="flex items-center gap-2">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      Assigning...
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      <Send className="h-4 w-4" />
                      Assign Work
                    </span>
                  )}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}