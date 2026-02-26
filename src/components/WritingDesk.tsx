import React, { useState, useRef, useEffect } from 'react';
import Button from './common/Button';
import Loader from './common/Loader';
import { generateWithGemini, generateLookupWithGemini, proofreadWithGemini, analyzeTextWithGemini } from '../services/geminiService';
import { ProofreadSuggestion } from '../types';
import './WritingDesk.css';

interface WritingDeskProps {
  text: string;
  setText: React.Dispatch<React.SetStateAction<string>>;
  result: string;
  setResult: (result: string) => void;
}

const SuggestionCard: React.FC<{ 
    suggestion: ProofreadSuggestion, 
    onAccept: () => void,
    onReject: () => void,
    onHover: (s: ProofreadSuggestion | null) => void 
}> = ({ suggestion, onAccept, onReject, onHover }) => {
    return (
        <div 
            className={`suggestion-card ${suggestion.type}`}
            onMouseEnter={() => onHover(suggestion)}
            onMouseLeave={() => onHover(null)}
        >
            <div className="card-header">
                <span className="suggestion-type">{suggestion.type}</span>
            </div>
            <p className="suggestion-explanation">{suggestion.explanation}</p>
            <div className="diff-viewer">
                <span className="diff-original">{suggestion.original}</span>
                <span className="diff-arrow">→</span>
                <span className="diff-corrected">{suggestion.corrected}</span>
            </div>
            <div className="card-actions">
                <Button variant="ghost" className="btn-sm" onClick={onReject}>Reject</Button>
                <Button variant="primary" className="btn-sm" onClick={onAccept}>Accept</Button>
            </div>
        </div>
    );
};


const WritingDesk: React.FC<WritingDeskProps> = ({ text, setText, result, setResult }) => {
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [activeTask, setActiveTask] = useState<string>('');
  const [rephrasePrompt, setRephrasePrompt] = useState<string>('');

  const [selectedText, setSelectedText] = useState<string>('');
  const [selectionRange, setSelectionRange] = useState<{ start: number; end: number } | null>(null);
  const [lookupResult, setLookupResult] = useState<{ synonyms?: string[]; definition?: string } | null>(null);
  const [isLookingUp, setIsLookingUp] = useState<boolean>(false);
  const [activeLookup, setActiveLookup] = useState<'synonyms' | 'definition' | ''>('');
  const [lookupError, setLookupError] = useState<string>('');
  const textAreaRef = useRef<HTMLTextAreaElement>(null);

  const [suggestions, setSuggestions] = useState<ProofreadSuggestion[]>([]);
  const [isFetchingSuggestions, setIsFetchingSuggestions] = useState<boolean>(false);
  const [suggestionError, setSuggestionError] = useState<string>('');
  const [showSuggestionPanel, setShowSuggestionPanel] = useState(false);
  const [suggestionPanelTitle, setSuggestionPanelTitle] = useState<string>('');

  useEffect(() => {
    if(showSuggestionPanel) {
        setShowSuggestionPanel(false);
        setSuggestions([]);
    }
  }, [text]);

  const handleAction = async (task: 'rephrase' | 'suggest') => {
    if (!text.trim()) {
      setError('Please enter some text to work with.');
      return;
    }
    setError('');
    setResult('');
    setIsLoading(true);
    setActiveTask(task);
    setShowSuggestionPanel(false);

    let prompt = '';
    const model = 'gemini-3-flash-preview';

    switch (task) {
      case 'rephrase':
        let rephraseBasePrompt = `Rephrase the following text. Offer three distinct alternatives with different tones (e.g., formal, casual, poetic).`;
        if (rephrasePrompt.trim()) {
            rephraseBasePrompt = `Following this instruction: "${rephrasePrompt.trim()}", rephrase the text below. Offer three distinct alternatives.`;
        }
        prompt = `${rephraseBasePrompt}\n\n---\n${text}\n---`;
        break;
      case 'suggest':
        prompt = `I'm experiencing writer's block. Based on the text below, give me a few creative suggestions on how to continue the story or argument. Keep it concise and inspiring:\n\n---\n${text}\n---`;
        break;
    }

    const response = await generateWithGemini(model, prompt);
    setResult(response);
    setIsLoading(false);
    setActiveTask('');
  };

  const handleTextSelection = () => {
    if (textAreaRef.current) {
        const { selectionStart, selectionEnd } = textAreaRef.current;
        if (selectionStart !== selectionEnd) {
            const selected = text.substring(selectionStart, selectionEnd).trim();
            if (selected && !/\s/.test(selected) && selected.length < 50) {
                setSelectedText(selected);
                setSelectionRange({ start: selectionStart, end: selectionEnd });
                setLookupResult(null);
                setLookupError('');
            }
        } else {
            setSelectedText('');
            setSelectionRange(null);
        }
    }
  };

  const handleLookup = async (type: 'synonyms' | 'definition') => {
    if (!selectedText) return;
    setIsLookingUp(true);
    setActiveLookup(type);
    setLookupResult(null);
    setLookupError('');
    const response = await generateLookupWithGemini(selectedText, type);
    if (response.error) {
        setLookupError(response.error);
    } else {
        setLookupResult(response.data);
    }
    setIsLookingUp(false);
    setActiveLookup('');
  };

  const handleSynonymClick = (synonym: string) => {
    if (selectionRange && textAreaRef.current) {
        const { start, end } = selectionRange;
        const newText = text.substring(0, start) + synonym + text.substring(end);
        setText(newText);
        
        const newCursorPos = start + synonym.length;
        textAreaRef.current.focus();
        setTimeout(() => {
            textAreaRef.current?.setSelectionRange(newCursorPos, newCursorPos);
            setSelectedText('');
            setSelectionRange(null);
            setLookupResult(null);
        }, 0);
    }
  };
  
  const handleProofread = async () => {
    if (!text.trim()) {
        setSuggestionError("Please enter some text to proofread.");
        return;
    }
    setIsFetchingSuggestions(true);
    setSuggestionError('');
    setSuggestions([]);
    setSuggestionPanelTitle('Proofread Suggestions');
    setShowSuggestionPanel(true);
    
    const response = await proofreadWithGemini(text);
    if (response.error) {
        setSuggestionError(response.error);
    } else if (response.data) {
        setSuggestions(response.data);
    }
    setIsFetchingSuggestions(false);
  };
  
  const handleAnalyze = async () => {
    if (!text.trim()) {
        setSuggestionError("Please enter some text to analyze.");
        return;
    }
    setIsFetchingSuggestions(true);
    setSuggestionError('');
    setSuggestions([]);
    setSuggestionPanelTitle('Analysis Suggestions');
    setShowSuggestionPanel(true);
    
    const response = await analyzeTextWithGemini(text);
    if (response.error) {
        setSuggestionError(response.error);
    } else if (response.data) {
        setSuggestions(response.data);
    }
    setIsFetchingSuggestions(false);
  };

  const applySuggestion = (text: string, suggestion: ProofreadSuggestion): string => {
    const { startIndex, original, corrected } = suggestion;
    return text.substring(0, startIndex) + corrected + text.substring(startIndex + original.length);
  };

  const handleAccept = (suggestionToAccept: ProofreadSuggestion) => {
    const lenDiff = suggestionToAccept.corrected.length - suggestionToAccept.original.length;
    setText(currentText => applySuggestion(currentText, suggestionToAccept));
    setSuggestions(currentSuggestions => 
        currentSuggestions
            .filter(s => s !== suggestionToAccept)
            .map(s => {
                if (s.startIndex > suggestionToAccept.startIndex) {
                    return { ...s, startIndex: s.startIndex + lenDiff };
                }
                return s;
            })
    );
  };

  const handleReject = (suggestionToReject: ProofreadSuggestion) => {
      setSuggestions(currentSuggestions => currentSuggestions.filter(s => s !== suggestionToReject));
  };
  
  const handleAcceptAll = () => {
      let newText = text;
      const sortedSuggestions = [...suggestions].sort((a, b) => b.startIndex - a.startIndex);
      
      sortedSuggestions.forEach(suggestion => {
          newText = applySuggestion(newText, suggestion);
      });

      setText(newText);
      setSuggestions([]);
  };

  const handleSuggestionHover = (suggestion: ProofreadSuggestion | null) => {
    if (suggestion && textAreaRef.current) {
        const { startIndex } = suggestion;
        const textUpTo = text.substring(0, startIndex);
        const lines = textUpTo.split('\n').length;
        const avgLineHeight = 27.2; // 1.1rem * 1.7 line-height
        textAreaRef.current.scrollTop = Math.max(0, (lines - 4) * avgLineHeight);
    }
  };

  return (
    <div className="writing-desk-container">
      <div className="desk-section">
        <h2 className="section-title">Your Draft</h2>
        <div className="editor-wrapper">
            <textarea
              ref={textAreaRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onSelect={handleTextSelection}
              placeholder="Start writing here... Select a word for the Explorer, or click Proofread to check for errors."
              className="main-textarea"
            />
        </div>
        
        <input
            type="text"
            value={rephrasePrompt}
            onChange={(e) => setRephrasePrompt(e.target.value)}
            placeholder="Optional: Guide the rephrase (e.g., 'make it more formal')"
            className="rephrase-input"
        />
        {error && <p className="error-text">{error}</p>}
        
        <div className="action-grid">
          <Button onClick={() => handleAction('rephrase')} isLoading={isLoading && activeTask === 'rephrase'} disabled={isLoading || isFetchingSuggestions}>
            Rephrase
          </Button>
          <Button onClick={() => handleAction('suggest')} isLoading={isLoading && activeTask === 'suggest'} disabled={isLoading || isFetchingSuggestions}>
            Suggest
          </Button>
          <Button onClick={handleAnalyze} isLoading={isFetchingSuggestions && suggestionPanelTitle === 'Analysis Suggestions'} disabled={isLoading || isFetchingSuggestions}>
            Analyze
          </Button>
          <Button onClick={handleProofread} isLoading={isFetchingSuggestions && suggestionPanelTitle === 'Proofread Suggestions'} disabled={isLoading || isFetchingSuggestions}>
            Proofread
          </Button>
        </div>
      </div>
      
      {showSuggestionPanel ? (
        <div className="desk-section">
            <div className="section-header">
                <h2 className="section-title">{suggestionPanelTitle}</h2>
                {suggestions.length > 0 && <Button variant="secondary" onClick={handleAcceptAll}>Accept All</Button>}
            </div>
            <div className="panel-card">
                {isFetchingSuggestions ? (
                    <Loader message={suggestionPanelTitle === 'Proofread Suggestions' ? 'Checking for errors...' : 'Analyzing for improvements...'} />
                ) : suggestionError ? (
                    <p className="error-text text-center">{suggestionError}</p>
                ) : suggestions.length > 0 ? (
                    <div className="suggestion-list">
                        {suggestions.map((s, i) => (
                            <SuggestionCard 
                                key={`${s.startIndex}-${i}`} 
                                suggestion={s} 
                                onAccept={() => handleAccept(s)}
                                onReject={() => handleReject(s)}
                                onHover={handleSuggestionHover}
                            />
                        ))}
                    </div>
                ) : (
                    <div className="panel-placeholder">
                        <p>No suggestions found. Your writing is looking great!</p>
                    </div>
                )}
            </div>
        </div>
      ) : (
      <div className="results-grid">
        <div className="desk-section">
          <h2 className="section-title">AI Assistant</h2>
          <div className="panel-card">
            {isLoading ? (
              <Loader message={activeTask === 'rephrase' ? 'Thinking...' : `Processing...`} />
            ) : result ? (
              <div className="ai-assistant-text">{result}</div>
            ) : (
              <div className="panel-placeholder">
                <p>Action results will appear here.</p>
              </div>
            )}
          </div>
        </div>

        <div className="desk-section">
          <h2 className="section-title">Word Explorer</h2>
          <div className="panel-card">
              <div className="explorer-header">
                  <span className="selected-word-badge">
                    {selectedText || '...'}
                  </span>
                  <div className="lookup-buttons">
                    <Button onClick={() => handleLookup('synonyms')} disabled={!selectedText || isLookingUp} isLoading={isLookingUp && activeLookup === 'synonyms'} variant="secondary" className="btn-sm">
                        Synonyms
                    </Button>
                    <Button onClick={() => handleLookup('definition')} disabled={!selectedText || isLookingUp} isLoading={isLookingUp && activeLookup === 'definition'} variant="secondary" className="btn-sm">
                        Define
                    </Button>
                  </div>
              </div>
              <div className="explorer-content">
                {isLookingUp ? (
                    <Loader message="Searching..."/>
                ) : lookupError ? (
                    <p className="error-text text-center">{lookupError}</p>
                ) : lookupResult ? (
                    <div>
                        {lookupResult.definition && <p className="definition-text">"{lookupResult.definition}"</p>}
                        {lookupResult.synonyms && (
                            <div className="synonym-list">
                                {lookupResult.synonyms.length > 0 ? lookupResult.synonyms.map((syn, idx) => (
                                    <button key={idx} onClick={() => handleSynonymClick(syn)} className="synonym-tag" title="Click to replace">
                                        {syn}
                                    </button>
                                )) : <p className="text-muted">No synonyms found.</p>}
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="panel-placeholder">
                        <p>Select a word in your draft to explore synonyms and definitions.</p>
                    </div>
                )}
              </div>
          </div>
        </div>
      </div>
      )}
    </div>
  );
};

export default WritingDesk;