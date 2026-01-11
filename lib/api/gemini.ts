import { GoogleGenerativeAI } from '@google/generative-ai';
import type { ModelType } from '@/lib/store/useAppStore';
import { addApiLog } from '@/lib/db';

// Model configurations
const MODELS: Record<ModelType, string> = {
  'nano-banana': 'gemini-2.0-flash-exp-image-generation', // Fast, efficient
  'nano-banana-pro': 'gemini-3-pro-image-preview', // Higher quality with advanced reasoning
};

export interface TryOnRequest {
  userImage: string; // Base64 (without data URL prefix)
  clothingImage: string; // Base64 (without data URL prefix)
  userImageMime: string;
  clothingImageMime: string;
}

export interface TryOnResponse {
  success: boolean;
  resultImage?: string; // Base64
  resultMime?: string;
  error?: string;
}

function buildTryOnPrompt(): string {
  return `You are a virtual try-on assistant. I'm providing two images:

IMAGE 1: A photo of a person (the user)
IMAGE 2: A clothing item

YOUR TASK:
Generate a realistic image of the SAME person from Image 1 wearing the clothing from Image 2.

CRITICAL REQUIREMENTS:
- PRESERVE the person's exact face, skin tone, hair, and body proportions
- PRESERVE the person's pose and camera angle
- The clothing should fit naturally on their body
- Maintain realistic lighting, shadows, and fabric draping
- Keep the original background or use a neutral background
- The result should look like a real photograph, not AI-generated

Generate the virtual try-on image now.`;
}

export async function generateTryOn(
  apiKey: string,
  request: TryOnRequest,
  model: ModelType = 'nano-banana'
): Promise<TryOnResponse> {
  const genAI = new GoogleGenerativeAI(apiKey);
  const modelName = MODELS[model];
  const startTime = Date.now();

  // Log the request
  await addApiLog({
    timestamp: new Date(),
    type: 'request',
    model: modelName,
    status: 'pending',
    message: `Starting try-on generation with ${model}`,
    details: JSON.stringify({
      model: modelName,
      userImageMime: request.userImageMime,
      clothingImageMime: request.clothingImageMime,
      userImageSize: request.userImage.length,
      clothingImageSize: request.clothingImage.length,
    }),
  });

  const modelInstance = genAI.getGenerativeModel({
    model: modelName,
    generationConfig: {
      // @ts-ignore - responseModalities is valid for image generation models
      responseModalities: ['TEXT', 'IMAGE'],
    },
  });

  const prompt = buildTryOnPrompt();

  try {
    const result = await modelInstance.generateContent([
      { text: prompt },
      {
        inlineData: {
          mimeType: request.userImageMime,
          data: request.userImage,
        },
      },
      {
        inlineData: {
          mimeType: request.clothingImageMime,
          data: request.clothingImage,
        },
      },
    ]);

    const response = result.response;
    const durationMs = Date.now() - startTime;

    // Extract image from response
    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if ('inlineData' in part && part.inlineData) {
        // Log success
        await addApiLog({
          timestamp: new Date(),
          type: 'response',
          model: modelName,
          status: 'success',
          message: 'Image generated successfully',
          durationMs,
          details: JSON.stringify({
            resultMime: part.inlineData.mimeType,
            resultSize: part.inlineData.data.length,
          }),
        });

        return {
          success: true,
          resultImage: part.inlineData.data,
          resultMime: part.inlineData.mimeType,
        };
      }
    }

    // Check if there's a text response with an error
    const textPart = response.candidates?.[0]?.content?.parts?.find(
      (p) => 'text' in p
    );
    if (textPart && 'text' in textPart) {
      const errorMsg = textPart.text || 'No image generated';

      // Log text response (might be an error)
      await addApiLog({
        timestamp: new Date(),
        type: 'response',
        model: modelName,
        status: 'error',
        message: 'API returned text instead of image',
        durationMs,
        details: errorMsg,
      });

      return {
        success: false,
        error: errorMsg,
      };
    }

    // Log no image case
    await addApiLog({
      timestamp: new Date(),
      type: 'response',
      model: modelName,
      status: 'error',
      message: 'No image in response',
      durationMs,
      details: JSON.stringify(response.candidates?.[0] || 'No candidates'),
    });

    return {
      success: false,
      error: 'No image generated in response',
    };
  } catch (error) {
    const durationMs = Date.now() - startTime;
    const message = error instanceof Error ? error.message : 'Unknown error';
    const stack = error instanceof Error ? error.stack : undefined;

    // Log the full error details
    await addApiLog({
      timestamp: new Date(),
      type: 'error',
      model: modelName,
      status: 'error',
      message: message,
      durationMs,
      details: JSON.stringify({
        errorMessage: message,
        errorStack: stack,
        errorName: error instanceof Error ? error.name : 'Unknown',
        rawError: String(error),
      }, null, 2),
    });

    // Return user-friendly messages but with more detail
    if (message.includes('API_KEY')) {
      return { success: false, error: 'Invalid API key. Please check your settings.' };
    }
    if (message.includes('quota') || message.includes('rate')) {
      // Show the actual error message so user can see what's really happening
      return { success: false, error: `API Error: ${message}` };
    }
    if (message.includes('safety')) {
      return { success: false, error: 'Content blocked by safety filters. Try different images.' };
    }

    return { success: false, error: `Error: ${message}` };
  }
}

// Helper to extract base64 and mime type from data URL
export function parseDataUrl(dataUrl: string): { base64: string; mimeType: string } | null {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return null;
  return {
    mimeType: match[1],
    base64: match[2],
  };
}

// Validate API key format (basic check)
export function isValidApiKeyFormat(key: string): boolean {
  return key.length > 20 && key.startsWith('AI');
}
