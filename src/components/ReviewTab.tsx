import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { Search, Copy, Check, MessageSquare } from 'lucide-react';
import Button from './common/Button';
import Loader from './common/Loader';
import { reviewPassageWithGemini } from '../services/geminiService';
import './ReviewTab.css';

const ReviewTab: React.FC = () => {
    const [text, setText] = useState<string>('');
    const [feedback, setFeedback] = useState<string>('');
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [showCopyToast, setShowCopyToast] = useState<boolean>(false);

    const handleReview = async () => {
        if (!text.trim()) return;
        
        setIsLoading(true);
        const result = await reviewPassageWithGemini(text);
        setIsLoading(false);

        if (result.feedback) {
            setFeedback(result.feedback);
        } else if (result.error) {
            setFeedback(`### Error\n${result.error}`);
        }
    };

    const handleCopy = () => {
        if (!text) return;
        navigator.clipboard.writeText(text);
        setShowCopyToast(true);
        setTimeout(() => setShowCopyToast(false), 3000);
    };

    return (
        <div className="review-tabs-container">
            <div className="review-layout">
                {/* Input Section */}
                <section className="input-section">
                    <header className="section-header">
                        <h3><MessageSquare size={18} /> Passage for Review</h3>
                        <div className="header-actions">
                            <Button 
                                variant="secondary" 
                                onClick={handleCopy}
                                disabled={!text}
                            >
                                <Copy size={14} style={{ marginRight: '6px' }} /> Copy Text
                            </Button>
                        </div>
                    </header>
                    <textarea
                        className="review-textarea"
                        placeholder="Paste your paragraphs or entire passage here for Gemini to review..."
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                    />
                    <div className="action-bar">
                        <Button 
                            onClick={handleReview} 
                            disabled={isLoading || !text.trim()}
                            isLoading={isLoading}
                        >
                            <Search size={18} style={{ marginRight: '8px' }} /> Run Review
                        </Button>
                    </div>
                </section>

                {/* Feedback Section */}
                <section className="feedback-section">
                    <header className="section-header">
                        <h3><Check size={18} /> Reader's Perspective</h3>
                    </header>
                    <div className="feedback-content">
                        {isLoading ? (
                            <div className="feedback-placeholder">
                                <Loader />
                                <p>Gemini is reading your story...</p>
                            </div>
                        ) : feedback ? (
                            <div className="feedback-text">
                                <ReactMarkdown>{feedback}</ReactMarkdown>
                            </div>
                        ) : (
                            <div className="feedback-placeholder">
                                <Search size={48} />
                                <p>Enter text and click 'Run Review' to get feedback from a reader's perspective.</p>
                            </div>
                        )}
                    </div>
                </section>
            </div>

            {showCopyToast && (
                <div className="copy-success-toast">
                    Text copied to clipboard!
                </div>
            )}
        </div>
    );
};

export default ReviewTab;
