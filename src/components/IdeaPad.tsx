import React, { useState, useRef, useCallback } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality, Blob } from '@google/genai';
import { TranscriptEntry } from '../types';
import Button from './common/Button';
import './IdeaPad.css';

type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error';

// Audio helper functions
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

const createBlob = (data: Float32Array): Blob => {
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
    const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected');
    const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
    const sessionPromiseRef = useRef<Promise<any> | null>(null);
    const audioStreamRef = useRef<MediaStream | null>(null);
    const inputAudioContextRef = useRef<AudioContext | null>(null);
    const outputAudioContextRef = useRef<AudioContext | null>(null);
    const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
    const currentInputTranscriptionRef = useRef<string>('');
    const currentOutputTranscriptionRef = useRef<string>('');
    
    const startSession = useCallback(async () => {
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
            audioStreamRef.current = stream;

            inputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
            outputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
            
            let nextStartTime = 0;
            const sources = new Set<AudioBufferSourceNode>();

            sessionPromiseRef.current = ai.live.connect({
                model: 'gemini-2.5-flash-native-audio-preview-12-2025',
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
                        // @ts-ignore - Deprecated but used for simplicity in this preview context
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

    const endSession = useCallback(async () => {
        if (sessionPromiseRef.current) {
            const session = await sessionPromiseRef.current;
            session.close();
        }
        
        audioStreamRef.current?.getTracks().forEach(track => track.stop());
        scriptProcessorRef.current?.disconnect();
        inputAudioContextRef.current?.close();
        outputAudioContextRef.current?.close();

        sessionPromiseRef.current = null;
        setConnectionState('disconnected');
    }, []);

    const StatusIndicator = () => {
        const states = {
            disconnected: { text: "Ready to Brainstorm", className: "disconnected" },
            connecting: { text: "Connecting...", className: "connecting" },
            connected: { text: "Listening...", className: "connected" },
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
            <header className="idea-pad-header">
                <h2>Live Idea Pad</h2>
                <p>Collaborate with Gemini in real-time using your voice.</p>
            </header>

            <div className="session-controls">
                <StatusIndicator />
                <div className="control-buttons">
                    <Button onClick={startSession} disabled={connectionState === 'connected' || connectionState === 'connecting'}>
                        Start Session
                    </Button>
                    <Button onClick={endSession} variant="secondary" disabled={connectionState === 'disconnected' || connectionState === 'error'}>
                        End Session
                    </Button>
                </div>
            </div>

            <div className="chat-transcript">
                {transcript.length === 0 && (
                    <div className="transcript-placeholder">
                        <p>Your brainstorming conversation will appear here.</p>
                    </div>
                )}
                {transcript.map((entry, index) => (
                    <div key={index} className={`message-bubble ${entry.speaker}`}>
                        <p>{entry.text}</p>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default IdeaPad;