import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Eye, ThumbsUp, MessageSquare, MapPin, Calendar, AlertCircle, CheckCircle, Clock, X, FileText, Image as ImageIcon, Sparkles, Wand2 } from 'lucide-react';
import Navbar from '@/components/Navbar';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectItem, SelectTrigger, SelectValue, SelectContent } from '@/components/ui/select';
import { Camera, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { supabase } from '@/lib/supabase';
import { toast } from '@/hooks/use-toast';
import { analyzeMultipleImagesSimple } from '@/services/simpleVisionService';
import LocationPicker from '@/components/LocationPicker';

const UserHomepage = () => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [userIssues, setUserIssues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [reportModalOpen, setReportModalOpen] = useState(false);
  
  // Report form state
  const [photos, setPhotos] = useState<string[]>([]);
  const [photoFiles, setPhotoFiles] = useState<File[]>([]);
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [location, setLocation] = useState("");
  const [coordinates, setCoordinates] = useState<{ lat: number; lng: number } | null>(null);

  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState<{ description: string; category: string } | null>(null);


  // Auto-fetch user location
  useEffect(() => {
    if (reportModalOpen) {
      navigator.geolocation?.getCurrentPosition(
        (pos) => setLocation(`${pos.coords.latitude}, ${pos.coords.longitude}`),
        () => setLocation("Unable to detect location")
      );
    }
  }, [reportModalOpen]);

  // Fetch user's issues
  useEffect(() => {
    const fetchUserIssues = async () => {
      if (!currentUser) return;
      
      try {
        const { data, error } = await supabase
          .from('issues')
          .select('*')
          .eq('created_by', currentUser.id)
          .order('created_at', { ascending: false });

        if (error) throw error;
        setUserIssues(data || []);
      } catch (error) {
        console.error('Error fetching user issues:', error);
        toast({
          title: "Error loading issues",
          description: "Failed to load your reported issues",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    fetchUserIssues();
  }, [currentUser]);

  // Handle multiple photo uploads with AI analysis
  const handlePhotoChange = async (e, captureType = 'file') => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    // Limit to 5 photos maximum
    const remainingSlots = 5 - photos.length;
    const filesToAdd = files.slice(0, remainingSlots);

    if (files.length > remainingSlots) {
      toast({
        title: "Photo limit reached",
        description: `You can only upload ${remainingSlots} more photo(s). Maximum 5 photos allowed.`,
        variant: "destructive",
      });
    }

    // Create preview URLs and add to state
    const newPhotoUrls = filesToAdd.map(file => URL.createObjectURL(file));
    setPhotos(prev => [...prev, ...newPhotoUrls]);
    setPhotoFiles(prev => [...prev, ...filesToAdd]);

    // Reset input
    e.target.value = '';
  };

  // Analyze photos with Google Vision AI
  const analyzePhotosWithAI = async (files: File[]) => {
    if (files.length === 0) {
      toast({
        title: "No Photos",
        description: "Please upload photos first to generate description.",
        variant: "destructive",
      });
      return;
    }

    setIsAnalyzing(true);
    try {
      const result = await analyzeMultipleImagesSimple(files);
      setAiSuggestion(result);
      
      toast({
        title: "🤖 AI Analysis Complete",
        description: "Smart description and category suggestions generated!",
      });
    } catch (error: any) {
      console.error('AI analysis failed:', error);
      toast({
        title: "AI Analysis Failed",
        description: error.message || "Unable to analyze images. Please add description manually.",
        variant: "destructive",
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Apply AI suggestions
  const applyAISuggestions = () => {
    if (aiSuggestion) {
      setDescription(aiSuggestion.description);
      setCategory(aiSuggestion.category);
      setAiSuggestion(null);
      
      toast({
        title: "AI Suggestions Applied",
        description: "Description and category have been updated with AI suggestions.",
      });
    }
  };

  // Remove photo from list
  const removePhoto = (index: number) => {
    // Revoke object URL to prevent memory leaks
    URL.revokeObjectURL(photos[index]);
    
    setPhotos(prev => prev.filter((_, i) => i !== index));
    setPhotoFiles(prev => prev.filter((_, i) => i !== index));
  };

  // Clear all photos
  const clearAllPhotos = () => {
    photos.forEach(url => URL.revokeObjectURL(url));
    setPhotos([]);
    setPhotoFiles([]);
    setAiSuggestion(null);
  };

  // Convert images to base64 for database storage (temporary solution)
  const convertImagesToBase64 = async (files: File[]): Promise<string[]> => {
    const base64Images: string[] = [];
    
    for (let i = 0; i < files.length && i < 1; i++) { // Only take first image for now
      const file = files[i];
      
      try {
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
        
        base64Images.push(base64);
      } catch (error) {
        console.error('Error converting image to base64:', error);
      }
    }

    return base64Images;
  };

  // Handle report submission
  const handleSubmit = async () => {
    if (!currentUser) {
      toast({
        title: "Authentication required",
        description: "Please sign in to report an issue",
        variant: "destructive",
      });
      return;
    }

    // Basic validation
    if (!description.trim()) {
      toast({
        title: "Description required",
        description: "Please provide a description of the issue",
        variant: "destructive",
      });
      return;
    }

    if (!category) {
      toast({
        title: "Category required",
        description: "Please select a category for the issue",
        variant: "destructive",
      });
      return;
    }

    if (!location.trim()) {
      toast({
        title: "Location required",
        description: "Please provide a location for the issue",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      // Create a title from description (first 50 characters)
      const title = description.length > 50 ? description.substring(0, 47) + "..." : description;
      
      // Map category values to display names
      const categoryMap = {
        pothole: "Infrastructure",
        streetlight: "Electricity", 
        waste: "Trash",
        water: "Water",
        others: "Other"
      };

      // Convert images if any
      let imageUrls: string[] = [];
      if (photoFiles.length > 0) {
        toast({
          title: "Processing images...",
          description: "Please wait while we process your photos.",
        });
        imageUrls = await convertImagesToBase64(photoFiles);
      }

      // Submit issue to database
      const { data, error } = await supabase
        .from('issues')
        .insert([
          {
            title: title,
            description: description,
            location: location,
            category: categoryMap[category] || "Other",
            image: imageUrls.length > 0 ? imageUrls[0] : null, // Primary image (first uploaded image)
            created_by: currentUser.id,
            status: 'reported',
            comments_count: 0,
            volunteers_count: 0,
            created_at: new Date().toISOString(),
          }
        ])
        .select();

      if (error) throw error;

      setSubmitted(true);
      toast({
        title: "Issue reported successfully!",
        description: "Your report has been submitted and will be reviewed.",
      });

      // Add the new issue to the list
      if (data && data[0]) {
        setUserIssues(prev => [data[0], ...prev]);
      }

      // Reset form and close modal after 2 seconds
      setTimeout(() => {
        setReportModalOpen(false);
        setSubmitted(false);
        setDescription("");
        setCategory("");
        setLocation("");
        setCoordinates(null);
        setAiSuggestion(null);
        clearAllPhotos();
      }, 2000);

    } catch (error) {
      console.error("Error submitting issue:", error);
      toast({
        title: "Failed to submit report",
        description: "An error occurred while submitting your report. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'resolved':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'in_progress':
        return <Clock className="h-4 w-4 text-yellow-500" />;
      default:
        return <AlertCircle className="h-4 w-4 text-red-500" />;
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

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Navbar />
      
      <div className="flex-1 pt-20">
        {/* Header */}
        <div className="bg-white shadow-sm border-b">
          <div className="container mx-auto px-4 py-6">
            <div className="flex justify-between items-center">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">My Reported Issues</h1>
                <p className="text-gray-600 mt-1">Track and manage your community reports</p>
              </div>
              <Button 
                onClick={() => setReportModalOpen(true)}
                className="bg-blue-600 hover:bg-blue-700"
              >
                <Plus className="h-4 w-4 mr-2" />
                Report Issue
              </Button>
            </div>
          </div>
        </div>

        {/* Issues List */}
        <div className="container mx-auto px-4 py-8">
          {userIssues.length === 0 ? (
            <div className="text-center py-12">
              <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No issues reported yet</h3>
              <p className="text-gray-600 mb-6">Start by reporting your first community issue</p>
              <Button onClick={() => setReportModalOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Report Your First Issue
              </Button>
            </div>
          ) : (
            <div className="grid gap-6">
              {userIssues.map((issue) => (
                <Card key={issue.id} className="overflow-hidden hover:shadow-md transition-shadow">
                  <CardContent className="p-6">
                    <div className="flex gap-6">
                      {/* Issue Image */}
                      <div className="flex-shrink-0">
                        {issue.image ? (
                          <img 
                            src={issue.image} 
                            alt={issue.title}
                            className="w-24 h-24 rounded-lg object-cover"
                          />
                        ) : (
                          <div className="w-24 h-24 rounded-lg bg-gray-200 flex items-center justify-center">
                            <AlertCircle className="h-8 w-8 text-gray-400" />
                          </div>
                        )}
                      </div>

                      {/* Issue Details */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between mb-2">
                          <h3 className="text-lg font-semibold text-gray-900 truncate pr-4">
                            {issue.title}
                          </h3>
                          <div className="flex items-center gap-2">
                            {getStatusIcon(issue.status)}
                            <Badge className={`${getStatusColor(issue.status)} border`}>
                              {getStatusText(issue.status)}
                            </Badge>
                          </div>
                        </div>

                        <p className="text-gray-600 mb-3 line-clamp-2">
                          {issue.description}
                        </p>

                        <div className="flex items-center gap-4 text-sm text-gray-500 mb-4">
                          <div className="flex items-center gap-1">
                            <MapPin className="h-4 w-4" />
                            <span className="truncate">{issue.location}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Calendar className="h-4 w-4" />
                            <span>{new Date(issue.created_at).toLocaleDateString()}</span>
                          </div>
                          <Badge variant="outline" className="text-xs">
                            {issue.category}
                          </Badge>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4 text-sm text-gray-500">
                            <div className="flex items-center gap-1">
                              <ThumbsUp className="h-4 w-4" />
                              <span>{issue.volunteers_count || 0} upvotes</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <MessageSquare className="h-4 w-4" />
                              <span>{issue.comments_count || 0} comments</span>
                            </div>
                          </div>
                          
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => navigate(`/issues/${issue.id}`)}
                          >
                            <Eye className="h-4 w-4 mr-1" />
                            View Issue
                          </Button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Report Issue Modal */}
      <Dialog open={reportModalOpen} onOpenChange={setReportModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-center">Report a Civic Issue</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-6">
            {/* Enhanced Photo Upload Section */}
            <div>
              <label className="block mb-3 text-gray-700 font-medium">
                Add Photos ({photos.length}/5)
              </label>
              
              {/* Photo Upload Options */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
                {/* Live Camera Capture */}
                <label className="cursor-pointer flex flex-col items-center gap-2 bg-blue-600 hover:bg-blue-700 p-4 rounded-lg text-white text-sm transition-colors">
                  <Camera className="w-6 h-6" />
                  <span className="text-center">Live Capture</span>
                  <input 
                    type="file" 
                    accept="image/*" 
                    capture="environment"
                    multiple
                    onChange={(e) => handlePhotoChange(e, 'camera')} 
                    className="hidden"
                    disabled={photos.length >= 5}
                  />
                </label>

                {/* File Upload */}
                <label className="cursor-pointer flex flex-col items-center gap-2 bg-green-600 hover:bg-green-700 p-4 rounded-lg text-white text-sm transition-colors">
                  <FileText className="w-6 h-6" />
                  <span className="text-center">Upload Files</span>
                  <input 
                    type="file" 
                    accept="image/*"
                    multiple
                    onChange={(e) => handlePhotoChange(e, 'file')} 
                    className="hidden"
                    disabled={photos.length >= 5}
                  />
                </label>

                {/* Gallery Selection */}
                <label className="cursor-pointer flex flex-col items-center gap-2 bg-purple-600 hover:bg-purple-700 p-4 rounded-lg text-white text-sm transition-colors">
                  <ImageIcon className="w-6 h-6" />
                  <span className="text-center">From Gallery</span>
                  <input 
                    type="file" 
                    accept="image/*"
                    multiple
                    onChange={(e) => handlePhotoChange(e, 'gallery')} 
                    className="hidden"
                    disabled={photos.length >= 5}
                  />
                </label>
              </div>

              {/* Photo Preview Grid */}
              {photos.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700">
                      Uploaded Photos ({photos.length})
                    </span>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={clearAllPhotos}
                      className="text-red-600 hover:text-red-700"
                    >
                      Clear All
                    </Button>
                  </div>
                  
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {photos.map((photoUrl, index) => (
                      <div key={index} className="relative group">
                        <img 
                          src={photoUrl} 
                          alt={`Preview ${index + 1}`}
                          className="w-full h-24 sm:h-32 rounded-lg object-cover border-2 border-gray-200 hover:border-blue-400 transition-colors" 
                        />
                        <button
                          type="button"
                          onClick={() => removePhoto(index)}
                          className="absolute -top-2 -right-2 bg-red-500 hover:bg-red-600 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X className="w-4 h-4" />
                        </button>
                        <div className="absolute bottom-1 left-1 bg-black bg-opacity-50 text-white text-xs px-2 py-1 rounded">
                          {index + 1}
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  <p className="text-xs text-gray-500 text-center">
                    Click on photos to view larger. Use the X button to remove individual photos.
                  </p>
                </div>
              )}

              {photos.length === 0 && (
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                  <Camera className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                  <p className="text-gray-500 text-sm">
                    No photos added yet. Choose from the options above to add up to 5 photos.
                  </p>
                </div>
              )}
            </div>

            {/* AI Suggestions Panel */}
            {aiSuggestion && (
              <div className="bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles className="h-5 w-5 text-blue-600" />
                  <span className="font-medium text-blue-800">AI Smart Suggestions</span>
                  {isAnalyzing && (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                  )}
                </div>
                
                <div className="space-y-2 mb-3">
                  <div>
                    <span className="text-sm font-medium text-gray-700">Suggested Description:</span>
                    <p className="text-sm text-gray-600 bg-white p-2 rounded border">{aiSuggestion.description}</p>
                  </div>
                  <div>
                    <span className="text-sm font-medium text-gray-700">Suggested Category:</span>
                    <span className="ml-2 text-sm bg-blue-100 text-blue-800 px-2 py-1 rounded">
                      {aiSuggestion.category}
                    </span>
                  </div>
                </div>
                
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    onClick={applyAISuggestions}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    <Wand2 className="h-4 w-4 mr-1" />
                    Apply Suggestions
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setAiSuggestion(null)}
                  >
                    Dismiss
                  </Button>
                </div>
              </div>
            )}

            {/* Description */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-gray-700 font-medium">Description</label>
                {photos.length > 0 && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => analyzePhotosWithAI(photoFiles)}
                    disabled={isAnalyzing}
                    className="text-blue-600 hover:text-blue-700"
                  >
                    {isAnalyzing ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                        Analyzing...
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4 mr-1" />
                        Generate Description
                      </>
                    )}
                  </Button>
                )}
              </div>
              <Textarea
                placeholder="Describe the issue briefly or use AI to generate from photos"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="min-h-[100px]"
              />
            </div>

            {/* Category */}
            <div>
              <label className="block mb-2 text-gray-700 font-medium">Category</label>
              <Select onValueChange={(value) => setCategory(value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select issue category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="infrastructure">🚧 Infrastructure & Roads</SelectItem>
                  <SelectItem value="streetlight">💡 Street Lighting</SelectItem>
                  <SelectItem value="waste">🗑️ Waste Management</SelectItem>
                  <SelectItem value="water">💧 Water & Drainage</SelectItem>
                  <SelectItem value="transportation">🚌 Transportation</SelectItem>
                  <SelectItem value="parks">🌳 Parks & Recreation</SelectItem>
                  <SelectItem value="building">🏢 Building & Construction</SelectItem>
                  <SelectItem value="safety">🚨 Safety & Security</SelectItem>
                  <SelectItem value="noise">🔊 Noise Pollution</SelectItem>
                  <SelectItem value="environment">🌱 Environmental</SelectItem>
                  <SelectItem value="utilities">⚡ Utilities</SelectItem>
                  <SelectItem value="others">🔧 Others</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Location Selection */}
            <div>
              <label className="block mb-2 text-gray-700 font-medium flex items-center gap-2">
                <MapPin className="w-4 h-4" /> Location
              </label>
              <LocationPicker
                value={location}
                onChange={(newLocation, coords) => {
                  setLocation(newLocation);
                  if (coords) {
                    setCoordinates(coords);
                  }
                }}
                placeholder="Enter location or use GPS/Map"
              />
            </div>



            {/* Submit Button */}
            <div className="flex justify-end gap-3 pt-4">
              <Button 
                variant="outline" 
                onClick={() => setReportModalOpen(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="bg-pink-600 hover:bg-pink-700"
              >
                {isSubmitting ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Submitting...
                  </span>
                ) : (
                  "Submit Report"
                )}
              </Button>
            </div>

            {/* Success Message */}
            {submitted && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-center flex flex-col items-center p-4 bg-green-50 rounded-lg"
              >
                <CheckCircle className="w-10 h-10 text-green-500 mb-2" />
                <p className="text-green-700 font-medium">Report submitted successfully! You'll receive updates shortly.</p>
              </motion.div>
            )}
          </div>
        </DialogContent>
      </Dialog>


    </div>
  );
};

export default UserHomepage;