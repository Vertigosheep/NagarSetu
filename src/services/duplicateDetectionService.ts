import { supabase } from '@/lib/supabase';
import { analyzeMultipleImages } from './visionService';

export interface DuplicateIssue {
  id: string;
  title: string;
  description: string;
  location: string;
  image: string;
  created_at: string;
  created_by: string;
  similarity_score: number;
  match_type: 'location' | 'image' | 'both';
}

export interface DuplicateDetectionResult {
  isDuplicate: boolean;
  duplicates: DuplicateIssue[];
  confidence: number;
}

// Calculate distance between two coordinates in kilometers
function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371; // Earth's radius in kilometers
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLng/2) * Math.sin(dLng/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

// Extract coordinates from location string
function extractCoordinates(location: string): { lat: number; lng: number } | null {
  // Try to extract coordinates from various formats
  const patterns = [
    /(-?\d+\.?\d*),\s*(-?\d+\.?\d*)/,  // Basic lat,lng format
    /lat:\s*(-?\d+\.?\d*),?\s*lng:\s*(-?\d+\.?\d*)/i,  // lat: X, lng: Y format
    /latitude:\s*(-?\d+\.?\d*),?\s*longitude:\s*(-?\d+\.?\d*)/i,  // Full words
    /\((-?\d+\.?\d*),\s*(-?\d+\.?\d*)\)/  // Parentheses format
  ];
  
  for (const pattern of patterns) {
    const match = location.match(pattern);
    if (match) {
      const lat = parseFloat(match[1]);
      const lng = parseFloat(match[2]);
      
      // Validate coordinates are within reasonable bounds
      if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
        return { lat, lng };
      }
    }
  }
  
  return null;
}

// Calculate text similarity using simple word overlap with keyword weighting
function calculateTextSimilarity(text1: string, text2: string): number {
  const words1 = text1.toLowerCase().split(/\s+/).filter(word => word.length > 2);
  const words2 = text2.toLowerCase().split(/\s+/).filter(word => word.length > 2);
  
  if (words1.length === 0 || words2.length === 0) return 0;
  
  // Important keywords that indicate similar issues
  const importantKeywords = [
    'broken', 'damaged', 'pothole', 'streetlight', 'trash', 'garbage', 'water', 'leak',
    'flooding', 'drainage', 'blocked', 'overflowing', 'faulty', 'not working', 'repair',
    'maintenance', 'urgent', 'dangerous', 'safety', 'hazard'
  ];
  
  let weightedScore = 0;
  let totalWeight = 0;
  
  const intersection = words1.filter(word => words2.includes(word));
  const union = [...new Set([...words1, ...words2])];
  
  // Calculate basic similarity
  const basicSimilarity = intersection.length / union.length;
  
  // Add weight for important keywords
  intersection.forEach(word => {
    const weight = importantKeywords.includes(word) ? 2 : 1;
    weightedScore += weight;
    totalWeight += weight;
  });
  
  union.forEach(word => {
    if (!intersection.includes(word)) {
      const weight = importantKeywords.includes(word) ? 2 : 1;
      totalWeight += weight;
    }
  });
  
  const weightedSimilarity = totalWeight > 0 ? weightedScore / totalWeight : 0;
  
  // Return the higher of basic or weighted similarity
  return Math.max(basicSimilarity, weightedSimilarity);
}

// Analyze image similarity using Vision API
async function analyzeImageSimilarity(newImageBase64: string, existingImageBase64: string): Promise<number> {
  try {
    // Convert base64 to File objects for analysis
    const newImageBlob = await fetch(newImageBase64).then(r => r.blob());
    const existingImageBlob = await fetch(existingImageBase64).then(r => r.blob());
    
    const newImageFile = new File([newImageBlob], 'new.jpg', { type: 'image/jpeg' });
    const existingImageFile = new File([existingImageBlob], 'existing.jpg', { type: 'image/jpeg' });
    
    // Analyze both images
    const [newAnalysis, existingAnalysis] = await analyzeMultipleImages([newImageFile, existingImageFile]);
    
    if (!newAnalysis || !existingAnalysis) return 0;
    
    // Compare descriptions for similarity
    const textSimilarity = calculateTextSimilarity(newAnalysis.description, existingAnalysis.description);
    
    // Compare categories
    const categorySimilarity = newAnalysis.category === existingAnalysis.category ? 0.3 : 0;
    
    return Math.min(textSimilarity + categorySimilarity, 1);
  } catch (error) {
    console.error('Error analyzing image similarity:', error);
    return 0;
  }
}

// Check for duplicate issues with timeout and simplified logic
export async function checkForDuplicates(
  description: string,
  location: string,
  coordinates: { lat: number; lng: number } | null,
  imageBase64?: string,
  category?: string
): Promise<DuplicateDetectionResult> {
  try {
    console.log('Checking for duplicate issues...');
    
    // Set a timeout for the entire operation (5 seconds max)
    const timeoutPromise = new Promise<DuplicateDetectionResult>((_, reject) => {
      setTimeout(() => reject(new Error('Duplicate check timeout')), 5000);
    });
    
    const duplicateCheckPromise = performDuplicateCheck(description, location, coordinates, imageBase64, category);
    
    // Race between timeout and actual check
    return await Promise.race([duplicateCheckPromise, timeoutPromise]);
    
  } catch (error) {
    console.error('Error in duplicate detection:', error);
    // Return no duplicates if check fails or times out
    return { isDuplicate: false, duplicates: [], confidence: 0 };
  }
}

// Simplified and faster duplicate checking
async function performDuplicateCheck(
  description: string,
  location: string,
  coordinates: { lat: number; lng: number } | null,
  imageBase64?: string,
  category?: string
): Promise<DuplicateDetectionResult> {
  // Fetch only recent issues (last 7 days instead of 30) for faster query
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  
  const { data: existingIssues, error } = await supabase
    .from('issues')
    .select('id, title, description, location, image, created_at, created_by, category')
    .gte('created_at', sevenDaysAgo.toISOString())
    .neq('status', 'resolved')
    .limit(20); // Limit to 20 most recent issues for faster processing
  
  if (error) {
    console.error('Error fetching existing issues:', error);
    return { isDuplicate: false, duplicates: [], confidence: 0 };
  }
  
  if (!existingIssues || existingIssues.length === 0) {
    return { isDuplicate: false, duplicates: [], confidence: 0 };
  }
  
  const duplicates: DuplicateIssue[] = [];
  
  for (const issue of existingIssues) {
    let similarityScore = 0;
    let matchType: 'location' | 'image' | 'both' = 'location';
    
    // 1. Fast location proximity check
    let locationSimilarity = 0;
    if (coordinates) {
      const issueCoords = extractCoordinates(issue.location);
      if (issueCoords) {
        const distance = calculateDistance(
          coordinates.lat, coordinates.lng,
          issueCoords.lat, issueCoords.lng
        );
        
        // Consider locations within 50 meters as potentially duplicate (reduced from 100m)
        if (distance <= 0.05) { // 50 meters
          locationSimilarity = Math.max(0, 1 - (distance / 0.05));
        }
      }
    }
    
    // 2. Fast text similarity (simplified)
    const textSimilarity = calculateTextSimilarity(description, issue.description);
    
    // 3. Category similarity
    const categorySimilarity = category && issue.category === category ? 0.3 : 0;
    
    // 4. SKIP image similarity for speed (most expensive operation)
    // Only do basic checks for now
    
    // Calculate overall similarity score (without image analysis)
    similarityScore = locationSimilarity * 0.5 + textSimilarity * 0.4 + categorySimilarity * 0.1;
    
    // Consider it a potential duplicate if similarity > 70% (increased threshold)
    if (similarityScore > 0.7) {
      duplicates.push({
        id: issue.id,
        title: issue.title,
        description: issue.description,
        location: issue.location,
        image: issue.image,
        created_at: issue.created_at,
        created_by: issue.created_by,
        similarity_score: similarityScore,
        match_type: matchType
      });
    }
  }
  
  // Sort by similarity score (highest first)
  duplicates.sort((a, b) => b.similarity_score - a.similarity_score);
  
  const isDuplicate = duplicates.length > 0;
  const confidence = isDuplicate ? duplicates[0].similarity_score : 0;
  
  console.log(`Duplicate check complete. Found ${duplicates.length} potential duplicates.`);
  
  return {
    isDuplicate,
    duplicates: duplicates.slice(0, 2), // Return top 2 matches only
    confidence
  };
}

// Format time ago for display
export function formatTimeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffTime = Math.abs(now.getTime() - date.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays === 1) return '1 day ago';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.ceil(diffDays / 7)} week${Math.ceil(diffDays / 7) > 1 ? 's' : ''} ago`;
  return date.toLocaleDateString();
}