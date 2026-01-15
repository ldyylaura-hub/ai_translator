import { useState, useRef, useEffect, ChangeEvent } from 'react';
import axios from 'axios';

export const LANGUAGES = [
  { code: 'zh', name: 'Chinese (Simplified)' },
  { code: 'en', name: 'English' },
  { code: 'ja', name: 'Japanese' },
  { code: 'ko', name: 'Korean' },
  { code: 'fr', name: 'French' },
  { code: 'es', name: 'Spanish' },
  { code: 'de', name: 'German' },
  { code: 'ru', name: 'Russian' },
];

export const VOICES = [
  { id: 101001, name: 'Voice 1 (Female)' },
  { id: 101002, name: 'Voice 2 (Female)' },
  { id: 101003, name: 'Voice 3 (Male)' },
  { id: 101004, name: 'Voice 4 (Male)' },
];

interface UseTranslatorProps {
  onTranslationComplete?: () => void;
  addToHistory?: (src: string, tgt: string) => void;
  updatePiPWindow?: (text: string) => void;
  autoCapture?: boolean;
  findMatchInWorker?: (text: string, silent?: boolean) => Promise<{ type: 'FULL' | 'PARTIAL', text: string } | null>;
}

export function useTranslator({ onTranslationComplete, addToHistory, updatePiPWindow, autoCapture, findMatchInWorker }: UseTranslatorProps = {}) {
  const [sourceText, setSourceText] = useState('');
  const [targetText, setTargetText] = useState('');
  const [sourceLang, setSourceLang] = useState('auto');
  const [targetLang, setTargetLang] = useState('en');
  const [voiceType, setVoiceType] = useState(101001);
  
  const [loadingTranslate, setLoadingTranslate] = useState(false);
  const [loadingTTS, setLoadingTTS] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);

  const handleTextChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
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

  const performTranslation = async (text: string, sLang: string, tLang: string, silent = false) => {
    const trimmedText = text.trim();

    // Check Worker/Glossary first
    if (findMatchInWorker) {
        try {
            const workerResult = await findMatchInWorker(trimmedText, silent);
            if (workerResult) {
                if (workerResult.type === 'FULL') {
                    setTargetText(workerResult.text);
                    if (addToHistory) addToHistory(trimmedText, workerResult.text);
                    if (onTranslationComplete) onTranslationComplete();
                    if (updatePiPWindow) updatePiPWindow(workerResult.text);
                    return;
                } else if (workerResult.type === 'PARTIAL') {
                    text = workerResult.text; // Update text for API call
                }
            }
        } catch (e) {
            console.error("Worker match error", e);
        }
    }

    if (!silent) setLoadingTranslate(true);
    try {
      const res = await axios.post('/api/translate', {
        text: text,
        sourceLang: sLang,
        targetLang: tLang,
      });
      if (res.data.translatedText) {
        const translated = res.data.translatedText;
        setTargetText(translated);
        if (addToHistory) addToHistory(trimmedText, translated);
        if (onTranslationComplete) onTranslationComplete();
        
        // Update PiP window if active
        if (updatePiPWindow) {
             updatePiPWindow(translated);
        }
      }
    } catch (error: any) {
      console.error('Translation failed', error);
      if (!silent) {
         const msg = error.response?.data?.error || 'Translation failed. Please check your network or API keys.';
         setTargetText(`Error: ${msg}`);
      }
    } finally {
      if (!silent) setLoadingTranslate(false);
    }
  };

  const handleTranslate = async () => {
    if (!sourceText) return;
    await performTranslation(sourceText, sourceLang, targetLang);
  };

  const speakWithBrowser = (text: string) => {
    if ('speechSynthesis' in window) {
      // Cancel any ongoing speech
      window.speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(text);
      
      // Map our language codes to browser locales
      const langMap: Record<string, string> = {
        'zh': 'zh-CN',
        'en': 'en-US',
        'ja': 'ja-JP',
        'ko': 'ko-KR',
        'fr': 'fr-FR',
        'es': 'es-ES',
        'de': 'de-DE',
        'ru': 'ru-RU'
      };
      
      utterance.lang = langMap[targetLang] || 'en-US';
      window.speechSynthesis.speak(utterance);
    } else {
      alert('Your browser does not support text-to-speech.');
    }
  };

  const handleTTS = async () => {
    if (!targetText) return;
    setLoadingTTS(true);
    try {
      const res = await axios.post('/api/tts', {
        text: targetText,
        voiceType,
        lang: targetLang,
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
      console.error('TTS API failed, switching to browser TTS', error);
      // Fallback to browser native TTS (Free)
      speakWithBrowser(targetText);
    } finally {
      setLoadingTTS(false);
    }
  };

  return {
    sourceText,
    setSourceText,
    targetText,
    setTargetText,
    sourceLang,
    setSourceLang,
    targetLang,
    setTargetLang,
    voiceType,
    setVoiceType,
    loadingTranslate,
    loadingTTS,
    handleTextChange,
    handleTranslate,
    handleTTS,
    performTranslation, // Exported for use in OCR/Screen share
    audioRef
  };
}
