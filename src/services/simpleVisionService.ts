// Simplified Vision API service for description generation
const GOOGLE_VISION_API_KEY = import.meta.env.VITE_GOOGLE_VISION_API_KEY;

// Convert file to base64
const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const base64 = (reader.result as string).split(',')[1];
      resolve(base64);
    };
    reader.onerror = error => reject(error);
  });
};

// Simple description generator based on common issue patterns
const generateSimpleDescription = (labels: string[]): string => {
  const problemKeywords = [
    'pothole', 'crack', 'damage', 'broken', 'leak', 'trash', 'garbage',
    'streetlight', 'road', 'sidewalk', 'water', 'drain', 'hole'
  ];

  const detectedProblems = labels.filter(label => 
    problemKeywords.some(keyword => 
      label.toLowerCase().includes(keyword)
    )
  );

  if (detectedProblems.length > 0) {
    return `Issue detected: ${detectedProblems.join(', ').toLowerCase()}. Please review and add more details if needed.`;
  }

  // Fallback descriptions based on common labels
  if (labels.some(l => l.toLowerCase().includes('road') || l.toLowerCase().includes('street'))) {
    return "Road or street issue detected. Please specify the exact problem (pothole, crack, damage, etc.).";
  }
  
  if (labels.some(l => l.toLowerCase().includes('water') || l.toLowerCase().includes('liquid'))) {
    return "Water-related issue detected. Please specify if it's a leak, flooding, or drainage problem.";
  }
  
  if (labels.some(l => l.toLowerCase().includes('light') || l.toLowerCase().includes('lamp'))) {
    return "Street lighting issue detected. Please specify if the light is broken, flickering, or not working.";
  }
  
  if (labels.some(l => l.toLowerCase().includes('trash') || l.toLowerCase().includes('waste'))) {
    return "Waste management issue detected. Please specify if bins are overflowing, litter, or collection problem.";
  }

  return "Issue detected in uploaded image. Please provide specific details about the problem.";
};

// Suggest category based on detected elements
const suggestSimpleCategory = (labels: string[]): string => {
  const allElements = labels.map(el => el.toLowerCase());
  
  if (allElements.some(el => 
    el.includes('road') || el.includes('street') || el.includes('pothole') || 
    el.includes('asphalt') || el.includes('pavement') || el.includes('sidewalk')
  )) {
    return 'infrastructure';
  }
  
  if (allElements.some(el => 
    el.includes('water') || el.includes('leak') || el.includes('drain') || 
    el.includes('flooding') || el.includes('pipe')
  )) {
    return 'water';
  }
  
  if (allElements.some(el => 
    el.includes('light') || el.includes('lamp') || el.includes('electric') || 
    el.includes('wire') || el.includes('pole')
  )) {
    return 'streetlight';
  }
  
  if (allElements.some(el => 
    el.includes('trash') || el.includes('garbage') || el.includes('waste') || 
    el.includes('litter') || el.includes('bin')
  )) {
    return 'waste';
  }
  
  return 'others';
};

// Simple image analysis function
export const analyzeImageSimple = async (file: File): Promise<{ description: string; category: string }> => {
  try {
    const base64Image = await fileToBase64(file);
    
    const requestBody = {
      requests: [
        {
          image: {
            content: base64Image
          },
          features: [
            {
              type: 'LABEL_DETECTION',
              maxResults: 10
            }
          ]
        }
      ]
    };

    const response = await fetch(
      `https://vision.googleapis.com/v1/images:annotate?key=${GOOGLE_VISION_API_KEY}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      }
    );

    if (!response.ok) {
      throw new Error(`Vision API error: ${response.status} - ${response.statusText}`);
    }

    const data = await response.json();
    
    if (data.error) {
      throw new Error(`API Error: ${data.error.message}`);
    }

    const annotations = data.responses[0];
    
    if (!annotations || !annotations.labelAnnotations) {
      throw new Error('No labels detected in image');
    }

    const labels = annotations.labelAnnotations.map((label: any) => label.description);
    
    return {
      description: generateSimpleDescription(labels),
      category: suggestSimpleCategory(labels)
    };

  } catch (error) {
    console.error('Vision API analysis failed:', error);
    throw new Error(`Failed to analyze image: ${error.message}`);
  }
};

// Analyze multiple images and combine results
export const analyzeMultipleImagesSimple = async (files: File[]): Promise<{ description: string; category: string }> => {
  if (files.length === 0) {
    throw new Error('No images to analyze');
  }

  try {
    // Analyze first image only for simplicity
    const result = await analyzeImageSimple(files[0]);
    
    if (files.length > 1) {
      result.description = `Multiple images uploaded. ${result.description}`;
    }
    
    return result;
  } catch (error) {
    console.error('Multiple image analysis failed:', error);
    throw error;
  }
};