import React, { useState, useEffect } from 'react';
import { useToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { MapPin, Calendar, Users, Clock, ArrowRight, User, Plus, Heart, Target, Handshake, Upload, Camera, MessageCircle, UserPlus } from 'lucide-react';
import Navbar from '@/components/Navbar';
import { useAuth } from "@/contexts/SupabaseAuthContext";
import { supabase } from '@/lib/supabase';
import { useNavigate } from 'react-router-dom';
import AuthModal from '@/components/AuthModal';

interface Initiative {
  id: string;
  title: string;
  description: string;
  location: string;
  category: string;
  image?: string;
  meetingDate: string;
  meetingTime: string;
  volunteersCount: number;
  volunteersNeeded: number;
  organizer: string;
  organizerAvatar?: string;
  status: 'open' | 'in-progress' | 'completed';
  createdAt: string;
  volunteers: string[];
}

const Events = () => {
  const { toast } = useToast();
  const { currentUser } = useAuth();
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const navigate = useNavigate();
  
  const [newInitiative, setNewInitiative] = useState({
    title: '',
    description: '',
    location: '',
    category: 'Community Cleanup',
    image: '',
    meetingDate: '',
    meetingTime: '',
    volunteersNeeded: 5
  });

  const [initiatives, setInitiatives] = useState<Initiative[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [stats, setStats] = useState({
    totalVolunteers: 0,
    problemsSolved: 0,
    activeInitiatives: 0
  });

  const categories = [
    'Community Cleanup',
    'Infrastructure Repair', 
    'Environmental',
    'Education Support',
    'Elderly Care',
    'Youth Programs',
    'Food Distribution',
    'Other'
  ];

  useEffect(() => {
    fetchInitiatives();
    fetchStats();
    
    // Set up real-time subscription
    const subscription = supabase
      .channel('initiatives-changes')
      .on('postgres_changes', 
        { 
          event: '*', 
          schema: 'public', 
          table: 'initiatives'
        }, 
        (payload) => {
          console.log('Real-time initiative update:', payload);
          handleRealTimeUpdate(payload);
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const handleRealTimeUpdate = (payload: any) => {
    if (payload.eventType === 'INSERT') {
      const newInitiative = transformInitiativeData(payload.new);
      setInitiatives(prev => [newInitiative, ...prev]);
      setStats(prev => ({ ...prev, activeInitiatives: prev.activeInitiatives + 1 }));
    } else if (payload.eventType === 'UPDATE') {
      const updatedInitiative = transformInitiativeData(payload.new);
      setInitiatives(prev => 
        prev.map(initiative => 
          initiative.id === updatedInitiative.id ? updatedInitiative : initiative
        )
      );
    } else if (payload.eventType === 'DELETE') {
      setInitiatives(prev => prev.filter(initiative => initiative.id !== payload.old.id));
      setStats(prev => ({ ...prev, activeInitiatives: Math.max(0, prev.activeInitiatives - 1) }));
    }
  };

  const transformInitiativeData = (data: any): Initiative => ({
    id: data.id,
    title: data.title,
    description: data.description,
    location: data.location,
    category: data.category,
    image: data.image,
    meetingDate: data.meeting_date,
    meetingTime: data.meeting_time,
    volunteersCount: data.volunteers_count || 0,
    volunteersNeeded: data.volunteers_needed,
    organizer: data.organizer,
    organizerAvatar: data.organizer_avatar,
    status: data.status,
    createdAt: data.created_at,
    volunteers: data.volunteers || []
  });

  const fetchInitiatives = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('initiatives')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const transformedInitiatives = data.map(transformInitiativeData);
      setInitiatives(transformedInitiatives);
    } catch (error) {
      console.error('Error fetching initiatives:', error);
      toast({
        title: "Error loading initiatives",
        description: "Failed to load community initiatives. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      // Get total volunteers count
      const { data: initiativesData, error: initiativesError } = await supabase
        .from('initiatives')
        .select('volunteers_count, status');

      if (initiativesError) throw initiativesError;

      const totalVolunteers = initiativesData.reduce((sum, initiative) => sum + (initiative.volunteers_count || 0), 0);
      const activeInitiatives = initiativesData.filter(i => i.status === 'open').length;
      const problemsSolved = initiativesData.filter(i => i.status === 'completed').length;

      setStats({
        totalVolunteers,
        problemsSolved,
        activeInitiatives
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const handleCreateInitiative = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) {
      setAuthModalOpen(true);
      return;
    }

    try {
      const initiativeData = {
        title: newInitiative.title,
        description: newInitiative.description,
        location: newInitiative.location,
        category: newInitiative.category,
        image: newInitiative.image || null,
        meeting_date: newInitiative.meetingDate,
        meeting_time: newInitiative.meetingTime,
        volunteers_needed: newInitiative.volunteersNeeded,
        organizer: currentUser.user_metadata?.full_name || currentUser.email || 'Anonymous',
        organizer_avatar: currentUser.user_metadata?.avatar_url || null,
        status: 'open',
        volunteers_count: 0,
        volunteers: [],
        created_by: currentUser.id
      };

      const { error } = await supabase
        .from('initiatives')
        .insert([initiativeData]);

      if (error) throw error;

      toast({
        title: "Initiative Created!",
        description: "Your community initiative has been posted successfully.",
      });

      setShowCreateForm(false);
      setNewInitiative({
        title: '',
        description: '',
        location: '',
        category: 'Community Cleanup',
        image: '',
        meetingDate: '',
        meetingTime: '',
        volunteersNeeded: 5
      });
      
      // Real-time subscription will handle the update automatically
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to create initiative",
        variant: "destructive",
      });
    }
  };

  const handleVolunteer = async (initiativeId: string) => {
    if (!currentUser) {
      setAuthModalOpen(true);
      return;
    }

    try {
      // Check if user is already a volunteer
      const initiative = initiatives.find(i => i.id === initiativeId);
      if (initiative && initiative.volunteers.includes(currentUser.id)) {
        toast({
          title: "Already Joined",
          description: "You're already a volunteer for this initiative.",
          variant: "destructive",
        });
        return;
      }

      // Use the database function to join the initiative
      const { error } = await supabase.rpc('join_initiative', {
        initiative_id: initiativeId,
        user_id: currentUser.id
      });

      if (error) throw error;

      toast({
        title: "Volunteered Successfully!",
        description: "You've joined this initiative. The organizer will contact you soon.",
      });

      // Real-time subscription will handle the update automatically
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to join initiative",
        variant: "destructive",
      });
    }
  };

  const handleLeaveInitiative = async (initiativeId: string) => {
    if (!currentUser) return;

    try {
      const { error } = await supabase.rpc('leave_initiative', {
        initiative_id: initiativeId,
        user_id: currentUser.id
      });

      if (error) throw error;

      toast({
        title: "Left Initiative",
        description: "You've left this initiative.",
      });

      // Real-time subscription will handle the update automatically
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to leave initiative",
        variant: "destructive",
      });
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setNewInitiative(prev => ({ 
      ...prev, 
      [name]: name === 'volunteersNeeded' ? parseInt(value) || 0 : value 
    }));
  };

  const filteredInitiatives = initiatives.filter(initiative => {
    if (filter === 'all') return true;
    if (filter === 'open') return initiative.status === 'open';
    if (filter === 'my') return currentUser && initiative.volunteers.includes(currentUser.id);
    return true;
  });

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      weekday: 'long',
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  };

  const formatTime = (timeString: string) => {
    const [hours, minutes] = timeString.split(':');
    const date = new Date();
    date.setHours(parseInt(hours), parseInt(minutes));
    return date.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true 
    });
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      
      <div className="pt-28 pb-20 flex-1">
        {/* Hero Section */}
        <div className="container mx-auto px-4 md:px-6">
          <div className="text-center mb-12">
            <div className="inline-flex items-center px-3 py-1.5 bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400 rounded-full text-sm mb-6">
              <Heart className="h-4 w-4 mr-2" />
              <span>Community-Driven Solutions</span>
            </div>
            
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-semibold mb-6 text-balance">
              Join <span className="text-primary">Community Initiatives</span>
            </h1>
            
            <p className="text-xl text-muted-foreground mb-8 max-w-3xl mx-auto text-balance">
              Connect with neighbors to solve local problems together. No government interference - just community members working as one to make a difference.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button 
                size="lg" 
                className="group"
                onClick={() => {
                  if (!currentUser) {
                    setAuthModalOpen(true);
                  } else {
                    setShowCreateForm(true);
                  }
                }}
              >
                <Plus className="mr-2 h-4 w-4" />
                <span>Start an Initiative</span>
                <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Button>
              <Button size="lg" variant="outline">
                <Target className="mr-2 h-4 w-4" />
                <span>Browse Initiatives</span>
              </Button>
            </div>
          </div>

          {/* Stats Section */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
            <div className="bg-card rounded-xl p-6 text-center">
              <div className="h-12 w-12 rounded-full bg-blue-100 dark:bg-blue-900/20 flex items-center justify-center mx-auto mb-4">
                <Users className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              </div>
              <h3 className="text-2xl font-semibold mb-2">{stats.totalVolunteers}</h3>
              <p className="text-muted-foreground">Total Volunteers</p>
            </div>
            <div className="bg-card rounded-xl p-6 text-center">
              <div className="h-12 w-12 rounded-full bg-green-100 dark:bg-green-900/20 flex items-center justify-center mx-auto mb-4">
                <Target className="h-6 w-6 text-green-600 dark:text-green-400" />
              </div>
              <h3 className="text-2xl font-semibold mb-2">{stats.problemsSolved}</h3>
              <p className="text-muted-foreground">Problems Solved</p>
            </div>
            <div className="bg-card rounded-xl p-6 text-center">
              <div className="h-12 w-12 rounded-full bg-purple-100 dark:bg-purple-900/20 flex items-center justify-center mx-auto mb-4">
                <Handshake className="h-6 w-6 text-purple-600 dark:text-purple-400" />
              </div>
              <h3 className="text-2xl font-semibold mb-2">{stats.activeInitiatives}</h3>
              <p className="text-muted-foreground">Active Initiatives</p>
            </div>
          </div>

          {/* Filter Tabs */}
          <div className="flex flex-wrap gap-2 mb-8">
            <button
              onClick={() => setFilter('all')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                filter === 'all' 
                  ? 'bg-primary text-primary-foreground' 
                  : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
              }`}
            >
              All Initiatives
            </button>
            <button
              onClick={() => setFilter('open')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                filter === 'open' 
                  ? 'bg-primary text-primary-foreground' 
                  : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
              }`}
            >
              Open for Volunteers
            </button>
            {currentUser && (
              <button
                onClick={() => setFilter('my')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  filter === 'my' 
                    ? 'bg-primary text-primary-foreground' 
                    : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
                }`}
              >
                My Initiatives
              </button>
            )}
          </div>

          {/* Create Initiative Form */}
          {showCreateForm && (
            <div className="bg-card border rounded-xl p-6 mb-8 animate-slide-down">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl font-semibold">Start a Community Initiative</h2>
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => setShowCreateForm(false)}
                >
                  ✕
                </Button>
              </div>
              
              <form onSubmit={handleCreateInitiative} className="space-y-4">
                <div>
                  <label htmlFor="title" className="block text-sm font-medium mb-1">Initiative Title</label>
                  <input
                    type="text"
                    id="title"
                    name="title"
                    value={newInitiative.title}
                    onChange={handleInputChange}
                    className="w-full p-3 rounded-lg border border-input bg-background"
                    placeholder="e.g., Community Park Cleanup Drive"
                    required
                  />
                </div>
                
                <div>
                  <label htmlFor="description" className="block text-sm font-medium mb-1">Description</label>
                  <textarea
                    id="description"
                    name="description"
                    value={newInitiative.description}
                    onChange={handleInputChange}
                    className="w-full p-3 rounded-lg border border-input bg-background min-h-32"
                    placeholder="Describe the problem and how volunteers can help solve it..."
                    required
                  />
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="location" className="block text-sm font-medium mb-1">Meeting Location</label>
                    <input
                      type="text"
                      id="location"
                      name="location"
                      value={newInitiative.location}
                      onChange={handleInputChange}
                      className="w-full p-3 rounded-lg border border-input bg-background"
                      placeholder="Where will volunteers meet?"
                      required
                    />
                  </div>
                  
                  <div>
                    <label htmlFor="category" className="block text-sm font-medium mb-1">Category</label>
                    <select
                      id="category"
                      name="category"
                      value={newInitiative.category}
                      onChange={handleInputChange}
                      className="w-full p-3 rounded-lg border border-input bg-background"
                      required
                    >
                      {categories.map(category => (
                        <option key={category} value={category}>{category}</option>
                      ))}
                    </select>
                  </div>
                  
                  <div>
                    <label htmlFor="meetingDate" className="block text-sm font-medium mb-1">Meeting Date</label>
                    <input
                      type="date"
                      id="meetingDate"
                      name="meetingDate"
                      value={newInitiative.meetingDate}
                      onChange={handleInputChange}
                      className="w-full p-3 rounded-lg border border-input bg-background"
                      required
                    />
                  </div>
                  
                  <div>
                    <label htmlFor="meetingTime" className="block text-sm font-medium mb-1">Meeting Time</label>
                    <input
                      type="time"
                      id="meetingTime"
                      name="meetingTime"
                      value={newInitiative.meetingTime}
                      onChange={handleInputChange}
                      className="w-full p-3 rounded-lg border border-input bg-background"
                      required
                    />
                  </div>
                  
                  <div>
                    <label htmlFor="volunteersNeeded" className="block text-sm font-medium mb-1">Volunteers Needed</label>
                    <input
                      type="number"
                      id="volunteersNeeded"
                      name="volunteersNeeded"
                      value={newInitiative.volunteersNeeded}
                      onChange={handleInputChange}
                      className="w-full p-3 rounded-lg border border-input bg-background"
                      min="1"
                      max="100"
                      required
                    />
                  </div>
                  
                  <div>
                    <label htmlFor="image" className="block text-sm font-medium mb-1">Problem Image URL (Optional)</label>
                    <input
                      type="url"
                      id="image"
                      name="image"
                      value={newInitiative.image}
                      onChange={handleInputChange}
                      className="w-full p-3 rounded-lg border border-input bg-background"
                      placeholder="https://example.com/image.jpg"
                    />
                  </div>
                </div>
                
                <div className="flex justify-end space-x-4 pt-4">
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => setShowCreateForm(false)}
                  >
                    Cancel
                  </Button>
                  <Button type="submit">
                    <Upload className="mr-2 h-4 w-4" />
                    Post Initiative
                  </Button>
                </div>
              </form>
            </div>
          )}

          {/* Initiatives Grid */}
          {isLoading ? (
            <div className="text-center py-16">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-muted-foreground">Loading community initiatives...</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredInitiatives.length > 0 ? (
                filteredInitiatives.map((initiative) => (
                  <div key={initiative.id} className="bg-card rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                    {initiative.image && (
                      <div className="relative h-48 overflow-hidden">
                        <img 
                          src={initiative.image} 
                          alt={initiative.title}
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute top-3 left-3">
                          <span className="px-2 py-1 bg-white/90 dark:bg-black/90 text-xs font-medium rounded-md">
                            {initiative.category}
                          </span>
                        </div>
                        <div className="absolute top-3 right-3">
                          <span className={`px-2 py-1 text-xs font-medium rounded-md ${
                            initiative.status === 'open' 
                              ? 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400'
                              : 'bg-gray-100 text-gray-700 dark:bg-gray-900/20 dark:text-gray-400'
                          }`}>
                            {initiative.status === 'open' ? 'Open' : 'In Progress'}
                          </span>
                        </div>
                      </div>
                    )}
                    
                    <div className="p-5">
                      {!initiative.image && (
                        <div className="flex items-center justify-between mb-3">
                          <span className="px-2 py-1 bg-secondary text-xs font-medium rounded-md">
                            {initiative.category}
                          </span>
                          <span className={`px-2 py-1 text-xs font-medium rounded-md ${
                            initiative.status === 'open' 
                              ? 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400'
                              : 'bg-gray-100 text-gray-700 dark:bg-gray-900/20 dark:text-gray-400'
                          }`}>
                            {initiative.status === 'open' ? 'Open' : 'In Progress'}
                          </span>
                        </div>
                      )}
                      
                      <h3 className="text-lg font-semibold mb-2 line-clamp-2">{initiative.title}</h3>
                      <p className="text-muted-foreground text-sm mb-4 line-clamp-3">{initiative.description}</p>
                      
                      <div className="space-y-2 mb-4">
                        <div className="flex items-center text-sm text-muted-foreground">
                          <MapPin className="h-4 w-4 mr-2 flex-shrink-0" />
                          <span className="truncate">{initiative.location}</span>
                        </div>
                        <div className="flex items-center text-sm text-muted-foreground">
                          <Calendar className="h-4 w-4 mr-2 flex-shrink-0" />
                          <span>{formatDate(initiative.meetingDate)}</span>
                        </div>
                        <div className="flex items-center text-sm text-muted-foreground">
                          <Clock className="h-4 w-4 mr-2 flex-shrink-0" />
                          <span>{formatTime(initiative.meetingTime)}</span>
                        </div>
                      </div>

                      {/* Organizer Info */}
                      <div className="flex items-center gap-3 mb-4 p-3 bg-secondary/50 rounded-lg">
                        <div className="h-8 w-8 rounded-full overflow-hidden bg-gray-200 dark:bg-gray-700 flex-shrink-0">
                          {initiative.organizerAvatar ? (
                            <img 
                              src={initiative.organizerAvatar} 
                              alt={initiative.organizer}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <User className="h-4 w-4 text-muted-foreground" />
                            </div>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">{initiative.organizer}</p>
                          <p className="text-xs text-muted-foreground">Initiative Organizer</p>
                        </div>
                      </div>

                      {/* Volunteers Progress */}
                      <div className="mb-4">
                        <div className="flex justify-between text-sm mb-2">
                          <span className="text-muted-foreground">Volunteers</span>
                          <span className="font-medium">
                            {initiative.volunteersCount}/{initiative.volunteersNeeded}
                          </span>
                        </div>
                        <div className="w-full bg-secondary rounded-full h-2">
                          <div 
                            className="bg-primary h-2 rounded-full transition-all duration-300"
                            style={{ 
                              width: `${Math.min((initiative.volunteersCount / initiative.volunteersNeeded) * 100, 100)}%` 
                            }}
                          ></div>
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex gap-2">
                        {currentUser && initiative.volunteers.includes(currentUser.id) ? (
                          <Button 
                            className="flex-1"
                            variant="outline"
                            onClick={() => handleLeaveInitiative(initiative.id)}
                          >
                            <Users className="mr-2 h-4 w-4" />
                            Leave Initiative
                          </Button>
                        ) : (
                          <Button 
                            className="flex-1"
                            onClick={() => handleVolunteer(initiative.id)}
                            disabled={initiative.volunteersCount >= initiative.volunteersNeeded}
                          >
                            <UserPlus className="mr-2 h-4 w-4" />
                            {initiative.volunteersCount >= initiative.volunteersNeeded ? 'Full' : 'Volunteer'}
                          </Button>
                        )}
                        <Button variant="outline" size="sm">
                          <MessageCircle className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="col-span-full text-center py-16">
                  <Target className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-xl font-semibold mb-2">No initiatives found</h3>
                  <p className="text-muted-foreground mb-6">
                    {filter === 'all' 
                      ? "Be the first to start a community initiative!"
                      : filter === 'open'
                      ? "No open initiatives right now. Start one!"
                      : "You haven't joined any initiatives yet."
                    }
                  </p>
                  <Button onClick={() => setShowCreateForm(true)}>
                    <Plus className="mr-2 h-4 w-4" />
                    Start an Initiative
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-secondary/80 py-8 px-4 md:px-6">
        <div className="container mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="flex items-center mb-4 md:mb-0">
              <div className="h-6 w-6 rounded-full bg-primary flex items-center justify-center mr-2">
                <Heart className="h-3 w-3 text-white" />
              </div>
              <span className="text-lg font-semibold">Community Initiatives</span>
            </div>
            <p className="text-sm text-muted-foreground">
              Together we can solve any problem
            </p>
          </div>
        </div>
      </footer>

      {/* Auth Modal */}
      <AuthModal 
        isOpen={authModalOpen} 
        onClose={() => setAuthModalOpen(false)}
        redirectTo="/events"
      />
    </div>
  );
};

export default Events;
