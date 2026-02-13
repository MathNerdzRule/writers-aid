import { GoogleGenAI, Type } from "@google/genai";
import { ProofreadSuggestion } from "../types";

const apiKey = import.meta.env.VITE_GEMINI_API_KEY;

if (!apiKey) {
    throw new Error("VITE_GEMINI_API_KEY environment variable is not set");
}

const ai = new GoogleGenAI({ apiKey });

export const generateWithGemini = async (model: 'gemini-3-flash-preview', prompt: string): Promise<string> => {
    try {
        const response = await ai.models.generateContent({
            model,
            contents: prompt,
        });
        return response.text;
    } catch (error) {
        console.error(`Error generating content with ${model}:`, error);
        if (error instanceof Error) {
            return `An error occurred: ${error.message}`;
        }
        return "An unknown error occurred.";
    }
};

export const generateLookupWithGemini = async (word: string, type: 'synonyms' | 'definition'): Promise<{ data?: any; error?: string; }> => {
    try {
        let prompt;
        let responseSchema;

        if (type === 'synonyms') {
            prompt = `Provide a list of common synonyms for the word: "${word}". If you cannot find any, return an empty list.`;
            responseSchema = {
                type: Type.OBJECT,
                properties: {
                    synonyms: {
                        type: Type.ARRAY,
                        description: 'A list of synonyms for the given word.',
                        items: { type: Type.STRING }
                    }
                },
                required: ['synonyms']
            };
        } else { // definition
            prompt = `Provide a concise, one-sentence dictionary definition for the word: "${word}"`;
            responseSchema = {
                type: Type.OBJECT,
                properties: {
                    definition: {
                        type: Type.STRING,
                        description: 'A concise definition of the word.'
                    }
                },
                required: ['definition']
            };
        }
        
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: responseSchema,
                temperature: 0.2,
            },
        });

        const jsonText = response.text.trim();
        const parsedJson = JSON.parse(jsonText);
        return { data: parsedJson };

    } catch (error) {
        console.error(`Error during ${type} lookup for "${word}":`, error);
        const errorMessage = error instanceof Error ? error.message : `An unknown error occurred during the ${type} lookup.`;
        return { error: errorMessage };
    }
};

export const proofreadWithGemini = async (text: string): Promise<{ data?: ProofreadSuggestion[]; error?: string; }> => {
    try {
        const systemInstruction = `You are a meticulous proofreading assistant. Your task is to analyze the provided text for errors in grammar, spelling, and punctuation based on standard American English rules (following AP Style).

Your process must be:
1. Analyze: Read the entire text and identify potential violations of the style guide.
2. Verify: For each potential violation, you must double-check the text to confirm it is actually incorrect.
3. Report: Only if a verified error actually exists, generate a suggestion.

Critical Rules for Reporting:
- You must not generate a suggestion for text that is already correct.
- Your goal is to find actual errors, not to flag text that already follows the rules.
- Before suggesting a correction, compare your suggested change to the original text. If they are identical, you must discard the suggestion.

Your response must be a JSON array. Each object in the array represents a single suggestion and must include:
- 'type': The category of the correction (e.g., Spelling, Grammar, Punctuation).
- 'original': The original incorrect snippet of text.
- 'corrected': The corrected snippet of text.
- 'explanation': A brief explanation of the correction, mentioning the specific rule.
- 'startIndex': The starting character index of the 'original' text within the full provided text.

If no errors are found, return an empty array.`;
        
        const responseSchema = {
            type: Type.ARRAY,
            description: "A list of suggestions for the provided text.",
            items: {
                type: Type.OBJECT,
                properties: {
                    type: { type: Type.STRING, description: "The category of the correction (e.g., Spelling, Grammar, Punctuation)." },
                    original: { type: Type.STRING, description: "The original incorrect snippet of text." },
                    corrected: { type: Type.STRING, description: "The corrected snippet of text." },
                    explanation: { type: Type.STRING, description: "A brief explanation of the correction." },
                    startIndex: { type: Type.INTEGER, description: "The starting character index of the 'original' text." }
                },
                required: ['type', 'original', 'corrected', 'explanation', 'startIndex']
            }
        };

        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: text,
            config: {
                systemInstruction,
                responseMimeType: "application/json",
                responseSchema: responseSchema,
                temperature: 0.3,
            },
        });

        const jsonText = response.text.trim();
        const parsedJson = JSON.parse(jsonText);
        return { data: parsedJson };

    } catch (error) {
        console.error(`Error during proofreading:`, error);
        const errorMessage = error instanceof Error ? error.message : `An unknown error occurred during proofreading.`;
        return { error: errorMessage };
    }
};

export const analyzeTextWithGemini = async (text: string): Promise<{ data?: ProofreadSuggestion[]; error?: string; }> => {
    try {
        const systemInstruction = `You are an expert writing analyst. Your task is to analyze the provided text for improvements in tone, style, and clarity. Do not suggest grammar or spelling corrections. Instead, focus on higher-level feedback. For each potential improvement, provide a single, actionable suggestion.

Your response must be a JSON array. Each object in the array represents a single suggestion and must include:
- 'type': The category of the suggestion (e.g., Clarity, Style, Tone).
- 'original': The original snippet of text that could be improved.
- 'corrected': The suggested replacement snippet.
- 'explanation': A brief explanation of why the change is an improvement.
- 'startIndex': The starting character index of the 'original' text within the full provided text.

If no improvements can be suggested, return an empty array.`;
        
        const responseSchema = {
            type: Type.ARRAY,
            description: "A list of suggestions for improving the provided text.",
            items: {
                type: Type.OBJECT,
                properties: {
                    type: { type: Type.STRING, description: "The category of the suggestion (e.g., Clarity, Style, Tone)." },
                    original: { type: Type.STRING, description: "The original snippet of text that could be improved." },
                    corrected: { type: Type.STRING, description: "The suggested replacement snippet." },
                    explanation: { type: Type.STRING, description: "A brief explanation of why the change is an improvement." },
                    startIndex: { type: Type.INTEGER, description: "The starting character index of the 'original' text." }
                },
                required: ['type', 'original', 'corrected', 'explanation', 'startIndex']
            }
        };

        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: text,
            config: {
                systemInstruction,
                responseMimeType: "application/json",
                responseSchema: responseSchema,
                temperature: 0.5,
            },
        });

        const jsonText = response.text.trim();
        const parsedJson = JSON.parse(jsonText);
        return { data: parsedJson };

    } catch (error) {
        console.error(`Error during text analysis:`, error);
        const errorMessage = error instanceof Error ? error.message : `An unknown error occurred during text analysis.`;
        return { error: errorMessage };
    }
};

export const reviewPassageWithGemini = async (text: string): Promise<{ feedback?: string; error?: string; }> => {
    try {
        const systemInstruction = `You are an expert writing reviewer. Your goal is to mimic how a reader would read and follow along with a passage.
Analyze the provided text and provide feedback on:
1. Flow and Transition: Do the paragraphs transition sensibly?
2. Clarity: Can the reader follow along easily?
3. Engagement: Would the reader be lost at any point?

Provide constructive, encouraging feedback. Do not rewrite the text, only provide observations and suggestions for the author.`;

        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: text,
            config: {
                systemInstruction,
                temperature: 0.7,
            },
        });

        return { feedback: response.text };
    } catch (error) {
        console.error(`Error during passage review:`, error);
        const errorMessage = error instanceof Error ? error.message : `An unknown error occurred during passage review.`;
        return { error: errorMessage };
    }
};

export const processDictationWithGemini = async (audioData: string, existingText: string, mimeType: string = 'audio/wav'): Promise<{ transcribedText?: string; error?: string; }> => {
    try {
        const systemInstruction = `You are a professional transcription and editing assistant for a fiction writer.
Your task is to:
1. Transcribe the provided audio.
2. Clean up the transcription by removing filler words like "um", "hmm", "uh", etc.
3. Interpret the writer's intention. If they make a mistake and correct themselves (e.g., "She's driving a green... no a blue car"), transcribe only the final intended version ("She's driving a blue car").
4. If existing text is provided, use it as context to ensure consistency in character names, setting, and tone.

Return ONLY the cleaned-up, transcribed text. Do not include any meta-talk or pleasantries.`;

        const contents = [
            {
                role: 'user',
                parts: [
                    {
                        inlineData: {
                            data: audioData,
                            mimeType: mimeType,
                        },
                    },
                    {
                        text: existingText ? `Context (previous text): ${existingText}` : "No previous context provided."
                    }
                ],
            },
        ];

        const response = await ai.models.generateContent({
            model: 'gemini-live-2.5-flash-native-audio',
            contents: contents as any, // Cast due to SDK versioning/types if needed
            config: {
                systemInstruction,
                temperature: 0.2,
            },
        });

        return { transcribedText: response.text };
    } catch (error) {
        console.error(`Error during dictation processing:`, error);
        const errorMessage = error instanceof Error ? error.message : `An unknown error occurred during dictation processing.`;
        return { error: errorMessage };
    }
};

