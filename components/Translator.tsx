'use client';

import { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { Upload, Languages, Volume2, ArrowRight, Loader2, History as HistoryIcon, X, MonitorPlay, StopCircle } from 'lucide-react';
import clsx from 'clsx';

const LANGUAGES = [
  { code: 'zh', name: 'Chinese (Simplified)' },
  { code: 'en', name: 'English' },
  { code: 'ja', name: 'Japanese' },
  { code: 'ko', name: 'Korean' },
  { code: 'fr', name: 'French' },
  { code: 'es', name: 'Spanish' },
  { code: 'de', name: 'German' },
  { code: 'ru', name: 'Russian' },
];

const VOICES = [
  { id: 101001, name: 'Zhiyu (Female)' },
  { id: 101002, name: 'Zhiling (Female)' },
  { id: 101003, name: 'Zhiping (Male)' },
  { id: 101004, name: 'Zhilun (Male)' },
];

export default function Translator({ onTranslationComplete }: { onTranslationComplete?: () => void }) {
  const [sourceText, setSourceText] = useState('');
  const [targetText, setTargetText] = useState('');
  const [sourceLang, setSourceLang] = useState('auto');
  const [targetLang, setTargetLang] = useState('en');
  const [voiceType, setVoiceType] = useState(101001);
  
  const [loadingOCR, setLoadingOCR] = useState(false);
  const [loadingTranslate, setLoadingTranslate] = useState(false);
  const [loadingTTS, setLoadingTTS] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      stopScreenShare();
    };
  }, []);

  const startScreenShare = async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ 
        video: true, 
        audio: false 
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }

      setIsScreenSharing(true);
      
      // Stop sharing when user clicks "Stop sharing" browser UI
      stream.getVideoTracks()[0].onended = () => {
        stopScreenShare();
      };

    } catch (err) {
      console.error("Error sharing screen: " + err);
    }
  };

  const stopScreenShare = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    if (videoRef.current && videoRef.current.srcObject) {
      const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
      tracks.forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    setIsScreenSharing(false);
  };

  const captureScreenAndTranslate = () => {
    if (!videoRef.current || !canvasRef.current || !isScreenSharing) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');

    if (!context) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    const base64String = canvas.toDataURL('image/jpeg');
    
    // Call existing OCR logic
    processOCR(base64String);
  };

  const processOCR = async (base64String: string) => {
    if (loadingOCR) return; // Prevent overlapping requests
    
    setLoadingOCR(true);
    try {
      const res = await axios.post('/api/ocr', { imageBase64: base64String });
      if (res.data.text) {
        const text = res.data.text;
        setSourceText(text);
        
        // Trigger translation manually since setSourceText is async and we want immediate translation
        // But better let the useEffect or handleTextChange logic handle language detection?
        // Let's reuse the auto-detect logic here
        if (sourceLang === 'auto') {
           const hasChinese = /[\u4e00-\u9fa5]/.test(text);
           const hasJapaneseOrKorean = /[\u3040-\u30ff\u31f0-\u31ff\uac00-\ud7af]/.test(text);
     
           let newTargetLang = targetLang;
           if (hasChinese && !hasJapaneseOrKorean) {
             newTargetLang = 'en';
           } else if (hasJapaneseOrKorean || /[a-zA-Z]/.test(text)) {
             newTargetLang = 'zh';
           }
           setTargetLang(newTargetLang);
           
           // Perform translation
           await performTranslation(text, sourceLang, newTargetLang);
        } else {
           await performTranslation(text, sourceLang, targetLang);
        }
      }
    } catch (error: any) {
      console.error('OCR failed', error);
    } finally {
      setLoadingOCR(false);
    }
  };

  const performTranslation = async (text: string, sLang: string, tLang: string) => {
    setLoadingTranslate(true);
    try {
      const res = await axios.post('/api/translate', {
        text: text,
        sourceLang: sLang,
        targetLang: tLang,
      });
      if (res.data.translatedText) {
        setTargetText(res.data.translatedText);
        if (onTranslationComplete) onTranslationComplete();
      }
    } catch (error) {
       console.error('Translation failed', error);
    } finally {
      setLoadingTranslate(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64String = reader.result as string;
      processOCR(base64String);
    };
    reader.readAsDataURL(file);
  };

const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value;
    setSourceText(text);
    
    // Auto-switch target language only when user is typing and source is auto
    if (sourceLang === 'auto' && text.length > 0) {
      // 1. Detect if text contains Chinese characters
      const hasChinese = /[\u4e00-\u9fa5]/.test(text);
      
      // 2. Detect if text contains Japanese/Korean characters (Hiragana, Katakana, Hangul)
      const hasJapaneseOrKorean = /[\u3040-\u30ff\u31f0-\u31ff\uac00-\ud7af]/.test(text);

      if (hasChinese && !hasJapaneseOrKorean) {
        // If it looks like pure Chinese, translate to English
        setTargetLang('en');
      } else if (hasJapaneseOrKorean) {
         // If it has Japanese/Korean, translate to Chinese
         setTargetLang('zh');
      } else {
        // For other cases (mostly Latin/English), translate to Chinese
        // But only if it has some content
        if (/[a-zA-Z]/.test(text)) {
           setTargetLang('zh');
        }
      }
    }
  };

  const handleTranslate = async () => {
    if (!sourceText) return;
    setLoadingTranslate(true);
    try {
      const res = await axios.post('/api/translate', {
        text: sourceText,
        sourceLang,
        targetLang,
      });
      if (res.data.translatedText) {
        setTargetText(res.data.translatedText);
        if (onTranslationComplete) onTranslationComplete();
      }
    } catch (error: any) {
      console.error('Translation failed', error);
      const msg = error.response?.data?.error || 'Translation failed. Please check your network or API keys.';
      alert(msg);
    } finally {
      setLoadingTranslate(false);
    }
  };

  const handleTTS = async () => {
    if (!targetText) return;
    setLoadingTTS(true);
    try {
      const res = await axios.post('/api/tts', {
        text: targetText,
        voiceType,
      });
      if (res.data.audio) {
        const audioSrc = `data:audio/mp3;base64,${res.data.audio}`;
        if (audioRef.current) {
          audioRef.current.src = audioSrc;
          audioRef.current.play();
        } else {
          const audio = new Audio(audioSrc);
          audioRef.current = audio;
          audio.play();
        }
      }
    } catch (error: any) {
      console.error('TTS failed', error);
      const msg = error.response?.data?.error || 'TTS failed. Please check your network or API keys.';
      alert(msg);
    } finally {
      setLoadingTTS(false);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-lg overflow-hidden border border-gray-100">
      {/* Controls */}
      <div className="bg-gray-50 px-6 py-4 border-b border-gray-200 flex flex-wrap gap-4 justify-between items-center">
        <div className="flex items-center gap-2">
          <select 
            value={sourceLang} 
            onChange={(e) => setSourceLang(e.target.value)}
            className="border rounded-md px-3 py-1.5 bg-white focus:ring-2 focus:ring-blue-500 outline-none"
          >
            <option value="auto">Auto Detect</option>
            {LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.name}</option>)}
          </select>
          <ArrowRight className="w-4 h-4 text-gray-400" />
          <select 
            value={targetLang} 
            onChange={(e) => setTargetLang(e.target.value)}
            className="border rounded-md px-3 py-1.5 bg-white focus:ring-2 focus:ring-blue-500 outline-none"
          >
            {LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.name}</option>)}
          </select>
        </div>

        <button 
          onClick={handleTranslate}
          disabled={loadingTranslate || !sourceText}
          className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 font-medium transition-all"
        >
          {loadingTranslate ? <Loader2 className="w-4 h-4 animate-spin" /> : <Languages className="w-4 h-4" />}
          Translate
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 h-[500px] divide-y md:divide-y-0 md:divide-x divide-gray-200">
        {/* Hidden Video/Canvas for Screen Capture */}
        <video ref={videoRef} className="hidden" autoPlay playsInline muted />
        <canvas ref={canvasRef} className="hidden" />

        {/* Source Panel */}
        <div className="p-6 flex flex-col relative">
          <textarea
            className="flex-1 w-full resize-none outline-none text-lg text-gray-800 placeholder-gray-300"
            placeholder="Enter text to translate..."
            value={sourceText}
            onChange={handleTextChange}
          />
          
          <div className="mt-4 flex justify-between items-center">
            <div className="text-xs text-gray-400">{sourceText.length} chars</div>
            <div className="flex gap-2">
              <input 
                type="file" 
                ref={fileInputRef} 
                className="hidden" 
                accept="image/*" 
                onChange={handleFileUpload}
              />
              
              {/* Screen Share Controls */}
              {!isScreenSharing ? (
                <button
                  onClick={startScreenShare}
                  className="text-gray-500 hover:text-blue-600 p-2 rounded-md hover:bg-blue-50 transition-colors tooltip"
                  title="Start Screen Translate"
                >
                  <MonitorPlay className="w-5 h-5" />
                </button>
              ) : (
                <div className="flex items-center gap-1">
                   <button
                    onClick={captureScreenAndTranslate}
                    className="text-white bg-red-500 hover:bg-red-600 px-3 py-1 rounded-md text-xs font-bold animate-pulse"
                    title="Capture & Translate Now"
                  >
                    SCAN
                  </button>
                  <button
                    onClick={stopScreenShare}
                    className="text-red-500 hover:text-red-700 p-2 rounded-md hover:bg-red-50 transition-colors"
                    title="Stop Screen Translate"
                  >
                    <StopCircle className="w-5 h-5" />
                  </button>
                </div>
              )}

              <button 
                onClick={() => fileInputRef.current?.click()}
                disabled={loadingOCR}
                className="text-gray-500 hover:text-blue-600 p-2 rounded-md hover:bg-blue-50 transition-colors tooltip"
                title="Upload Image (OCR)"
              >
                {loadingOCR ? <Loader2 className="w-5 h-5 animate-spin" /> : <Upload className="w-5 h-5" />}
              </button>
              {sourceText && (
                <button 
                  onClick={() => setSourceText('')}
                  className="text-gray-500 hover:text-red-600 p-2 rounded-md hover:bg-red-50 transition-colors"
                  title="Clear"
                >
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Target Panel */}
        <div className="p-6 flex flex-col bg-gray-50/50">
          <div className="flex-1 w-full text-lg text-gray-800 whitespace-pre-wrap overflow-y-auto">
            {targetText || <span className="text-gray-300">Translation will appear here...</span>}
          </div>

          <div className="mt-4 flex justify-between items-center border-t border-gray-200 pt-4">
            <div className="flex items-center gap-2">
               <select 
                value={voiceType} 
                onChange={(e) => setVoiceType(Number(e.target.value))}
                className="text-sm border-none bg-transparent text-gray-600 focus:ring-0 cursor-pointer hover:text-blue-600"
              >
                {VOICES.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
              </select>
            </div>
            
            <button 
              onClick={handleTTS}
              disabled={loadingTTS || !targetText}
              className="text-gray-500 hover:text-blue-600 p-2 rounded-md hover:bg-blue-50 transition-colors flex items-center gap-2"
              title="Listen"
            >
              {loadingTTS ? <Loader2 className="w-5 h-5 animate-spin" /> : <Volume2 className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
