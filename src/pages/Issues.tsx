
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Filter, Plus, MapPin, SlidersHorizontal, Loader2 } from 'lucide-react';
import Navbar from '@/components/Navbar';
import Button from '@/components/Button';
import IssueCard from '@/components/IssueCard';
import SuccessStoriesShowcase from '@/components/SuccessStoriesShowcase';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import AuthModal from '@/components/AuthModal';
import { supabase } from '@/lib/supabase';
import { toast } from '@/hooks/use-toast';

// Sample data (fallback)
const issuesData = [
  {
    id: "1",
    title: "Broken Park Benches in Willowbrook Park",
    description: "Several park benches in Willowbrook Park have been damaged and need repair. This has been an ongoing issue for several months, making it difficult for elderly visitors to enjoy the park.",
    location: "Willowbrook Park, Main Avenue",
    category: "Infrastructure",
    image: "https://images.unsplash.com/photo-1604357209793-fca5dca89f97?q=80&w=800&auto=format&fit=crop",
    date: "2 days ago",
    commentsCount: 15,
    volunteersCount: 12
  },
  {
    id: "2",
    title: "Overflowing Trash Bins on Cedar Street",
    description: "The trash bins on Cedar Street have been overflowing for weeks now, causing litter to spread across the neighborhood.",
    location: "Cedar Street, Downtown",
    category: "Trash",
    image: "https://images.unsplash.com/photo-1605600659873-d808a13e4e4e?q=80&w=800&auto=format&fit=crop",
    date: "1 day ago",
    commentsCount: 8,
    volunteersCount: 5
  },
  {
    id: "3",
    title: "Water Shortage in Maple Garden Community",
    description: "Our community garden has been suffering from water shortage for the past week, endangering all the plants we've grown.",
    location: "Maple Garden, East Side",
    category: "Water",
    image: "https://images.unsplash.com/photo-1543674892-7d64d45facad?q=80&w=800&auto=format&fit=crop",
    date: "3 days ago",
    commentsCount: 12,
    volunteersCount: 7
  },
  {
    id: "4",
    title: "Drainage Blockage After Recent Rainfall",
    description: "The recent heavy rainfall has caused severe drainage blockage on Pine Road, creating large puddles and making it difficult to walk.",
    location: "Pine Road, North District",
    category: "Drainage",
    image: "https://images.unsplash.com/photo-1597435877854-a461fb2dd9f2?q=80&w=800&auto=format&fit=crop",
    date: "4 days ago",
    commentsCount: 5,
    volunteersCount: 3
  },
  {
    id: "5",
    title: "Faulty Street Lights on Maple Avenue",
    description: "Several street lights on Maple Avenue have stopped working, creating safety concerns for residents walking at night.",
    location: "Maple Avenue, West District",
    category: "Infrastructure",
    image: "https://images.unsplash.com/photo-1621556712457-1ec8a586daa7?q=80&w=800&auto=format&fit=crop",
    date: "5 days ago",
    commentsCount: 9,
    volunteersCount: 4
  },
  {
    id: "6",
    title: "Graffiti on Community Center Wall",
    description: "The wall of our community center has been vandalized with graffiti. We need to clean it up and perhaps install better security.",
    location: "Community Center, Central Park",
    category: "Other",
    image: "https://images.unsplash.com/photo-1601325979086-d54da2c7419c?q=80&w=800&auto=format&fit=crop",
    date: "1 week ago",
    commentsCount: 7,
    volunteersCount: 8
  }
];

const categories = ["All", "Infrastructure", "Electricity", "Trash", "Water", "Other"];
const sortOptions = ["Newest", "Most Comments", "Most Volunteers", "Oldest"];

const Issues = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [sortBy, setSortBy] = useState('Newest');
  const [isFilterExpanded, setIsFilterExpanded] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [issues, setIssues] = useState([]);
  const [loading, setLoading] = useState(true);

  // Handle upvote updates from IssueCard
  const handleUpvoteUpdate = (issueId: string, newCount: number) => {
    setIssues(prevIssues => 
      prevIssues.map(issue => 
        issue.id === issueId 
          ? { ...issue, volunteersCount: newCount }
          : issue
      )
    );
  };

  // Fetch issues from Supabase
  const fetchIssues = async () => {
    setLoading(true);
    try {
      // Fetch only active issues (exclude resolved and closed ones)
      const { data, error } = await supabase
        .from('issues')
        .select('*')
        .not('status', 'in', '("resolved","closed","pending_approval")') // Exclude resolved, closed, and pending approval issues
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Transform data to match the expected format
      const transformedIssues = data.map(issue => {
        return {
          id: issue.id,
          title: issue.title,
          description: issue.description,
          location: issue.location,
          category: issue.category,
          image: issue.image || "https://images.unsplash.com/photo-1604357209793-fca5dca89f97?q=80&w=800&auto=format&fit=crop", // Default image if none
          images: issue.images || (issue.image ? [issue.image] : []), // Multiple images support
          date: formatDate(issue.created_at),
          commentsCount: issue.comments_count || 0,
          volunteersCount: issue.volunteers_count || 0,
          status: issue.status
        };
      });

      setIssues(transformedIssues);
    } catch (error) {
      console.error('Error fetching issues:', error);
      toast({
        title: "Error loading issues",
        description: "Failed to load community issues. Please try again.",
        variant: "destructive",
      });
      // Fallback to sample data if database fails
      setIssues(issuesData);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchIssues();
  }, []);

  // Refresh issues when component becomes visible (user navigates back)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        fetchIssues();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  // Real-time subscription for all issues updates
  useEffect(() => {
    const subscription = supabase
      .channel('issues-updates')
      .on('postgres_changes', 
        { 
          event: 'UPDATE', 
          schema: 'public', 
          table: 'issues'
        }, 
        (payload) => {
          console.log('Real-time issue update:', payload);
          if (payload.new) {
            const newStatus = payload.new.status;
            
            // If issue is resolved, closed, or pending approval, remove it from the list
            if (newStatus === 'resolved' || newStatus === 'closed' || newStatus === 'pending_approval') {
              console.log(`Issue ${payload.new.id} status changed to ${newStatus}, removing from list`);
              setIssues(prevIssues => 
                prevIssues.filter(issue => issue.id !== payload.new.id)
              );
              
              // Show toast notification
              toast({
                title: "Issue Updated",
                description: `An issue has been marked as ${newStatus.replace('_', ' ')} and removed from active issues`,
              });
            } else {
              // Otherwise, update the issue in the list
              setIssues(prevIssues => 
                prevIssues.map(issue => 
                  issue.id === payload.new.id 
                    ? {
                        ...issue,
                        volunteersCount: payload.new.volunteers_count || 0,
                        commentsCount: payload.new.comments_count || 0,
                        status: payload.new.status
                      }
                    : issue
                )
              );
            }
          }
        }
      )
      .on('postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'issues'
        },
        (payload) => {
          console.log('New issue created:', payload);
          if (payload.new) {
            const newIssue = payload.new;
            
            // Only add if it's not resolved, closed, or pending approval
            if (newIssue.status !== 'resolved' && newIssue.status !== 'closed' && newIssue.status !== 'pending_approval') {
              const transformedIssue = {
                id: newIssue.id,
                title: newIssue.title,
                description: newIssue.description,
                location: newIssue.location,
                category: newIssue.category,
                image: newIssue.image || "https://images.unsplash.com/photo-1604357209793-fca5dca89f97?q=80&w=800&auto=format&fit=crop",
                images: newIssue.images || (newIssue.image ? [newIssue.image] : []), // Multiple images support
                date: formatDate(newIssue.created_at),
                commentsCount: newIssue.comments_count || 0,
                volunteersCount: newIssue.volunteers_count || 0,
                status: newIssue.status
              };
              
              setIssues(prevIssues => [transformedIssue, ...prevIssues]);
              
              toast({
                title: "New Issue Reported",
                description: "A new issue has been added to the community",
              });
            }
          }
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Helper function to format date
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 1) return '1 day ago';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.ceil(diffDays / 7)} week${Math.ceil(diffDays / 7) > 1 ? 's' : ''} ago`;
    return date.toLocaleDateString();
  };
  
  const handleReportIssue = () => {
    if (currentUser) {
      // User is logged in, navigate to report page
      navigate('/issues/report');
    } else {
      // User is not logged in, show auth modal
      setAuthModalOpen(true);
    }
  };

  // Filter and sort issues
  const filteredIssues = issues.filter(issue => {
    const matchesSearch = issue.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                         issue.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         issue.location.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesCategory = selectedCategory === 'All' || issue.category === selectedCategory;
    
    return matchesSearch && matchesCategory;
  }).sort((a, b) => {
    switch (sortBy) {
      case 'Most Comments':
        return b.commentsCount - a.commentsCount;
      case 'Most Volunteers':
        return b.volunteersCount - a.volunteersCount;
      case 'Oldest':
        return new Date(a.date).getTime() - new Date(b.date).getTime();
      default: // Newest
        return new Date(b.date).getTime() - new Date(a.date).getTime();
    }
  });
  
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      
      <div className="pt-28 pb-20 flex-1">
        {/* Header */}
        <div className="container mx-auto px-4 md:px-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
            <div>
              <h1 className="text-3xl font-semibold mb-2">Community Issues</h1>
              <p className="text-muted-foreground">Browse and discover issues in your neighborhood</p>
            </div>
            <div className="flex gap-3">
              <Button 
                variant="outline" 
                className="flex-shrink-0"
                onClick={() => setIsFilterExpanded(!isFilterExpanded)}
              >
                <SlidersHorizontal className="h-4 w-4 mr-2" />
                Filters
              </Button>
              <Button 
                onClick={handleReportIssue}
                title={!currentUser ? "Sign in to report an issue" : "Report a new issue"}
                className={!currentUser ? "opacity-90" : ""}
              >
                <Plus className="h-4 w-4 mr-2" />
                {!currentUser ? "Sign in to Report" : "Report Issue"}
              </Button>
            </div>
          </div>
          
          {/* Search and Filter */}
          <div className="bg-card rounded-xl shadow-subtle p-5 mb-8">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search issues by title, description or location..."
                className="w-full pl-10 pr-4 py-3 rounded-lg border border-input bg-background focus:outline-none focus:ring-2 focus:ring-primary/20"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            
            {isFilterExpanded && (
              <div className="mt-4 pt-4 border-t border-border/30 grid grid-cols-1 md:grid-cols-2 gap-4 animate-slide-down">
                <div>
                  <label className="block text-sm font-medium mb-2">Category</label>
                  <div className="flex flex-wrap gap-2">
                    {categories.map(category => (
                      <button
                        key={category}
                        className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                          selectedCategory === category
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
                        }`}
                        onClick={() => setSelectedCategory(category)}
                      >
                        {category}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Sort By</label>
                  <div className="flex flex-wrap gap-2">
                    {sortOptions.map(option => (
                      <button
                        key={option}
                        className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                          sortBy === option
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
                        }`}
                        onClick={() => setSortBy(option)}
                      >
                        {option}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
          
          {/* Success Stories Showcase */}
          <SuccessStoriesShowcase />
          
          {/* Issues Grid */}
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="text-center">
                <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
                <p className="text-muted-foreground">Loading community issues...</p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredIssues.length > 0 ? (
                filteredIssues.map(issue => (
                  <IssueCard 
                    key={issue.id} 
                    {...issue} 
                    onUpvoteUpdate={handleUpvoteUpdate}
                  />
                ))
              ) : (
                <div className="col-span-full py-16 text-center">
                  <div className="max-w-md mx-auto">
                    <Filter className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <h3 className="text-xl font-semibold mb-2">No issues found</h3>
                    <p className="text-muted-foreground mb-6">
                      {issues.length === 0 
                        ? "No issues have been reported yet. Be the first to report a community issue!"
                        : "We couldn't find any issues matching your search criteria. Try adjusting your filters or search query."
                      }
                    </p>
                    <div className="flex gap-3 justify-center">
                      {issues.length > 0 && (
                        <Button 
                          variant="outline" 
                          onClick={() => {
                            setSearchQuery('');
                            setSelectedCategory('All');
                          }}
                        >
                          Clear Filters
                        </Button>
                      )}
                      <Button onClick={handleReportIssue}>
                        <Plus className="h-4 w-4 mr-2" />
                        Report Issue
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Floating Action Button for Mobile */}
      <div className="fixed bottom-6 right-6 z-40 md:hidden">
        <Button 
          onClick={handleReportIssue}
          className="h-14 w-14 rounded-full shadow-lg hover:shadow-xl transition-shadow"
          size="sm"
          title={!currentUser ? "Sign in to report an issue" : "Report a new issue"}
        >
          <Plus className="h-6 w-6" />
        </Button>
      </div>
      
      {/* Footer */}
      <footer className="bg-secondary/80 py-8 px-4 md:px-6">
        <div className="container mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="flex items-center mb-4 md:mb-0">
              <div className="h-6 w-6 rounded-full bg-primary flex items-center justify-center mr-2">
                <MapPin className="h-3 w-3 text-white" />
              </div>
              <span className="text-lg font-semibold">Nagar Setu</span>
            </div>
            <p className="text-sm text-muted-foreground">
              © {new Date().getFullYear()} Nagar Setu. All rights reserved.
            </p>
          </div>
        </div>
      </footer>

      {/* Auth Modal */}
      <AuthModal 
        isOpen={authModalOpen} 
        onClose={() => setAuthModalOpen(false)}
        redirectTo="/issues/report"
      />
    </div>
  );
};

export default Issues;
