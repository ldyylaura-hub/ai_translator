'use client';

import { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { Upload, Languages, Volume2, ArrowRight, Loader2, History as HistoryIcon, X, MonitorPlay, StopCircle, Settings } from 'lucide-react';
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

  const [autoCapture, setAutoCapture] = useState(false);
  const pipVideoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    // Load SQL.js for SQLite support
    if (typeof window !== 'undefined' && !(window as any).initSqlJs) {
        const script = document.createElement('script');
        script.src = '/sql-wasm.js';
        script.async = true;
        document.body.appendChild(script);
    }
  }, []);

  useEffect(() => {
    return () => {
      stopScreenShare();
      if (pipVideoRef.current) {
        pipVideoRef.current.remove();
      }
    };
  }, []);

  // State for crop box
  const [cropRegions, setCropRegions] = useState<Array<{ x: number, y: number, width: number, height: number }>>([]);
  const [isSelecting, setIsSelecting] = useState(false);
  const selectionStartRef = useRef<{ x: number, y: number } | null>(null);

  const [showCropOverlay, setShowCropOverlay] = useState(false);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const [tempCrop, setTempCrop] = useState<{ x: number, y: number, width: number, height: number } | null>(null);

  const startCropSelection = () => {
      setShowCropOverlay(true);
  };

  useEffect(() => {
      if (showCropOverlay && videoRef.current && overlayCanvasRef.current) {
          const video = videoRef.current;
          const canvas = overlayCanvasRef.current;
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          const ctx = canvas.getContext('2d');
          if (ctx) {
              ctx.drawImage(video, 0, 0);
              
              // Draw existing regions
              if (cropRegions.length > 0) {
                  ctx.strokeStyle = '#3b82f6'; // blue-500
                  ctx.lineWidth = 4;
                  ctx.fillStyle = 'rgba(59, 130, 246, 0.2)';
                  
                  cropRegions.forEach((r, i) => {
                      ctx.fillRect(r.x, r.y, r.width, r.height);
                      ctx.strokeRect(r.x, r.y, r.width, r.height);
                      
                      // Draw label
                      ctx.fillStyle = '#3b82f6';
                      ctx.fillRect(r.x, r.y - 24, 30, 24);
                      ctx.fillStyle = '#ffffff';
                      ctx.font = 'bold 14px Arial';
                      ctx.fillText(`${i+1}`, r.x + 10, r.y - 7);
                      
                      // Reset fill for next rect
                      ctx.fillStyle = 'rgba(59, 130, 246, 0.2)';
                  });
              }
          }
      }
  }, [showCropOverlay, cropRegions]);

  const handleOverlayMouseDown = (e: React.MouseEvent) => {
      const canvas = overlayCanvasRef.current;
      if (!canvas) return;
      
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      
      selectionStartRef.current = { x, y };
      setIsSelecting(true);
      setTempCrop({ x, y, width: 0, height: 0 });
  };

  const handleOverlayMouseMove = (e: React.MouseEvent) => {
      if (!isSelecting || !selectionStartRef.current || !overlayCanvasRef.current) return;
      
      const rect = overlayCanvasRef.current.getBoundingClientRect();
      const currentX = e.clientX - rect.left;
      const currentY = e.clientY - rect.top;
      
      const startX = selectionStartRef.current.x;
      const startY = selectionStartRef.current.y;
      
      // Constrain within canvas bounds
      const clampedX = Math.max(0, Math.min(currentX, rect.width));
      const clampedY = Math.max(0, Math.min(currentY, rect.height));

      setTempCrop({
          x: Math.min(startX, clampedX),
          y: Math.min(startY, clampedY),
          width: Math.abs(clampedX - startX),
          height: Math.abs(clampedY - startY)
      });
  };

  const handleOverlayMouseUp = () => {
      setIsSelecting(false);
      if (tempCrop && tempCrop.width > 10 && tempCrop.height > 10 && overlayCanvasRef.current) {
           const canvas = overlayCanvasRef.current;
           const rect = canvas.getBoundingClientRect();
           
           // Calculate the "fitted" dimensions manually
           const videoRatio = canvas.width / canvas.height;
           const containerRatio = rect.width / rect.height;
           
           let displayWidth, displayHeight, offsetX, offsetY;
           
           if (containerRatio > videoRatio) {
               displayHeight = rect.height;
               displayWidth = displayHeight * videoRatio;
               offsetY = 0;
               offsetX = (rect.width - displayWidth) / 2;
           } else {
               displayWidth = rect.width;
               displayHeight = displayWidth / videoRatio;
               offsetX = 0;
               offsetY = (rect.height - displayHeight) / 2;
           }
           
           // Convert mouse coordinates (tempCrop) relative to the image
           const imageX = tempCrop.x - offsetX;
           const imageY = tempCrop.y - offsetY;
           
           // Scale to original video resolution
           const scale = canvas.width / displayWidth;
           
           const newRegion = {
               x: Math.max(0, imageX * scale),
               y: Math.max(0, imageY * scale),
               width: tempCrop.width * scale,
               height: tempCrop.height * scale
           };
           
           setCropRegions(prev => [...prev, newRegion]);
           setTempCrop(null); // Clear temp crop but keep overlay open for more
      }
      // Don't close overlay immediately to allow multiple selections
      // setShowCropOverlay(false); 
  };

  // Effect to handle Auto Capture Loop
  useEffect(() => {
    if (isScreenSharing && autoCapture) {
        // Interval: 1.5 seconds (Optimized for performance)
        intervalRef.current = setInterval(() => {
            captureScreenAndTranslate(true); // true = silent mode
        }, 1500);
    } else {
        if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
        }
    }
    return () => {
        if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isScreenSharing, autoCapture]);

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

  const handleAutoCaptureToggle = () => {
    const newState = !autoCapture;
    setAutoCapture(newState);
    
    if (newState) {
        updatePiPWindow("Waiting for translation...");
    }
  };

  const handleManualScan = () => {
      updatePiPWindow("Scanning...");
      captureScreenAndTranslate(false);
  };

  const stopScreenShare = () => {
    setAutoCapture(false);
    setShowCropOverlay(false); // Ensure overlay is closed
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    if (videoRef.current && videoRef.current.srcObject) {
      const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
      tracks.forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    
    // Close PiP if active
    if (document.pictureInPictureElement) {
        document.exitPictureInPicture();
    }
    
    setIsScreenSharing(false);
  };

  const [pipWidth, setPipWidth] = useState(600);
  const [pipHeight, setPipHeight] = useState(200);
  const [pipFontSize, setPipFontSize] = useState(20); // Default font size 20px
  const [showPipSettings, setShowPipSettings] = useState(false);
  const [ocrMode, setOcrMode] = useState<'accurate' | 'basic'>('accurate'); // Default to accurate
  const [glossary, setGlossary] = useState<Record<string, string>>({});
  const [glossaryNormalized, setGlossaryNormalized] = useState<Record<string, string>>({});
  const [glossaryTerms, setGlossaryTerms] = useState<string[]>([]);
  
  // Worker for matching logic
  const workerRef = useRef<Worker | null>(null);
  
  // Unique ID for worker requests to avoid race conditions
  const requestIdRef = useRef(0);

  useEffect(() => {
    if (typeof window !== 'undefined') {
        workerRef.current = new Worker('/glossary-worker.js');
        workerRef.current.onmessage = (e) => {
             const { type, payload } = e.data;
             if (type === 'LOAD_COMPLETE') {
                 // Suppress log to avoid hydration mismatch/error overlay in dev
                 // console.log(`Worker loaded ${payload.count} items.`);
             }
        };
    }
    return () => {
        workerRef.current?.terminate();
    };
  }, []);
  
  // Helper to normalize strings for comparison (remove punctuation, whitespace, lowercase)
  const normalizeForMatch = (str: string) => str.toLowerCase().replace(/[^\w\u4e00-\u9fa5\u3040-\u30ff\u31f0-\u31ff\uac00-\ud7af]/g, '');

  // When glossary updates, send it to worker and clear local state if needed
  useEffect(() => {
      // We don't need to process it on main thread anymore!
      // Just send to worker.
      if (workerRef.current && Object.keys(glossary).length > 0) {
          workerRef.current.postMessage({ type: 'LOAD_GLOSSARY', payload: glossary });
      }
      
      // We can keep glossaryNormalized empty on main thread to save memory
      // setGlossaryNormalized({});
      // setGlossaryTerms([]);
  }, [glossary]);

  const glossaryInputRef = useRef<HTMLInputElement>(null);

  const handleGlossaryUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      
      const isSqlite = file.name.endsWith('.sqlite') || file.name.endsWith('.db');
      
      if (isSqlite) {
          if (!(window as any).initSqlJs) {
              alert("SQL.js is still loading. Please wait a moment and try again.");
              return;
          }
          
          const reader = new FileReader();
          reader.onload = async (event) => {
              try {
                  const buffer = event.target?.result as ArrayBuffer;
                  const SQL = await (window as any).initSqlJs({
                      locateFile: (file: string) => `/${file}`
                  });
                  
                  const db = new SQL.Database(new Uint8Array(buffer));
                  
                  // Get first table that is not a system table
                  const tablesQuery = db.exec("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'");
                  if (tablesQuery.length === 0 || tablesQuery[0].values.length === 0) {
                      alert("No tables found in the database.");
                      db.close();
                      return;
                  }
                  
                  const tableName = tablesQuery[0].values[0][0];
                  
                  // Query all data
                  const dataQuery = db.exec(`SELECT * FROM "${tableName}"`);
                  if (dataQuery.length === 0 || dataQuery[0].values.length === 0) {
                      alert(`Table ${tableName} is empty.`);
                      db.close();
                      return;
                  }
                  
                  const rows = dataQuery[0].values;
                  const columns = dataQuery[0].columns;
                  
                  const newEntries: Record<string, string> = {};
                  let count = 0;
                  
                  // Heuristic: Try to find columns named 'source'/'original' and 'target'/'translation'
                  // Otherwise fallback to index 0 and 1
                  let sourceIdx = 0;
                  let targetIdx = 1;
                  
                  if (columns.length >= 2) {
                      const lowerCols = columns.map((c: string) => c.toLowerCase());
                      const sIdx = lowerCols.findIndex((c: string) => c.includes('source') || c.includes('origin') || c.includes('key') || c.includes('original') || c.includes('zh') || c.includes('cn') || c.includes('ja') || c.includes('en'));
                      const tIdx = lowerCols.findIndex((c: string) => c.includes('target') || c.includes('trans') || c.includes('val') || c.includes('translated'));
                      
                      if (sIdx !== -1 && tIdx !== -1 && sIdx !== tIdx) {
                          sourceIdx = sIdx;
                          targetIdx = tIdx;
                      }
                  } else {
                       alert("Table must have at least 2 columns (Source, Target).");
                       db.close();
                       return;
                  }

                  rows.forEach((row: any[], index: number) => {
                      if (row[sourceIdx] && row[targetIdx]) {
                          let sVal = String(row[sourceIdx]).trim();
                          let tVal = String(row[targetIdx]).trim();
                          
                          // Handle JSON structure in target value
                          if (tVal.startsWith('{') && tVal.endsWith('}')) {
                              try {
                                  const parsed = JSON.parse(tVal);
                                  // Priority: 'rengong' -> 'machine' -> first value
                                  if (parsed.rengong) tVal = parsed.rengong;
                                  else if (parsed.machine) tVal = parsed.machine;
                                  else {
                                      const keys = Object.keys(parsed);
                                      if (keys.length > 0) tVal = parsed[keys[0]];
                                  }
                              } catch (e) {
                                  // ignore invalid json
                              }
                          }
                          
                          newEntries[sVal] = tVal;
                          count++;
                      }
                  });
                  
                  setGlossary(prev => ({ ...prev, ...newEntries }));
                  
                  // Simple Success Alert
                  alert(`Successfully imported ${count} entries from '${tableName}'.`);
                  
                  db.close();

               } catch (err) {
                  console.error("SQLite import failed", err);
                  alert("Failed to parse SQLite file: " + err);
               }
           };
          reader.readAsArrayBuffer(file);
      } else {
          // JSON handling
          const reader = new FileReader();
          reader.onload = (event) => {
              try {
                  const json = JSON.parse(event.target?.result as string);
                  if (typeof json === 'object' && json !== null) {
                      setGlossary(prev => ({ ...prev, ...json }));
                      alert(`Successfully imported ${Object.keys(json).length} translation entries.`);
                  } else {
                      alert("Invalid JSON format. Expected a key-value object.");
                  }
              } catch (err) {
                  console.error("Glossary import failed", err);
                  alert("Failed to parse JSON file.");
              }
          };
          reader.readAsText(file);
      }
      e.target.value = ''; // Reset
  };

  const updatePiPWindow = (text: string, options?: { width?: number, height?: number, fontSize?: number }) => {
    // Use the persistent canvas ref
    if (!pipCanvasRef.current) {
        pipCanvasRef.current = document.createElement('canvas');
    }
    const pipCanvas = pipCanvasRef.current;
    
    const w = options?.width ?? pipWidth;
    const h = options?.height ?? pipHeight;
    const fs = options?.fontSize ?? pipFontSize;

    // Update dimensions if changed
    if (pipCanvas.width !== w || pipCanvas.height !== h) {
        pipCanvas.width = w;
        pipCanvas.height = h;
    }
    
    const ctx = pipCanvas.getContext('2d');
    if (!ctx) return;

    // Draw Background
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)'; // Semi-transparent black/gray
    ctx.fillRect(0, 0, pipCanvas.width, pipCanvas.height);

    // Draw Text
    ctx.fillStyle = '#ffffff';
    // Use dynamic font size
    ctx.font = `500 ${fs}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif`; 
    ctx.textBaseline = 'top';
    
    // Smart wrapping based on dynamic width and font size
    const chars = text.split('');
    let line = '';
    let y = 16;
    const maxWidth = w - 40; // Dynamic max width with padding
    const lineHeight = fs * 1.5; // Dynamic line height (1.5x font size)
    
    for (let i = 0; i < chars.length; i++) {
        const char = chars[i];
        const testLine = line + char;
        const metrics = ctx.measureText(testLine);
        
        if (metrics.width > maxWidth && i > 0) {
            ctx.fillText(line, 20, y);
            line = char;
            y += lineHeight;
            
            if (y > pipCanvas.height - lineHeight) {
                ctx.fillText("...", 20, y);
                break;
            }
        } else {
            line = testLine;
        }
    }
    if (y <= pipCanvas.height - lineHeight) {
        ctx.fillText(line, 20, y);
    }

    // If PiP video element doesn't exist, create it
    if (!pipVideoRef.current) {
        const video = document.createElement('video');
        video.muted = true;
        video.autoplay = true;
        video.style.position = 'fixed';
        video.style.bottom = '0';
        video.style.right = '0';
        video.style.width = '1px';
        video.style.height = '1px';
        video.style.pointerEvents = 'none';
        video.style.opacity = '0'; // Hide it visually from page
        document.body.appendChild(video);
        pipVideoRef.current = video;
    }

    // Initialize stream only ONCE using the SAME canvas
    if (!pipVideoRef.current.srcObject) {
        const stream = pipCanvas.captureStream();
        pipVideoRef.current.srcObject = stream;
        
        pipVideoRef.current.onloadedmetadata = () => {
            pipVideoRef.current?.play();
            // Enter PiP
            pipVideoRef.current?.requestPictureInPicture().catch(e => console.error("PiP Error", e));
        };
    } else {
        // If stream exists but PiP is not active, try to open it
        // This works if the function is called via a user gesture (e.g. clicking Scan, toggling Auto, or dragging sliders)
        if (!document.pictureInPictureElement) {
             pipVideoRef.current.requestPictureInPicture().catch(e => {
                 // console.warn("Auto-open PiP failed (needs user gesture):", e);
             });
        }
    }
  };
  
  // Ref to hold persistent PiP canvas
  const pipCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Ref for image comparison to save OCR quota
  const prevImageRef = useRef<Uint8ClampedArray | null>(null);

  const checkImageSimilarity = (ctx: CanvasRenderingContext2D, width: number, height: number): boolean => {
      // Downscale for performance and noise tolerance
      const sampleSize = 32;
      const smallCanvas = document.createElement('canvas');
      smallCanvas.width = sampleSize;
      smallCanvas.height = sampleSize;
      const smallCtx = smallCanvas.getContext('2d');
      if (!smallCtx) return false;

      smallCtx.drawImage(ctx.canvas, 0, 0, width, height, 0, 0, sampleSize, sampleSize);
      const imageData = smallCtx.getImageData(0, 0, sampleSize, sampleSize).data;
      
      if (!prevImageRef.current) {
          prevImageRef.current = imageData;
          return false; // First frame, always process
      }

      // Compare with previous
      let diff = 0;
      const totalPixels = sampleSize * sampleSize;
      
      for (let i = 0; i < imageData.length; i += 4) {
          // Compare RGB (skip Alpha)
          diff += Math.abs(imageData[i] - prevImageRef.current[i]);     // R
          diff += Math.abs(imageData[i+1] - prevImageRef.current[i+1]); // G
          diff += Math.abs(imageData[i+2] - prevImageRef.current[i+2]); // B
      }
      
      const averageDiff = diff / (totalPixels * 3);
      
      // Update previous reference
      prevImageRef.current = imageData;

      // Threshold: if average pixel difference is less than 5 (out of 255), consider it same
      // Video noise is usually small.
      return averageDiff < 5;
  };

  const captureScreenAndTranslate = (silent = false) => {
    if (!videoRef.current || !canvasRef.current || !isScreenSharing) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d', { willReadFrequently: true });

    if (!context) return;

    if (cropRegions.length > 0) {
        // Multi-region Stitching
        // 1. Calculate total height and max width
        const totalHeight = cropRegions.reduce((sum, r) => sum + r.height, 0);
        const maxWidth = Math.max(...cropRegions.map(r => r.width));
        
        // Add some padding between regions (e.g. 20px white space) to help OCR distinguish paragraphs
        const padding = 20;
        const finalHeight = totalHeight + (cropRegions.length - 1) * padding;
        
        canvas.width = maxWidth;
        canvas.height = finalHeight;
        
        // Fill white background
        context.fillStyle = '#FFFFFF';
        context.fillRect(0, 0, canvas.width, canvas.height);
        
        let currentY = 0;
        cropRegions.forEach((region) => {
            context.drawImage(
                video,
                region.x, region.y, region.width, region.height,
                0, currentY, region.width, region.height
            );
            currentY += region.height + padding;
        });

    } else {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
    }
    
    // Check for similarity to save quota (Only in Auto Mode)
    if (silent) { // silent=true implies auto capture loop
        const isSame = checkImageSimilarity(context, canvas.width, canvas.height);
        if (isSame) {
            console.log("Skipping OCR: Screen content unchanged");
            return;
        }
    }

    const base64String = canvas.toDataURL('image/jpeg');
    
    // Call existing OCR logic
    processOCR(base64String, silent);
  };

  const processOCR = async (base64String: string, silent = false) => {
    if (loadingOCR) return; // Prevent overlapping requests
    
    if (!silent) setLoadingOCR(true);
    try {
      const res = await axios.post('/api/ocr', { 
          imageBase64: base64String,
          mode: ocrMode,
          lang: sourceLang // Pass the currently selected source language
      });
      if (res.data.text) {
        const text = res.data.text;
        
        // Only update if text is different to avoid jitter?
        // Ideally yes, but for now let's just update.
        if (text !== sourceText) {
             setSourceText(text);
             // Auto translate logic...
             if (sourceLang === 'auto') {
               // ... (existing detection logic)
               const hasChinese = /[\u4e00-\u9fa5]/.test(text);
               const hasJapaneseOrKorean = /[\u3040-\u30ff\u31f0-\u31ff\uac00-\ud7af]/.test(text);
               let newTargetLang = targetLang;
               if (hasChinese && !hasJapaneseOrKorean) newTargetLang = 'en';
               else if (hasJapaneseOrKorean || /[a-zA-Z]/.test(text)) newTargetLang = 'zh';
               
               if (newTargetLang !== targetLang) setTargetLang(newTargetLang);
               
               await performTranslation(text, sourceLang, newTargetLang, silent);
             } else {
               await performTranslation(text, sourceLang, targetLang, silent);
             }
        }
      }
    } catch (error: any) {
      console.error('OCR failed', error);
      if (!silent) {
         // Only show alert if manual scan
         // alert('OCR failed: ' + (error.response?.data?.error || error.message));
      }
    } finally {
      if (!silent) setLoadingOCR(false);
    }
  };

  const performTranslation = async (text: string, sLang: string, tLang: string, silent = false) => {
    const trimmedText = text.trim();

    // Delegate ALL matching to Worker
    if (workerRef.current && Object.keys(glossary).length > 0) {
        // Increment request ID
        const requestId = ++requestIdRef.current;
        
        try {
            const workerResult = await new Promise<string | null>((resolve) => {
                const handler = (e: MessageEvent) => {
                    const { id, type, payload } = e.data;
                    
                    // Only handle messages for THIS request
                    if (id !== requestId) return;

                    if (type === 'MATCH_FOUND' || type === 'SUBSTITUTION_DONE') {
                        workerRef.current?.removeEventListener('message', handler);
                        if (!silent) console.log(`Worker matched: ${payload.method}`);
                        
                        // For Substitution, the payload is the text to be translated
                        if (type === 'SUBSTITUTION_DONE') {
                             // We still need to call API, so resolve with SPECIAL prefix or object?
                             // Let's resolve with object to distinguish
                             resolve(JSON.stringify({ type: 'PARTIAL', text: payload.text }));
                        } else {
                             // Full match found
                             resolve(JSON.stringify({ type: 'FULL', text: payload.translated }));
                        }
                    } else if (type === 'NO_MATCH') {
                        workerRef.current?.removeEventListener('message', handler);
                        resolve(null);
                    }
                };

                workerRef.current?.addEventListener('message', handler);
                workerRef.current?.postMessage({ 
                    id: requestId,
                    type: 'FIND_MATCH', 
                    payload: { text: trimmedText, silent } 
                });

                // Timeout fallback (e.g. 5 seconds)
                setTimeout(() => {
                    workerRef.current?.removeEventListener('message', handler);
                    resolve(null);
                }, 5000);
            });

            if (workerResult) {
                const result = JSON.parse(workerResult);
                if (result.type === 'FULL') {
                    // Exact/Fuzzy match found -> Done
                    setTargetText(result.text);
                    if (onTranslationComplete) onTranslationComplete();
                    if (autoCapture || document.pictureInPictureElement) updatePiPWindow(result.text);
                    return;
                } else if (result.type === 'PARTIAL') {
                    // Substitution applied -> Continue to API
                    text = result.text; // Update text for API call
                }
            }
        } catch (e) {
            console.error("Worker error", e);
        }
    }

    if (!silent) setLoadingTranslate(true);
    try {
      const res = await axios.post('/api/translate', {
        text: text, // Use potentially modified text
        sourceLang: sLang,
        targetLang: tLang,
      });
      if (res.data.translatedText) {
        const translated = res.data.translatedText;
        setTargetText(translated);
        if (onTranslationComplete) onTranslationComplete();
        
        // Update PiP window if active
        if (autoCapture) {
            updatePiPWindow(translated);
        } else if (document.pictureInPictureElement) {
             // Even if not auto capture, if PiP is open (e.g. from previous manual scan), update it
             updatePiPWindow(translated);
        }
      }
    } catch (error) {
      console.error('Translation failed', error);
    } finally {
      if (!silent) setLoadingTranslate(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset input value to allow re-uploading the same file
    e.target.value = '';

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

  return (
    <div className="bg-white/30 backdrop-blur-md rounded-xl shadow-lg overflow-hidden border border-white/20 transition-colors duration-300">
      {/* Controls */}
      <div className="bg-white/20 backdrop-blur-sm px-6 py-4 border-b border-white/10 flex flex-wrap gap-4 justify-between items-center">
        <div className="flex items-center gap-2">
          <select 
            value={sourceLang} 
            onChange={(e) => setSourceLang(e.target.value)}
            className="border border-white/20 rounded-md px-3 py-1.5 bg-white/30 backdrop-blur-sm focus:ring-2 focus:ring-blue-500 outline-none"
          >
            <option value="auto">Auto Detect</option>
            {LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.name}</option>)}
          </select>
          <ArrowRight className="w-4 h-4 text-gray-600" />
          <select 
            value={targetLang} 
            onChange={(e) => setTargetLang(e.target.value)}
            className="border border-white/20 rounded-md px-3 py-1.5 bg-white/30 backdrop-blur-sm focus:ring-2 focus:ring-blue-500 outline-none"
          >
            {LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.name}</option>)}
          </select>
        </div>

        <button 
          onClick={handleTranslate}
          disabled={loadingTranslate || !sourceText}
          className="bg-blue-600/90 hover:bg-blue-600 text-white px-6 py-2 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 font-medium transition-all shadow-md hover:shadow-lg backdrop-blur-sm"
        >
          {loadingTranslate ? <Loader2 className="w-4 h-4 animate-spin" /> : <Languages className="w-4 h-4" />}
          Translate
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 h-[600px] divide-y md:divide-y-0 md:divide-x divide-white/10 relative">
        {/* Hidden Video/Canvas for Screen Capture */}
        <video ref={videoRef} className="hidden" autoPlay playsInline muted />
        <canvas ref={canvasRef} className="hidden" />

        {/* Crop Overlay */}
        {showCropOverlay && (
            <div 
                className="absolute inset-0 z-50 bg-black/50 cursor-crosshair flex items-center justify-center select-none"
                onMouseDown={handleOverlayMouseDown}
                onMouseMove={handleOverlayMouseMove}
                onMouseUp={handleOverlayMouseUp}
            >
                <div className="relative w-full h-full">
                    {/* Background Canvas (Video Frame) */}
                    <canvas 
                        ref={overlayCanvasRef}
                        className="w-full h-full object-contain pointer-events-none"
                    />
                    
                    {/* Selection Box */}
                    {tempCrop && (
                        <div 
                            className="absolute border-2 border-red-500 bg-red-500/20 pointer-events-none"
                            style={{
                                left: tempCrop.x,
                                top: tempCrop.y,
                                width: tempCrop.width,
                                height: tempCrop.height
                            }}
                        />
                    )}
                    
                    <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-black/80 text-white px-4 py-2 rounded-md pointer-events-none text-center">
                        <div className="font-bold">Draw multiple boxes to select regions.</div>
                        <div className="text-xs text-gray-300">Close overlay when done. ({cropRegions.length} selected)</div>
                    </div>

                    {/* Failsafe Close Button (Top Right) */}
                    <button 
                        className="absolute top-4 right-4 bg-red-600 hover:bg-red-700 text-white p-2 rounded-full shadow-lg z-50 pointer-events-auto transition-transform hover:scale-110"
                        onClick={(e) => {
                            e.stopPropagation(); // Prevent drawing trigger
                            setShowCropOverlay(false);
                        }}
                        title="Exit Crop Mode"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>
            </div>
        )}

        {/* Source Panel */}
        <div className="flex flex-col h-full relative bg-transparent overflow-hidden border-r border-white/10">
          <div className="flex-1 relative min-h-0">
            <textarea
                className="absolute inset-0 w-full h-full p-6 resize-none outline-none text-base text-gray-900 placeholder-gray-600 bg-transparent overflow-y-auto"
                placeholder="Enter text to translate..."
                value={sourceText}
                onChange={handleTextChange}
            />
          </div>
        </div>

        {/* Target Panel */}
        <div className="p-6 flex flex-col bg-transparent h-full overflow-hidden">
          <div className="flex-1 w-full text-base text-gray-900 whitespace-pre-wrap overflow-y-auto min-h-0">
            {targetText || <span className="text-gray-600">Translation will appear here...</span>}
          </div>

          <div className="mt-4 flex justify-between items-center border-t border-white/10 pt-4 shrink-0">
            <div className="flex items-center gap-2">
               <select 
                value={voiceType} 
                onChange={(e) => setVoiceType(Number(e.target.value))}
                className="text-sm border-none bg-transparent text-gray-800 focus:ring-0 cursor-pointer hover:text-blue-600"
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

      {/* Bottom Toolbar (Separated) */}
      <div className="px-6 py-4 bg-white/40 backdrop-blur-md border-t border-white/20 flex flex-wrap justify-between items-center gap-y-2">
            <div className="text-xs text-gray-600 font-medium flex items-center gap-2">
                <span>{sourceText.length} chars</span>
                {sourceText && (
                <button 
                  onClick={() => setSourceText('')}
                  className="text-gray-500 hover:text-red-600 p-1 rounded-md hover:bg-red-50 transition-colors"
                  title="Clear Text"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-2 justify-end items-center">
              <input 
                type="file" 
                ref={fileInputRef} 
                className="hidden" 
                accept="image/*" 
                onChange={handleFileUpload}
              />
              
              <button 
                onClick={() => fileInputRef.current?.click()}
                disabled={loadingOCR}
                className="text-gray-500 hover:text-blue-600 p-2 rounded-md hover:bg-blue-50 transition-colors tooltip flex items-center gap-1"
                title="Upload Image (OCR)"
                translate="no"
              >
                <span className="w-5 h-5 flex items-center justify-center">
                    {loadingOCR ? <Loader2 className="w-5 h-5 animate-spin" /> : <Upload className="w-5 h-5" />}
                </span>
                <span className="text-xs font-bold">UPLOAD</span>
              </button>

              {/* Screen Share Controls */}
              {!isScreenSharing ? (
                <button
                  onClick={startScreenShare}
                  className="text-gray-500 hover:text-blue-600 p-2 rounded-md hover:bg-blue-50 transition-colors tooltip flex items-center gap-1"
                  title="Start Screen Translate"
                >
                  <MonitorPlay className="w-5 h-5" />
                  <span className="text-xs font-bold">SCREEN</span>
                </button>
              ) : (
                <div className="flex flex-wrap items-center gap-2 justify-end">
                   {/* Crop Button */}
                   <button
                    onClick={() => {
                        if (showCropOverlay) setShowCropOverlay(false);
                        else startCropSelection();
                    }}
                    className={clsx(
                        "px-3 py-1.5 rounded-md text-xs font-bold transition-all border whitespace-nowrap flex items-center gap-1",
                        cropRegions.length > 0
                            ? "text-white bg-blue-500 border-blue-600" 
                            : "text-gray-600 bg-gray-100 border-gray-300 hover:bg-gray-200"
                    )}
                    title={showCropOverlay ? "Click Overlay to Finish" : "Select Crop Area (Click multiple times to add regions)"}
                  >
                    {showCropOverlay ? "DONE" : (cropRegions.length > 0 ? `CROP (${cropRegions.length})` : "CROP")}
                  </button>
                  
                  {cropRegions.length > 0 && (
                      <button
                        onClick={() => setCropRegions([])}
                        className="text-gray-500 hover:text-red-600 px-2 py-1.5 rounded-md text-xs font-bold border border-gray-200 hover:bg-red-50"
                        title="Clear All Crop Regions"
                      >
                        RESET
                      </button>
                  )}

                   <button
                    onClick={handleAutoCaptureToggle}
                    className={clsx(
                        "px-3 py-1.5 rounded-md text-xs font-bold transition-all border whitespace-nowrap flex items-center gap-1",
                        autoCapture 
                            ? "text-white bg-green-500 border-green-600 animate-pulse" 
                            : "text-gray-600 bg-gray-100 border-gray-300 hover:bg-gray-200"
                    )}
                    title={autoCapture ? "Auto Mode ON" : "Enable Auto Mode"}
                  >
                    {autoCapture ? "LIVE" : "AUTO"}
                  </button>
                   <button
                    onClick={handleManualScan}
                    className="text-white bg-red-500 hover:bg-red-600 px-3 py-1.5 rounded-md text-xs font-bold whitespace-nowrap"
                    title="Capture & Translate Now"
                  >
                    SCAN
                  </button>
                  
                  {/* PiP Settings Toggle */}
                  <div className="relative">
                      <button
                        onClick={() => setShowPipSettings(!showPipSettings)}
                        className={clsx(
                            "p-1.5 rounded-md transition-colors border border-transparent",
                            showPipSettings ? "bg-gray-200 text-gray-800" : "text-gray-500 hover:bg-gray-100 hover:border-gray-200"
                        )}
                        title="PiP Window Settings"
                      >
                        <Settings className="w-5 h-5" />
                      </button>
                      
                      {/* Settings Popup */}
                      {showPipSettings && (
                          <div className="absolute bottom-full mb-2 right-0 bg-white p-4 rounded-lg shadow-xl border border-gray-200 w-72 z-50">
                              <h4 className="font-bold text-gray-800 mb-3 text-sm border-b pb-2">Settings</h4>
                              
                              <div className="mb-4">
                                  <h5 className="font-bold text-gray-700 mb-2 text-xs">OCR Precision (Cost)</h5>
                                  <div className="flex gap-2">
                                      <button
                                        onClick={() => setOcrMode('accurate')}
                                        className={clsx(
                                            "flex-1 py-1.5 px-2 rounded-md text-xs font-medium border transition-colors",
                                            ocrMode === 'accurate' 
                                                ? "bg-blue-50 border-blue-500 text-blue-700" 
                                                : "bg-white border-gray-300 text-gray-600 hover:bg-gray-50"
                                        )}
                                      >
                                          High Precision
                                          <div className="text-[10px] opacity-70">More accurate, $$</div>
                                      </button>
                                      <button
                                        onClick={() => setOcrMode('basic')}
                                        className={clsx(
                                            "flex-1 py-1.5 px-2 rounded-md text-xs font-medium border transition-colors",
                                            ocrMode === 'basic' 
                                                ? "bg-green-50 border-green-500 text-green-700" 
                                                : "bg-white border-gray-300 text-gray-600 hover:bg-gray-50"
                                        )}
                                      >
                                          Standard
                                          <div className="text-[10px] opacity-70">Faster, cheaper</div>
                                      </button>
                                  </div>
                              </div>

                              <h5 className="font-bold text-gray-700 mb-2 text-xs">PiP Window</h5>
                              <div className="space-y-3">
                                  <div>
                                      <div className="flex justify-between text-xs text-gray-600 mb-1">
                                          <span>Width</span>
                                          <span>{pipWidth}px</span>
                                      </div>
                                      <input 
                                        type="range" 
                                        min="300" 
                                        max="3840" 
                                        step="10"
                                        value={pipWidth}
                                        onChange={(e) => {
                                            const val = Number(e.target.value);
                                            setPipWidth(val);
                                            // Pass explicit values to avoid stale state in closure
                                            updatePiPWindow(targetText || "Adjusting size...", { width: val });
                                        }}
                                        className="w-full"
                                      />
                                  </div>
                                  
                                  <div>
                                      <div className="flex justify-between text-xs text-gray-600 mb-1">
                                          <span>Height</span>
                                          <span>{pipHeight}px</span>
                                      </div>
                                      <input 
                                        type="range" 
                                        min="100" 
                                        max="2160" 
                                        step="10"
                                        value={pipHeight}
                                        onChange={(e) => {
                                            const val = Number(e.target.value);
                                            setPipHeight(val);
                                            updatePiPWindow(targetText || "Adjusting size...", { height: val });
                                        }}
                                        className="w-full"
                                      />
                                  </div>

                                  <div>
                                      <div className="flex justify-between text-xs text-gray-600 mb-1">
                                          <span>Font Size (Resolution)</span>
                                          <span>{pipFontSize}px</span>
                                      </div>
                                      <input 
                                        type="range" 
                                        min="12" 
                                        max="120" 
                                        step="2"
                                        value={pipFontSize}
                                        onChange={(e) => {
                                            const val = Number(e.target.value);
                                            setPipFontSize(val);
                                            updatePiPWindow(targetText || "Adjusting font...", { fontSize: val });
                                        }}
                                        className="w-full"
                                      />
                                  </div>
                                  
                              <div className="mb-4 pt-4 border-t border-gray-100">
                                  <h5 className="font-bold text-gray-700 mb-2 text-xs">Translation Memory (Local)</h5>
                                  <input 
                                      type="file" 
                                      ref={glossaryInputRef} 
                                      className="hidden" 
                                      accept=".json, .sqlite, .db" 
                                      onChange={handleGlossaryUpload}
                                  />
                                  <div className="flex gap-2 items-center">
                                      <button
                                        onClick={() => glossaryInputRef.current?.click()}
                                        className="flex-1 bg-white border border-gray-300 text-gray-600 hover:bg-gray-50 py-1.5 px-2 rounded-md text-xs font-medium transition-colors flex items-center justify-center gap-1"
                                      >
                                          <Upload className="w-3 h-3" />
                                          Import Glossary (JSON/DB)
                                      </button>
                                      <div className="text-[10px] text-gray-400">
                                          {Object.keys(glossary).length} entries
                                      </div>
                                  </div>
                                  <div className="text-[10px] text-gray-400 mt-1">
                                      Supports JSON or SQLite (.db/.sqlite)
                                  </div>
                              </div>

                              <div className="pt-2 border-t border-gray-100 flex flex-col gap-2">
                                      <button 
                                        onClick={() => {
                                            updatePiPWindow(targetText || "PiP Window Opened");
                                        }}
                                        className="w-full bg-blue-600 text-white rounded-md py-1.5 text-xs font-bold hover:bg-blue-700 transition-colors shadow-sm"
                                      >
                                          Open Floating Window
                                      </button>
                                      
                                      <div className="flex justify-between gap-2">
                                          <button 
                                            onClick={() => {
                                                setPipWidth(600);
                                                setPipHeight(200);
                                                setPipFontSize(20);
                                                updatePiPWindow(targetText || "Resetting...", { width: 600, height: 200, fontSize: 20 });
                                            }}
                                            className="text-xs text-blue-600 hover:underline"
                                          >
                                              Reset Default
                                          </button>
                                          <button 
                                            onClick={() => setShowPipSettings(false)}
                                            className="text-xs text-gray-500 hover:text-gray-800"
                                          >
                                              Close
                                          </button>
                                      </div>
                                  </div>
                              </div>
                          </div>
                      )}
                  </div>

                  <button
                    onClick={stopScreenShare}
                    className="text-red-500 hover:text-red-700 p-2 rounded-md hover:bg-red-50 transition-colors"
                    title="Stop Screen Translate"
                  >
                    <StopCircle className="w-5 h-5" />
                  </button>
                </div>
              )}
            </div>
      </div>
    </div>
  );
}
