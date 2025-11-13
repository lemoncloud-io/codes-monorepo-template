import { GoogleGenAI, Modality } from "@google/genai";

const API_KEY = process.env.API_KEY;

if (!API_KEY) {
  throw new Error("API_KEY environment variable not set");
}

const ai = new GoogleGenAI({ apiKey: API_KEY });

const fileToBase64 = (file: File): Promise<{ data: string; mimeType: string }> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => {
        const result = reader.result as string;
        const [mimePart, base64Part] = result.split(';base64,');
        const mimeType = mimePart.split(':')[1];
        if (mimeType && base64Part) {
            resolve({ data: base64Part, mimeType });
        } else {
            reject(new Error("Failed to parse base64 data from file."));
        }
        };
        reader.onerror = (error) => reject(error);
    });
};

export const generateFigureImage = async (selectedFile: string | File): Promise<string | null> => {
    try {
        const model = 'gemini-2.5-flash-image-preview';

        const prompt = `Please transform this portrait photo into a photorealistic 3D figure. The figure should be the central focus, capturing the person's likeness accurately. Place the figure on a clean, modern desk surface. In the background, position a computer monitor that is slightly out of focus. The monitor screen should display a realistic-looking e-commerce website, specifically a product page for collectibles or custom figures, which complements the main subject. The overall scene should have professional studio lighting, creating a high-end, polished look.`;

        const selectedData = await fileToBase64(selectedFile);
        const response = await ai.models.generateContent({
            model: model,
            contents: {
                parts: [
                    {
                        inlineData: selectedData,
                    },
                    {
                        text: prompt,
                    },
                ],
            },
            config: {
                responseModalities: [Modality.IMAGE, Modality.TEXT],
            },
        });

        // Find the image part in the response
        if (response.candidates && response.candidates[0].content.parts) {
            for (const part of response.candidates[0].content.parts) {
                if (part.inlineData) {
                    return part.inlineData.data;
                }
            }
        }
        
        return null;

    } catch (error) {
        console.error("Error generating image with Gemini API:", error);
        throw new Error("Failed to communicate with the AI model.");
    }
};
