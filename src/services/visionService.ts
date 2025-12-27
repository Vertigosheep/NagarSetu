// Google Vision API service for image analysis
const GOOGLE_VISION_API_KEY = import.meta.env.VITE_GOOGLE_VISION_API_KEY;

interface VisionAnalysisResult {
  description: string;
  suggestedCategory: string;
  confidence: number;
  labels: string[];
}

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

// Analyze image using Google Vision API
export const analyzeImage = async (file: File): Promise<VisionAnalysisResult> => {
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
            },
            {
              type: 'TEXT_DETECTION',
              maxResults: 5
            },
            {
              type: 'OBJECT_LOCALIZATION',
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
      throw new Error(`Vision API error: ${response.status}`);
    }

    const data = await response.json();
    const annotations = data.responses[0];

    // Extract labels and text
    const labels = annotations.labelAnnotations?.map((label: any) => label.description) || [];
    const textAnnotations = annotations.textAnnotations?.map((text: any) => text.description) || [];
    const objects = annotations.localizedObjectAnnotations?.map((obj: any) => obj.name) || [];

    // Generate description based on detected elements
    const description = generateDescription(labels, textAnnotations, objects);
    
    // Suggest category based on detected elements
    const suggestedCategory = suggestCategory(labels, objects);
    
    // Calculate confidence based on label scores
    const confidence = annotations.labelAnnotations?.[0]?.score || 0;

    return {
      description,
      suggestedCategory,
      confidence,
      labels: [...labels, ...objects].slice(0, 10)
    };

  } catch (error) {
    console.error('Vision API analysis failed:', error);
    throw new Error('Failed to analyze image. Please add description manually.');
  }
};

// Generate detailed human-readable description from detected elements
const generateDescription = (labels: string[], texts: string[], objects: string[]): string => {
  const allElements = [...labels, ...objects].filter(Boolean);
  
  if (allElements.length === 0) {
    return "An issue has been detected in the uploaded image that requires attention from the municipal authorities. The image shows a civic problem that needs to be addressed. Please review the image carefully and take appropriate action to resolve this matter. Additional details may be provided by the reporter.";
  }

  // Categorize detected elements
  const problemKeywords = allElements.filter(element => {
    const el = element.toLowerCase();
    return el.includes('damage') || el.includes('broken') || el.includes('crack') || 
           el.includes('hole') || el.includes('leak') || el.includes('trash') || 
           el.includes('garbage') || el.includes('pothole') || el.includes('waste') ||
           el.includes('graffiti') || el.includes('vandal') || el.includes('hazard');
  });

  const infrastructureKeywords = allElements.filter(element => {
    const el = element.toLowerCase();
    return el.includes('road') || el.includes('street') || el.includes('sidewalk') || 
           el.includes('pavement') || el.includes('asphalt') || el.includes('concrete') ||
           el.includes('building') || el.includes('wall') || el.includes('fence') ||
           el.includes('bridge') || el.includes('structure');
  });

  const environmentKeywords = allElements.filter(element => {
    const el = element.toLowerCase();
    return el.includes('water') || el.includes('tree') || el.includes('park') || 
           el.includes('garden') || el.includes('plant') || el.includes('outdoor') ||
           el.includes('nature') || el.includes('landscape');
  });

  const utilityKeywords = allElements.filter(element => {
    const el = element.toLowerCase();
    return el.includes('light') || el.includes('lamp') || el.includes('electric') || 
           el.includes('wire') || el.includes('pole') || el.includes('pipe') ||
           el.includes('drain') || el.includes('manhole') || el.includes('utility');
  });

  // Build detailed description
  let description = "This image shows a civic issue that requires municipal attention. ";

  // Add problem description
  if (problemKeywords.length > 0) {
    description += `The image reveals ${problemKeywords.slice(0, 3).join(', ').toLowerCase()} which appears to be affecting the area. `;
  }

  // Add infrastructure context
  if (infrastructureKeywords.length > 0) {
    description += `The issue is located in or near ${infrastructureKeywords.slice(0, 3).join(', ').toLowerCase()}. `;
  }

  // Add environmental context
  if (environmentKeywords.length > 0) {
    description += `The surrounding environment includes ${environmentKeywords.slice(0, 2).join(' and ').toLowerCase()}. `;
  }

  // Add utility context
  if (utilityKeywords.length > 0) {
    description += `Utilities or infrastructure elements such as ${utilityKeywords.slice(0, 2).join(' and ').toLowerCase()} are visible in the vicinity. `;
  }

  // Add general elements if no specific categories found
  if (problemKeywords.length === 0 && infrastructureKeywords.length === 0) {
    const topElements = allElements.slice(0, 5);
    description += `The image contains elements including ${topElements.join(', ').toLowerCase()}. `;
  }

  // Add detected text context
  if (texts.length > 0 && texts[0].length > 3) {
    const cleanText = texts[0].substring(0, 100).trim();
    description += `Visible text in the image reads: "${cleanText}". `;
  }

  // Add severity assessment
  if (problemKeywords.some(k => k.toLowerCase().includes('damage') || k.toLowerCase().includes('broken') || k.toLowerCase().includes('hazard'))) {
    description += "This issue may pose safety concerns and should be addressed promptly. ";
  }

  // Add call to action
  description += "The reported issue requires inspection and appropriate action from the relevant municipal department to ensure public safety and maintain community standards. ";

  // Add technical details
  const allUniqueElements = [...new Set([...labels, ...objects])].slice(0, 8);
  description += `Detected elements: ${allUniqueElements.join(', ').toLowerCase()}.`;

  return description.trim();
};

// Suggest category based on detected elements
const suggestCategory = (labels: string[], objects: string[]): string => {
  const allElements = [...labels, ...objects].map(el => el.toLowerCase());
  
  // Category mapping based on detected elements
  if (allElements.some(el => 
    el.includes('road') || el.includes('street') || el.includes('pothole') || 
    el.includes('asphalt') || el.includes('pavement') || el.includes('sidewalk')
  )) {
    return 'infrastructure';
  }
  
  if (allElements.some(el => 
    el.includes('water') || el.includes('leak') || el.includes('pipe') || 
    el.includes('drain') || el.includes('flooding')
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
  
  if (allElements.some(el => 
    el.includes('tree') || el.includes('park') || el.includes('garden') || 
    el.includes('green') || el.includes('plant')
  )) {
    return 'parks';
  }
  
  if (allElements.some(el => 
    el.includes('building') || el.includes('construction') || el.includes('wall') || 
    el.includes('structure')
  )) {
    return 'building';
  }
  
  if (allElements.some(el => 
    el.includes('vehicle') || el.includes('car') || el.includes('traffic') || 
    el.includes('transport')
  )) {
    return 'transportation';
  }
  
  if (allElements.some(el => 
    el.includes('safety') || el.includes('danger') || el.includes('hazard') || 
    el.includes('security')
  )) {
    return 'safety';
  }
  
  return 'others';
};

// Batch analyze multiple images
export const analyzeMultipleImages = async (files: File[]): Promise<VisionAnalysisResult[]> => {
  const results = await Promise.allSettled(
    files.map(file => analyzeImage(file))
  );
  
  return results.map((result, index) => {
    if (result.status === 'fulfilled') {
      return result.value;
    } else {
      console.error(`Failed to analyze image ${index + 1}:`, result.reason);
      return {
        description: `Image ${index + 1}: Unable to analyze automatically. Please add description manually.`,
        suggestedCategory: 'others',
        confidence: 0,
        labels: []
      };
    }
  });
};

// Combine multiple image analyses into a single comprehensive description
export const combineImageAnalyses = (analyses: VisionAnalysisResult[]): { description: string; category: string } => {
  const validAnalyses = analyses.filter(analysis => analysis.confidence > 0.3);
  
  if (validAnalyses.length === 0) {
    return {
      description: "Multiple images have been uploaded showing different aspects of the civic issue. The images provide visual documentation of the problem from various angles and perspectives. This comprehensive visual evidence will help municipal authorities better understand the scope and severity of the issue. Please review all uploaded images carefully to assess the situation and determine the appropriate course of action. The issue requires attention from the relevant department to ensure proper resolution and maintain community standards.",
      category: 'others'
    };
  }
  
  // Build comprehensive combined description
  let combinedDescription = `This report includes ${analyses.length} image${analyses.length > 1 ? 's' : ''} documenting the civic issue from multiple perspectives. `;
  
  // Add overview
  combinedDescription += "The visual evidence provides a comprehensive view of the problem. ";
  
  // Add individual image descriptions with more context
  validAnalyses.forEach((analysis, index) => {
    combinedDescription += `\n\nImage ${index + 1} Analysis: ${analysis.description} `;
  });
  
  // Collect all unique labels from all images
  const allLabels = [...new Set(validAnalyses.flatMap(a => a.labels))];
  if (allLabels.length > 0) {
    combinedDescription += `\n\nCombined Analysis: Across all images, the following elements have been identified: ${allLabels.slice(0, 12).join(', ').toLowerCase()}. `;
  }
  
  // Add severity assessment based on multiple images
  const hasSeverityIndicators = validAnalyses.some(a => 
    a.labels.some(label => 
      label.toLowerCase().includes('damage') || 
      label.toLowerCase().includes('broken') || 
      label.toLowerCase().includes('hazard') ||
      label.toLowerCase().includes('danger')
    )
  );
  
  if (hasSeverityIndicators) {
    combinedDescription += "The multiple images indicate that this is a significant issue that may pose safety or health concerns. ";
  }
  
  // Add recommendation
  combinedDescription += "The comprehensive visual documentation provided through these images will assist authorities in making an informed assessment and taking appropriate remedial action. ";
  
  // Find most confident category
  const bestCategory = validAnalyses.reduce((best, current) => 
    current.confidence > best.confidence ? current : best
  ).suggestedCategory;
  
  // Add category-specific context
  const categoryContext = {
    'infrastructure': 'This infrastructure-related issue requires attention from the public works or roads department.',
    'water': 'This water-related issue should be addressed by the water supply or drainage department.',
    'streetlight': 'This lighting issue requires attention from the electrical or street lighting department.',
    'waste': 'This waste management issue should be handled by the sanitation or waste management department.',
    'parks': 'This parks and recreation issue requires attention from the parks maintenance department.',
    'building': 'This building-related issue should be reviewed by the building maintenance or inspection department.',
    'transportation': 'This transportation-related issue requires attention from the traffic or transport department.',
    'safety': 'This safety concern requires immediate attention from the appropriate safety or emergency services department.',
    'others': 'This issue requires review to determine the appropriate department for resolution.'
  };
  
  combinedDescription += categoryContext[bestCategory] || categoryContext['others'];
  
  return {
    description: combinedDescription.trim(),
    category: bestCategory
  };
};