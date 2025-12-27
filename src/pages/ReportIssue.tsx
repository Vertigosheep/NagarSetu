
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectItem, SelectTrigger, SelectValue, SelectContent } from "@/components/ui/select";
import { Upload, Camera, MapPin, CheckCircle, Loader2, FileText, Image as ImageIcon, X, Sparkles, Wand2 } from "lucide-react";
import { motion } from "framer-motion";
import { useAuth } from "@/contexts/SupabaseAuthContext";
import { supabase } from "@/lib/supabase";
import { toast } from "@/hooks/use-toast";
import { analyzeMultipleImages, combineImageAnalyses } from "@/services/visionService";
import { checkForDuplicates, DuplicateDetectionResult } from "@/services/duplicateDetectionService";
import LocationPicker from "@/components/LocationPicker";
import DuplicateIssueModal from "@/components/DuplicateIssueModal";
import ImageUploadComponent from "@/components/ImageUploadComponent";

interface ImageFile {
  id: string;
  file: File;
  url: string;
  name: string;
  size: number;
}

export default function ReportIssuePage() {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [imageFiles, setImageFiles] = useState<ImageFile[]>([]);
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [location, setLocation] = useState("");
  const [coordinates, setCoordinates] = useState<{ lat: number; lng: number } | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState<{ description: string; category: string } | null>(null);
  const [isCheckingDuplicates, setIsCheckingDuplicates] = useState(false);
  const [duplicateResult, setDuplicateResult] = useState<DuplicateDetectionResult | null>(null);
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const [skipDuplicateCheck, setSkipDuplicateCheck] = useState(false);

  // Auto-fetch user location
  useEffect(() => {
    navigator.geolocation?.getCurrentPosition(
      (pos) => setLocation(`${pos.coords.latitude}, ${pos.coords.longitude}`),
      () => setLocation("Unable to detect location")
    );
  }, []);

  // Handle image change from ImageUploadComponent
  const handleImagesChange = (files: ImageFile[]) => {
    setImageFiles(files);
    
    // Extract image files for AI analysis
    const imageFilesArray = files.map(f => f.file);
    if (imageFilesArray.length > 0) {
      analyzePhotosWithAI(imageFilesArray);
    }
  };

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

    // Trigger AI analysis for new photos
    if (filesToAdd.length > 0) {
      analyzePhotosWithAI(filesToAdd);
    }

    // Reset input
    e.target.value = '';
  };

  // Analyze photos with Google Vision AI
  const analyzePhotosWithAI = async (newFiles: File[]) => {
    setIsAnalyzing(true);
    try {
      const analyses = await analyzeMultipleImages(newFiles);
      const combined = combineImageAnalyses(analyses);
      
      setAiSuggestion(combined);
      
      toast({
        title: "🤖 AI Analysis Complete",
        description: "Smart description and category suggestions generated!",
      });
    } catch (error) {
      console.error('AI analysis failed:', error);
      toast({
        title: "AI Analysis Failed",
        description: "Unable to analyze images automatically. Please add description manually.",
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

  // Handle location change
  const handleLocationChange = (newLocation: string, coords?: { lat: number; lng: number }) => {
    setLocation(newLocation);
    setCoordinates(coords || null);
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

  // Handle duplicate check and submission
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

    // Step 1: Check for duplicates (if not skipped)
    if (!skipDuplicateCheck) {
      setIsCheckingDuplicates(true);
      try {
        toast({
          title: "Checking for duplicates...",
          description: "Analyzing your issue for potential duplicates.",
        });

        // Convert images for duplicate checking
        let imageBase64: string | undefined;
        if (imageFiles.length > 0) {
          const imageUrls = await convertImagesToBase64(imageFiles.map(f => f.file));
          imageBase64 = imageUrls[0];
        }

        // Map category for duplicate checking
        const categoryMap = {
          pothole: "Infrastructure",
          streetlight: "Electricity", 
          waste: "Trash",
          water: "Water",
          others: "Other"
        };

        const mappedCategory = categoryMap[category] || "Other";

        // Check for duplicates with timeout
        const duplicateCheck = await checkForDuplicates(
          description,
          location,
          coordinates,
          imageBase64,
          mappedCategory
        );

        setDuplicateResult(duplicateCheck);

        if (duplicateCheck.isDuplicate && duplicateCheck.confidence > 0.7) {
          // Show duplicate modal
          setShowDuplicateModal(true);
          setIsCheckingDuplicates(false);
          return;
        }

        // No duplicates found, proceed with submission
        await submitIssue();

      } catch (error) {
        console.error('Error checking for duplicates:', error);
        toast({
          title: "Duplicate check failed",
          description: "Proceeding with submission anyway.",
          variant: "destructive",
        });
        // Proceed with submission even if duplicate check fails
        await submitIssue();
      } finally {
        setIsCheckingDuplicates(false);
      }
    } else {
      // Skip duplicate check, submit directly
      await submitIssue();
    }
  };

  // Actual submission function
  const submitIssue = async () => {
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
      if (imageFiles.length > 0) {
        toast({
          title: "Processing images...",
          description: "Please wait while we process your photos.",
        });
        imageUrls = await convertImagesToBase64(imageFiles.map(f => f.file));
      }

      // Extract coordinates - either from state or parse from location string
      let latitude = coordinates?.lat || null;
      let longitude = coordinates?.lng || null;

      // Fallback: If coordinates not in state, try to parse from location string
      if (!latitude && !longitude && location) {
        const coordsMatch = location.match(/^(-?\d+\.?\d*),\s*(-?\d+\.?\d*)$/);
        if (coordsMatch) {
          latitude = parseFloat(coordsMatch[1]);
          longitude = parseFloat(coordsMatch[2]);
          console.log('Extracted coordinates from location string:', { latitude, longitude });
        }
      }

      // Prepare issue data with multiple images support
      const issueData = {
        title: title,
        description: description,
        location: location,
        latitude: latitude,
        longitude: longitude,
        category: categoryMap[category] || "Other",
        image: imageUrls.length > 0 ? imageUrls[0] : null, // Primary image (first uploaded image)
        // images: imageUrls.length > 0 ? imageUrls : null, // TEMPORARILY COMMENTED - Uncomment after schema cache refresh
        created_by: currentUser.id,
        status: 'reported',
        comments_count: 0,
        volunteers_count: 0,
        created_at: new Date().toISOString(),
      };

      console.log('Submitting issue data:', issueData);
      console.log('Coordinates being saved:', { latitude, longitude });

      // Validate coordinates before submission
      if (!latitude || !longitude) {
        console.warn('⚠️ Warning: Issue being submitted without coordinates!');
        toast({
          title: "Location coordinates missing",
          description: "The issue will be submitted, but navigation features may not work. Please use the map picker for better accuracy.",
          variant: "destructive",
        });
      }

      // Submit issue to database
      const { data, error } = await supabase
        .from('issues')
        .insert([issueData])
        .select();

      if (error) throw error;

      setSubmitted(true);
      toast({
        title: "Issue reported successfully!",
        description: "Your report has been submitted and will be reviewed.",
      });

      // Reset form
      setDescription("");
      setCategory("");
      setLocation("");
      setCoordinates(null);
      setAiSuggestion(null);
      setImageFiles([]);

      // Redirect to issues page after 2 seconds
      setTimeout(() => {
        navigate('/issues');
      }, 2000);

    } catch (error) {
      console.error("Error submitting issue:", error);
      
      let errorMessage = "An error occurred while submitting your report. Please try again.";
      
      if (error?.message) {
        errorMessage = `Submission failed: ${error.message}`;
      }
      
      toast({
        title: "Failed to submit report",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle duplicate modal actions
  const handleProceedAnyway = async () => {
    setShowDuplicateModal(false);
    await submitIssue();
  };

  const handleCancelSubmission = () => {
    setShowDuplicateModal(false);
    setDuplicateResult(null);
    toast({
      title: "Submission cancelled",
      description: "Your issue was not submitted. You can review the similar issues or modify your report.",
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-900 via-indigo-900 to-gray-900 text-white flex justify-center items-center p-6">
      <Card className="bg-white/10 border-none shadow-2xl w-full max-w-2xl p-6 rounded-3xl">
        <CardContent>
          <motion.h1
            initial={{ opacity: 0, y: -30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1 }}
            className="text-3xl font-bold text-center mb-6"
          >
            Report a Civic Issue
          </motion.h1>

          {/* Image Upload Section */}
          <div className="mb-6">
            <ImageUploadComponent
              onImagesChange={handleImagesChange}
              maxImages={5}
              maxFileSize={10}
            />
          </div>

          {/* Description */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <label className="text-gray-300 font-medium">Description</label>
              {imageFiles.length > 0 && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => analyzePhotosWithAI(imageFiles.map(f => f.file))}
                  disabled={isAnalyzing}
                  className="text-blue-400 hover:text-blue-300 border-gray-600 hover:border-blue-400"
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
              className="bg-gray-800 text-white border-gray-700 focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* AI Suggestions */}
          {aiSuggestion && (
            <div className="mb-6">
              <div className="bg-gradient-to-r from-blue-900/50 to-purple-900/50 border border-blue-600/50 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles className="h-5 w-5 text-blue-400" />
                  <span className="font-medium text-blue-300">AI Smart Suggestions</span>
                  {isAnalyzing && (
                    <Loader2 className="h-4 w-4 animate-spin text-blue-400" />
                  )}
                </div>
                {aiSuggestion && (
                  <div className="space-y-3">
                    <div>
                      <span className="text-sm font-medium text-gray-300">Suggested Description:</span>
                      <p className="text-sm text-gray-400 bg-gray-800/50 p-2 rounded border border-gray-600">{aiSuggestion.description}</p>
                    </div>
                    <div>
                      <span className="text-sm font-medium text-gray-300">Suggested Category:</span>
                      <p className="text-sm text-gray-400 bg-gray-800/50 p-2 rounded border border-gray-600">{aiSuggestion.category}</p>
                    </div>
                    <Button
                      type="button"
                      onClick={applyAISuggestions}
                      size="sm"
                      className="bg-blue-600 hover:bg-blue-700 text-white"
                    >
                      <Wand2 className="h-4 w-4 mr-1" />
                      Apply Suggestions
                    </Button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Category */}
          <div className="mb-6">
            <label className="block mb-2 text-gray-300 font-medium">Category</label>
            <Select onValueChange={(value) => setCategory(value)}>
              <SelectTrigger className="bg-gray-800 text-white border-gray-700">
                <SelectValue placeholder="Select issue category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pothole">🚧 Pothole</SelectItem>
                <SelectItem value="streetlight">💡 Streetlight</SelectItem>
                <SelectItem value="waste">🗑️ Waste Management</SelectItem>
                <SelectItem value="water">💧 Water Leakage</SelectItem>
                <SelectItem value="others">🔧 Others</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Location */}
          <div className="mb-6">
            <label className="block mb-2 text-gray-300 font-medium flex items-center gap-2">
              <MapPin className="w-4 h-4" /> Location
            </label>
            <LocationPicker
              value={location}
              onChange={handleLocationChange}
              placeholder="Auto-detected or enter manually"
            />
          </div>



          {/* Skip Duplicate Check Option */}
          <div className="flex items-center gap-2 justify-center mb-4">
            <input
              type="checkbox"
              id="skipDuplicateCheck"
              checked={skipDuplicateCheck}
              onChange={(e) => setSkipDuplicateCheck(e.target.checked)}
              className="w-4 h-4 text-pink-600 bg-gray-100 border-gray-300 rounded focus:ring-pink-500"
            />
            <label htmlFor="skipDuplicateCheck" className="text-sm text-gray-600">
              Skip duplicate check (submit faster)
            </label>
          </div>

          {/* Submit Button */}
          <div className="text-center">
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting || isCheckingDuplicates}
              className="bg-pink-600 hover:bg-pink-700 text-white px-8 py-3 text-lg rounded-full shadow-lg disabled:opacity-50"
            >
              {isCheckingDuplicates ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Checking for duplicates...
                </span>
              ) : isSubmitting ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-5 w-5 animate-spin" />
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
              className="mt-6 text-center flex flex-col items-center"
            >
              <CheckCircle className="w-10 h-10 text-green-400 mb-2" />
              <p className="text-green-300 font-medium">Report submitted successfully! You'll receive updates shortly.</p>
            </motion.div>
          )}
        </CardContent>
      </Card>

      {/* Duplicate Issue Modal */}
      {duplicateResult && (
        <DuplicateIssueModal
          isOpen={showDuplicateModal}
          onClose={() => setShowDuplicateModal(false)}
          duplicates={duplicateResult.duplicates}
          confidence={duplicateResult.confidence}
          onProceedAnyway={handleProceedAnyway}
          onCancel={handleCancelSubmission}
        />
      )}
    </div>
  );
}
