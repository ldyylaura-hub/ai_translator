import { useState, useRef, useEffect } from 'react';

export function useGlossary() {
  const [glossary, setGlossary] = useState<Record<string, string>>({});
  // workerRef and requestIdRef are internal to the hook, but performTranslation needs access to worker
  // or we expose a match function.
  const workerRef = useRef<Worker | null>(null);
  const requestIdRef = useRef(0);

  useEffect(() => {
    if (typeof window !== 'undefined') {
        workerRef.current = new Worker('/glossary-worker.js');
        workerRef.current.onmessage = (e) => {
             const { type, payload } = e.data;
             if (type === 'LOAD_COMPLETE') {
                 // console.log(`Worker loaded ${payload.count} items.`);
             }
        };
    }
    return () => {
        workerRef.current?.terminate();
    };
  }, []);

  // When glossary updates, send it to worker
  useEffect(() => {
      if (workerRef.current && Object.keys(glossary).length > 0) {
          workerRef.current.postMessage({ type: 'LOAD_GLOSSARY', payload: glossary });
      }
  }, [glossary]);

  const findMatchInWorker = async (text: string, silent = false): Promise<{ type: 'FULL' | 'PARTIAL', text: string } | null> => {
      if (!workerRef.current || Object.keys(glossary).length === 0) return null;

      const requestId = ++requestIdRef.current;
      
      return new Promise((resolve) => {
          const handler = (e: MessageEvent) => {
              const { id, type, payload } = e.data;
              
              if (id !== requestId) return;

              if (type === 'MATCH_FOUND' || type === 'SUBSTITUTION_DONE') {
                  workerRef.current?.removeEventListener('message', handler);
                  if (!silent) console.log(`Worker matched: ${payload.method}`);
                  
                  if (type === 'SUBSTITUTION_DONE') {
                       resolve({ type: 'PARTIAL', text: payload.text });
                  } else {
                       resolve({ type: 'FULL', text: payload.translated });
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
              payload: { text, silent } 
          });

          // Timeout fallback
          setTimeout(() => {
              workerRef.current?.removeEventListener('message', handler);
              resolve(null);
          }, 5000);
      });
  };

  return {
    glossary,
    setGlossary,
    findMatchInWorker
  };
}
