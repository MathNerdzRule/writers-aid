export interface TranscriptEntry {
    speaker: 'user' | 'gemini';
    text: string;
}

export interface ProofreadSuggestion {
  type: string;
  original: string;
  corrected: string;
  explanation:string;
  startIndex: number;
}

// Fix: Add CorrectedTextPart and ProofreadResult interfaces.
export interface CorrectedTextPart {
  text: string;
  isCorrection: boolean;
}

export interface ProofreadResult {
  suggestions: ProofreadSuggestion[];
  correctedTextParts: CorrectedTextPart[];
}
