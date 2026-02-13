import React, { useState, useRef, useCallback } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality, Blob as GeminiBlob } from '@google/genai';
import { Mic, MicOff, Copy, Volume2, Sparkles, Brain, PencilLine } from 'lucide-react';
import { TranscriptEntry } from '../types';
import { processDictationWithGemini } from '../services/geminiService';
import Button from './common/Button';
import './IdeaPad.css';

type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error';

// Audio helper functions for Live session
const decode = (base64: string): Uint8Array => {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
};

const encode = (bytes: Uint8Array): string => {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
};

const decodeAudioData = async (
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> => {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
};

const createBlob = (data: Float32Array): GeminiBlob => {
    const l = data.length;
    const int16 = new Int16Array(l);
    for (let i = 0; i < l; i++) {
        int16[i] = data[i] * 32768;
    }
    return {
        data: encode(new Uint8Array(int16.buffer)),
        mimeType: 'audio/pcm;rate=16000',
    };
};

const IdeaPad: React.FC = () => {
    // Live Session State
    const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected');
    const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
    const sessionPromiseRef = useRef<Promise<any> | null>(null);
    const liveStreamRef = useRef<MediaStream | null>(null);
    const inputAudioContextRef = useRef<AudioContext | null>(null);
    const outputAudioContextRef = useRef<AudioContext | null>(null);
    const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
    const currentInputTranscriptionRef = useRef<string>('');
    const currentOutputTranscriptionRef = useRef<string>('');

    // Dictation State
    const [dictationText, setDictationText] = useState<string>('');
    const [isRecording, setIsRecording] = useState<boolean>(false);
    const [isProcessing, setIsProcessing] = useState<boolean>(false);
    const [showCopyToast, setShowCopyToast] = useState<boolean>(false);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    
    // Live Session Callbacks
    const startLiveSession = useCallback(async () => {
        setConnectionState('connecting');
        setTranscript([]);
        
        const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
        if (!apiKey) {
            console.error("API Key is not configured.");
            setConnectionState('error');
            return;
        }

        const ai = new GoogleGenAI({ apiKey });
        
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            liveStreamRef.current = stream;

            inputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
            outputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
            
            let nextStartTime = 0;
            const sources = new Set<AudioBufferSourceNode>();

            sessionPromiseRef.current = ai.live.connect({
                model: 'gemini-live-2.5-flash-native-audio',
                config: {
                    responseModalities: [Modality.AUDIO],
                    inputAudioTranscription: {},
                    outputAudioTranscription: {},
                    systemInstruction: 'You are a creative partner for a writer. Help them brainstorm ideas, overcome writer\'s block, and explore new creative directions. Keep your responses encouraging and concise.',
                },
                callbacks: {
                    onopen: () => {
                        setConnectionState('connected');
                        const source = inputAudioContextRef.current!.createMediaStreamSource(stream);
                        // @ts-ignore
                        scriptProcessorRef.current = inputAudioContextRef.current!.createScriptProcessor(4096, 1, 1);
                        scriptProcessorRef.current.onaudioprocess = (audioProcessingEvent) => {
                            const inputData = audioProcessingEvent.inputBuffer.getChannelData(0);
                            const pcmBlob = createBlob(inputData);
                            sessionPromiseRef.current?.then((session) => {
                                session.sendRealtimeInput({ media: pcmBlob });
                            });
                        };
                        source.connect(scriptProcessorRef.current);
                        scriptProcessorRef.current.connect(inputAudioContextRef.current!.destination);
                    },
                    onmessage: async (message: LiveServerMessage) => {
                        if (message.serverContent?.outputTranscription) {
                            currentOutputTranscriptionRef.current += message.serverContent.outputTranscription.text;
                        }
                        if (message.serverContent?.inputTranscription) {
                            currentInputTranscriptionRef.current += message.serverContent.inputTranscription.text;
                        }
                        if (message.serverContent?.turnComplete) {
                            const userInput = currentInputTranscriptionRef.current;
                            const geminiOutput = currentOutputTranscriptionRef.current;
                            setTranscript(prev => [...prev, { speaker: 'user', text: userInput }, { speaker: 'gemini', text: geminiOutput }]);
                            currentInputTranscriptionRef.current = '';
                            currentOutputTranscriptionRef.current = '';
                        }
                        
                        const base64Audio = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
                        if (base64Audio) {
                            nextStartTime = Math.max(nextStartTime, outputAudioContextRef.current!.currentTime);
                            const audioBuffer = await decodeAudioData(decode(base64Audio), outputAudioContextRef.current!, 24000, 1);
                            const sourceNode = outputAudioContextRef.current!.createBufferSource();
                            sourceNode.buffer = audioBuffer;
                            sourceNode.connect(outputAudioContextRef.current!.destination);
                            sourceNode.addEventListener('ended', () => sources.delete(sourceNode));
                            sourceNode.start(nextStartTime);
                            nextStartTime += audioBuffer.duration;
                            sources.add(sourceNode);
                        }
  
                        if (message.serverContent?.interrupted) {
                          sources.forEach(source => source.stop());
                          sources.clear();
                          nextStartTime = 0;
                        }
                    },
                    onerror: (e) => {
                        console.error("Live session error:", e);
                        setConnectionState('error');
                    },
                    onclose: () => {
                        if (connectionState !== 'error') {
                            setConnectionState('disconnected');
                        }
                    },
                },
            });

        } catch (err) {
            console.error("Failed to start session:", err);
            setConnectionState('error');
        }
    }, [connectionState]);

    const endLiveSession = useCallback(async () => {
        if (sessionPromiseRef.current) {
            const session = await sessionPromiseRef.current;
            session.close();
        }
        
        liveStreamRef.current?.getTracks().forEach(track => track.stop());
        scriptProcessorRef.current?.disconnect();
        inputAudioContextRef.current?.close();
        outputAudioContextRef.current?.close();

        sessionPromiseRef.current = null;
        setConnectionState('disconnected');
    }, []);

    // Dictation Handlers
    const startDictation = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const mediaRecorder = new MediaRecorder(stream);
            mediaRecorderRef.current = mediaRecorder;
            audioChunksRef.current = [];

            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    audioChunksRef.current.push(event.data);
                }
            };

            mediaRecorder.onstop = async () => {
                setIsProcessing(true);
                const audioBlob = new Blob(audioChunksRef.current, { type: mediaRecorder.mimeType });
                const reader = new FileReader();
                reader.onloadend = async () => {
                    const base64 = (reader.result as string).split(',')[1];
                    const result = await processDictationWithGemini(base64, dictationText, audioBlob.type);
                    
                    if (result.transcribedText) {
                        setDictationText(prev => prev ? prev + '\n\n' + result.transcribedText : result.transcribedText || '');
                    }
                    setIsProcessing(false);
                };
                reader.readAsDataURL(audioBlob);
                stream.getTracks().forEach(track => track.stop());
            };

            mediaRecorder.start();
            setIsRecording(true);
        } catch (err) {
            console.error("Failed to start dictation:", err);
        }
    };

    const stopDictation = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
        }
    };

    const handleCopyDictation = () => {
        if (!dictationText) return;
        navigator.clipboard.writeText(dictationText);
        setShowCopyToast(true);
        setTimeout(() => setShowCopyToast(false), 3000);
    };

    const StatusIndicator = () => {
        const states = {
            disconnected: { text: "Brainstorming Idle", className: "disconnected" },
            connecting: { text: "Connecting...", className: "connecting" },
            connected: { text: "Gemini is Listening", className: "connected" },
            error: { text: "Connection Error", className: "error" },
        };
        const { text, className } = states[connectionState];
        return (
            <div className="status-indicator">
                <div className={`status-dot ${className}`}></div>
                <p className="status-text">{text}</p>
            </div>
        );
    };

    return (
        <div className="idea-pad-container">
            <div className="idea-pad-layout">
                {/* Live Brainstorming Section */}
                <section className="live-session-section">
                    <header className="idea-pad-header">
                        <h2><Brain size={24} style={{ marginRight: '8px', verticalAlign: 'bottom' }} /> Brainstorm</h2>
                        <p>Real-time voice collaboration with Gemini Live.</p>
                    </header>

                    <div className="session-controls">
                        <StatusIndicator />
                        <div className="control-buttons">
                            {connectionState === 'connected' ? (
                                <Button onClick={endLiveSession} variant="secondary">
                                    <MicOff size={18} style={{ marginRight: '8px' }} /> End session
                                </Button>
                            ) : (
                                <Button onClick={startLiveSession} disabled={connectionState === 'connecting'}>
                                    <Mic size={18} style={{ marginRight: '8px' }} /> Start Gemini Live
                                </Button>
                            )}
                        </div>
                    </div>

                    <div className="chat-transcript">
                        {transcript.length === 0 && (
                            <div className="transcript-placeholder">
                                <Volume2 size={48} style={{ opacity: 0.2, marginBottom: '1rem' }} />
                                <p>Start a session to brainstorm out loud.</p>
                            </div>
                        )}
                        {transcript.map((entry, index) => (
                            <div key={index} className={`message-bubble ${entry.speaker}`}>
                                <p>{entry.text}</p>
                            </div>
                        ))}
                    </div>
                </section>

                {/* Dictation Box Section */}
                <section className="dictation-section">
                    <header className="idea-pad-header">
                        <h2><PencilLine size={24} style={{ marginRight: '8px', verticalAlign: 'bottom' }} /> Dictation Box</h2>
                        <p>Record your passage; Gemini cleans up and transcribes.</p>
                    </header>
                    
                    <div className="dictation-container">
                        <textarea
                            className="dictation-textarea"
                            placeholder="Your cleaned-up dictation will appear here. You can also paste or type directly..."
                            value={dictationText}
                            onChange={(e) => setDictationText(e.target.value)}
                        />
                        
                        <div className="dictation-controls">
                            <div className="recording-indicator">
                                {isRecording ? (
                                    <>
                                        <div className="pulse-dot"></div>
                                        <span>Recording... (Speak your story)</span>
                                    </>
                                ) : isProcessing ? (
                                    <>
                                        <Sparkles size={16} className="spinning" />
                                        <span>Gemini is polishing your words...</span>
                                    </>
                                ) : (
                                    <span>Ready to record</span>
                                )}
                            </div>
                            <div className="control-buttons">
                                <Button 
                                    variant="secondary" 
                                    onClick={handleCopyDictation}
                                    disabled={!dictationText}
                                >
                                    <Copy size={16} style={{ marginRight: '8px' }} /> Copy
                                </Button>
                                {isRecording ? (
                                    <Button onClick={stopDictation} variant="secondary">
                                        <MicOff size={18} style={{ marginRight: '8px' }} /> Stop
                                    </Button>
                                ) : (
                                    <Button onClick={startDictation} disabled={isProcessing}>
                                        <Mic size={18} style={{ marginRight: '8px' }} /> Record Passage
                                    </Button>
                                )}
                            </div>
                        </div>
                    </div>
                </section>
            </div>

            {showCopyToast && (
                <div className="copy-success-toast">
                    Transcribed text copied!
                </div>
            )}
        </div>
    );
};

export default IdeaPad;