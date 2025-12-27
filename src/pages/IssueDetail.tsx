
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MapPin, Calendar, ArrowLeft, Send, ThumbsUp, MessageSquare, AlertCircle, CheckCircle, Clock, Eye, X, Trash2 } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import Navbar from '@/components/Navbar';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { supabase } from '@/lib/supabase';
import CitizenFeedbackModal from '@/components/CitizenFeedbackModal';

// Helper functions
const getStatusIcon = (status) => {
  switch (status) {
    case 'resolved':
      return <CheckCircle className="h-5 w-5 text-green-500" />;
    case 'in_progress':
      return <Clock className="h-5 w-5 text-yellow-500" />;
    default:
      return <AlertCircle className="h-5 w-5 text-red-500" />;
  }
};

const getStatusText = (status) => {
  switch (status) {
    case 'resolved':
      return 'Resolved';
    case 'in_progress':
      return 'In Progress';
    case 'assigned':
      return 'Assigned';
    default:
      return 'Pending';
  }
};

const getStatusColor = (status) => {
  switch (status) {
    case 'resolved':
      return 'bg-green-100 text-green-800 border-green-200';
    case 'in_progress':
      return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    case 'assigned':
      return 'bg-blue-100 text-blue-800 border-blue-200';
    default:
      return 'bg-red-100 text-red-800 border-red-200';
  }
};

const IssueDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const { toast } = useToast();
  const [comment, setComment] = useState('');
  const [comments, setComments] = useState([]);
  const [issue, setIssue] = useState(null);
  const [loading, setLoading] = useState(true);
  const [upvoted, setUpvoted] = useState(false);
  const [upvoteCount, setUpvoteCount] = useState(0);
  const [viewCount, setViewCount] = useState(0);
  const [commentModalOpen, setCommentModalOpen] = useState(false);
  const [commentSubmitting, setCommentSubmitting] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [feedbackModalOpen, setFeedbackModalOpen] = useState(false);

  // Fetch issue data and track views
  const fetchIssue = async () => {
    if (!id) return;
    
    try {
      const { data, error } = await supabase
        .from('issues')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      
      setIssue(data);
      setUpvoteCount(data.volunteers_count || 0);
      setViewCount(data.view_count || 0);
      
      // Increment view count only on first load
      if (loading) {
        await incrementViewCount();
      }
      
      // Check if user has upvoted (you can implement this with a separate table)
      // For now, we'll use localStorage as a simple solution
      const userUpvotes = JSON.parse(localStorage.getItem('userUpvotes') || '[]');
      setUpvoted(userUpvotes.includes(id));
      
    } catch (error) {
      console.error('Error fetching issue:', error);
      toast({
        title: "Error loading issue",
        description: "Failed to load issue details",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchIssue();
  }, [id, toast]);

  // Increment view count
  const incrementViewCount = async () => {
    try {
      const { error } = await supabase.rpc('increment_view_count', {
        issue_id: id
      });
      
      if (error) {
        // Fallback: manual increment
        const { data: currentIssue } = await supabase
          .from('issues')
          .select('view_count')
          .eq('id', id)
          .single();
          
        if (currentIssue) {
          const newViewCount = (currentIssue.view_count || 0) + 1;
          await supabase
            .from('issues')
            .update({ view_count: newViewCount })
            .eq('id', id);
          setViewCount(newViewCount);
        }
      }
    } catch (error) {
      console.error('Error incrementing view count:', error);
    }
  };

  // Real-time subscription for upvotes and comments
  useEffect(() => {
    if (!id) return;

    const subscription = supabase
      .channel(`issue-${id}`)
      .on('postgres_changes', 
        { 
          event: 'UPDATE', 
          schema: 'public', 
          table: 'issues',
          filter: `id=eq.${id}`
        }, 
        (payload) => {
          console.log('Real-time update:', payload);
          if (payload.new) {
            setUpvoteCount(payload.new.volunteers_count || 0);
            setViewCount(payload.new.view_count || 0);
          }
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [id]);

  // Handle upvote with real-time updates
  const handleUpvote = async () => {
    if (!currentUser) {
      toast({
        title: "Authentication required",
        description: "Please sign in to upvote issues",
        variant: "destructive",
      });
      return;
    }

    try {
      const newUpvoteState = !upvoted;
      const newCount = newUpvoteState ? upvoteCount + 1 : upvoteCount - 1;
      
      // Update database
      const { error } = await supabase
        .from('issues')
        .update({ volunteers_count: newCount })
        .eq('id', id);

      if (error) throw error;

      // Update local state
      setUpvoted(newUpvoteState);
      setUpvoteCount(newCount);
      
      // Store user's upvote in localStorage (in production, use a proper user_upvotes table)
      const userUpvotes = JSON.parse(localStorage.getItem('userUpvotes') || '[]');
      if (newUpvoteState) {
        userUpvotes.push(id);
      } else {
        const index = userUpvotes.indexOf(id);
        if (index > -1) userUpvotes.splice(index, 1);
      }
      localStorage.setItem('userUpvotes', JSON.stringify(userUpvotes));
      
      toast({
        title: newUpvoteState ? "Issue upvoted!" : "Upvote removed",
        description: newUpvoteState ? "Thanks for supporting this issue!" : "You removed your upvote",
      });
    } catch (error) {
      console.error('Error updating upvote:', error);
      toast({
        title: "Error",
        description: "Failed to update upvote",
        variant: "destructive",
      });
    }
  };
  
  // Handle comment submission
  const handleCommentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!currentUser) {
      toast({
        title: "Authentication required",
        description: "Please sign in to comment",
        variant: "destructive",
      });
      return;
    }
    
    if (!comment.trim()) return;
    
    setCommentSubmitting(true);
    
    try {
      const newComment = {
        id: `c${Date.now()}`,
        user: { 
          name: currentUser.displayName || currentUser.email?.split('@')[0] || "Anonymous User", 
          avatar: currentUser.photoURL || "" 
        },
        content: comment.trim(),
        timestamp: "Just now",
        created_at: new Date().toISOString()
      };
      
      // Add comment to local state immediately for better UX
      setComments(prev => [...prev, newComment]);
      
      // Update comment count in database
      const newCommentCount = comments.length + 1;
      await supabase
        .from('issues')
        .update({ comments_count: newCommentCount })
        .eq('id', id);
      
      setComment('');
      setCommentModalOpen(false);
      
      toast({
        title: "Comment Posted",
        description: "Your comment has been added to the discussion.",
      });
    } catch (error) {
      console.error('Error posting comment:', error);
      toast({
        title: "Error",
        description: "Failed to post comment. Please try again.",
        variant: "destructive",
      });
    } finally {
      setCommentSubmitting(false);
    }
  };

  // Open comment modal
  const handleCommentClick = () => {
    if (!currentUser) {
      toast({
        title: "Authentication required",
        description: "Please sign in to comment",
        variant: "destructive",
      });
      return;
    }
    setCommentModalOpen(true);
  };

  // Handle issue deletion
  const handleDeleteIssue = async () => {
    if (!currentUser || !issue) return;

    // Check if current user is the creator
    if (issue.created_by !== currentUser.id) {
      toast({
        title: "Permission denied",
        description: "You can only delete issues you created",
        variant: "destructive",
      });
      return;
    }

    setIsDeleting(true);
    try {
      // Delete the issue from database
      const { error } = await supabase
        .from('issues')
        .delete()
        .eq('id', id)
        .eq('created_by', currentUser.id); // Extra security check

      if (error) throw error;

      toast({
        title: "Issue Deleted",
        description: "Your issue has been successfully deleted",
      });

      // Navigate back to issues page
      navigate('/issues');
    } catch (error) {
      console.error('Error deleting issue:', error);
      toast({
        title: "Delete Failed",
        description: "Failed to delete the issue. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
      setDeleteModalOpen(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen">
        <Navbar />
        <div className="pt-32 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p>Loading issue details...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!issue) {
    return (
      <div className="min-h-screen">
        <Navbar />
        <div className="pt-32 flex items-center justify-center">
          <div className="text-center">
            <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Issue not found</h2>
            <p className="text-gray-600 mb-4">The issue you're looking for doesn't exist.</p>
            <Button onClick={() => navigate('/issues')}>Back to Issues</Button>
          </div>
        </div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen">
      <Navbar />
      
      <div className="pt-32 pb-20 px-4 md:px-6 container mx-auto">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <button 
              onClick={() => navigate('/issues')}
              className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4 mr-1" />
              <span>Back to Issues</span>
            </button>

            {/* Delete button - only show for issue creator */}
            {currentUser && issue && issue.created_by === currentUser.id && (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setDeleteModalOpen(true)}
                className="flex items-center gap-2"
              >
                <Trash2 className="h-4 w-4" />
                Delete Issue
              </Button>
            )}
          </div>
          
          {/* Issue Image */}
          <div className="rounded-xl overflow-hidden mb-6">
            <div className="h-64 md:h-80 bg-secondary flex items-center justify-center overflow-hidden">
              {issue.image ? (
                <img 
                  src={issue.image} 
                  alt={issue.title} 
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="text-center">
                  <AlertCircle className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500">No image available</p>
                </div>
              )}
            </div>
          </div>
          
          {/* Issue Title and Status */}
          <div className="flex items-start justify-between mb-4">
            <h1 className="text-3xl md:text-4xl font-semibold flex-1 pr-4">{issue.title}</h1>
            <div className="flex items-center gap-2">
              {getStatusIcon(issue.status)}
              <Badge className={`${getStatusColor(issue.status)} border`}>
                {getStatusText(issue.status)}
              </Badge>
            </div>
          </div>

          {/* Citizen Feedback Button - Show only for resolved issues created by current user */}
          {issue.status === 'resolved' && currentUser && issue.created_by === currentUser.id && !issue.citizen_feedback && (
            <div className="bg-gradient-to-r from-green-50 to-blue-50 dark:from-green-900/20 dark:to-blue-900/20 border-2 border-green-200 dark:border-green-800 rounded-xl p-6 mb-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                    ✅ This issue has been marked as resolved!
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                    Please let us know if you're satisfied with the resolution. Your feedback helps us improve our service.
                  </p>
                  <button
                    onClick={() => setFeedbackModalOpen(true)}
                    className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                  >
                    Rate This Resolution
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Show feedback if already provided */}
          {issue.citizen_feedback && (
            <div className={`border-2 rounded-xl p-6 mb-6 ${
              issue.citizen_feedback === 'satisfied'
                ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
            }`}>
              <div className="flex items-start gap-3">
                {issue.citizen_feedback === 'satisfied' ? (
                  <CheckCircle className="w-6 h-6 text-green-600 flex-shrink-0 mt-1" />
                ) : (
                  <AlertCircle className="w-6 h-6 text-red-600 flex-shrink-0 mt-1" />
                )}
                <div className="flex-1">
                  <h3 className="text-lg font-semibold mb-2">
                    {issue.citizen_feedback === 'satisfied' 
                      ? '✅ Citizen Satisfied' 
                      : '❌ Citizen Not Satisfied'}
                  </h3>
                  {issue.citizen_feedback_comment && (
                    <p className="text-sm text-gray-700 dark:text-gray-300 mb-2">
                      "{issue.citizen_feedback_comment}"
                    </p>
                  )}
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Feedback provided on {new Date(issue.citizen_feedback_at).toLocaleDateString()}
                  </p>
                </div>
              </div>
            </div>
          )}
          
          {/* Issue Meta Information */}
          <div className="flex flex-wrap gap-4 mb-6">
            <div className="flex items-center text-sm text-muted-foreground">
              <Calendar className="h-4 w-4 mr-1.5" />
              <span>Reported {new Date(issue.created_at).toLocaleDateString()}</span>
            </div>
            
            <div className="flex items-center text-sm text-muted-foreground">
              <MapPin className="h-4 w-4 mr-1.5" />
              <span>{issue.location}</span>
            </div>
            
            <Badge variant="outline" className="text-xs">
              {issue.category}
            </Badge>
          </div>
          
          {/* Issue Description */}
          <div className="bg-card border rounded-xl p-6 mb-8">
            <div className="prose prose-sm max-w-none">
              {issue.description.split('\n\n').map((paragraph, index) => (
                <p key={index} className="mb-4 text-foreground/90 leading-relaxed">
                  {paragraph}
                </p>
              ))}
            </div>
          </div>
          
          {/* Upvote and Engagement Section */}
          <div className="bg-card border rounded-xl p-6 mb-8">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <button
                  onClick={handleUpvote}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                    upvoted 
                      ? 'bg-blue-600 text-white hover:bg-blue-700' 
                      : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                  }`}
                >
                  <ThumbsUp className={`h-4 w-4 ${upvoted ? 'fill-current' : ''}`} />
                  <span>{upvoteCount} upvotes</span>
                </button>
                
                <button
                  onClick={handleCommentClick}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 transition-colors"
                >
                  <MessageSquare className="h-4 w-4" />
                  <span>{comments.length} comments</span>
                </button>

                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Eye className="h-4 w-4" />
                  <span>{viewCount} views</span>
                </div>
              </div>
              
              <div className="text-sm text-muted-foreground">
                Status: <span className="font-medium">{getStatusText(issue.status)}</span>
              </div>
            </div>
          </div>
          
          {/* Comments Section */}
          <div>
            <h2 className="text-2xl font-semibold mb-4">Discussion ({comments.length})</h2>
            
            {comments.length > 0 ? (
              <div className="space-y-6 mb-8">
                {comments.map((comment) => (
                  <div key={comment.id} className="bg-card border rounded-lg p-4">
                    <div className="flex items-start gap-3 mb-2">
                      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                        <div className="font-semibold text-xs text-primary">
                          {comment.user.name.charAt(0)}
                        </div>
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{comment.user.name}</span>
                          <span className="text-xs text-muted-foreground">{comment.timestamp}</span>
                        </div>
                        <p className="text-sm mt-1">{comment.content}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 mb-8">
                <MessageSquare className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600">No comments yet. Be the first to share your thoughts!</p>
              </div>
            )}
            
            {currentUser ? (
              <form onSubmit={handleCommentSubmit} className="bg-card border rounded-lg p-4">
                <h3 className="text-lg font-medium mb-3">Add your comment</h3>
                <div className="mb-3">
                  <textarea
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    className="w-full p-3 rounded-lg border border-input bg-background resize-none"
                    placeholder="Share your thoughts on this issue..."
                    rows={3}
                    required
                  />
                </div>
                <div className="flex justify-end">
                  <Button type="submit" className="flex items-center">
                    <span>Post Comment</span>
                    <Send className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </form>
            ) : (
              <div className="bg-card border rounded-lg p-6 text-center">
                <p className="text-gray-600 mb-4">Sign in to join the discussion</p>
                <Button onClick={() => navigate('/')}>Sign In</Button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Comment Modal */}
      <Dialog open={commentModalOpen} onOpenChange={setCommentModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add a Comment</DialogTitle>
          </DialogHeader>
          
          <form onSubmit={handleCommentSubmit} className="space-y-4">
            <div>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                className="w-full p-3 rounded-lg border border-gray-300 bg-white text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                placeholder="Share your thoughts on this issue..."
                rows={4}
                required
                disabled={commentSubmitting}
              />
            </div>
            
            <div className="flex justify-end gap-3">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => setCommentModalOpen(false)}
                disabled={commentSubmitting}
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={commentSubmitting || !comment.trim()}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {commentSubmitting ? (
                  <span className="flex items-center gap-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Posting...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <Send className="h-4 w-4" />
                    Post Comment
                  </span>
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Modal */}
      <Dialog open={deleteModalOpen} onOpenChange={setDeleteModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <Trash2 className="h-5 w-5" />
              Delete Issue
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-sm text-red-800">
                <strong>Warning:</strong> This action cannot be undone. Deleting this issue will permanently remove it from:
              </p>
              <ul className="mt-2 space-y-1 text-sm text-red-700">
                <li className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 bg-red-500 rounded-full"></div>
                  <span>All issues pages</span>
                </li>
                <li className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 bg-red-500 rounded-full"></div>
                  <span>Your profile and homepage</span>
                </li>
                <li className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 bg-red-500 rounded-full"></div>
                  <span>Authority dashboard</span>
                </li>
                <li className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 bg-red-500 rounded-full"></div>
                  <span>All comments and upvotes</span>
                </li>
              </ul>
            </div>

            <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
              <p className="text-sm text-gray-700">
                <strong>Issue:</strong> {issue?.title}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Reported on {issue && new Date(issue.created_at).toLocaleDateString()}
              </p>
            </div>

            <p className="text-sm text-gray-600">
              Are you sure you want to permanently delete this issue?
            </p>

            <div className="flex justify-end gap-3 pt-2">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => setDeleteModalOpen(false)}
                disabled={isDeleting}
              >
                Cancel
              </Button>
              <Button 
                variant="destructive"
                onClick={handleDeleteIssue}
                disabled={isDeleting}
                className="bg-red-600 hover:bg-red-700"
              >
                {isDeleting ? (
                  <span className="flex items-center gap-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Deleting...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <Trash2 className="h-4 w-4" />
                    Yes, Delete Issue
                  </span>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Citizen Feedback Modal */}
      {issue && (
        <CitizenFeedbackModal
          isOpen={feedbackModalOpen}
          onClose={() => setFeedbackModalOpen(false)}
          issueId={issue.id}
          issueTitle={issue.title}
          onFeedbackSubmitted={() => {
            // Refresh issue data
            fetchIssue();
          }}
        />
      )}
    </div>
  );
};

export default IssueDetail;
