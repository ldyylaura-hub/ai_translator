import { useState, useEffect } from 'react';

export interface HistoryItem {
  source: string;
  target: string;
  time: number;
}

export function useHistory() {
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  // Load history from localStorage on mount and listen for changes
  useEffect(() => {
      const loadHistory = () => {
          const saved = localStorage.getItem('translation_history');
          if (saved) {
              try {
                  setHistory(JSON.parse(saved));
              } catch (e) {
                  console.error("Failed to load history", e);
              }
          }
      };

      loadHistory();

      const handleStorageChange = (e: StorageEvent) => {
          if (e.key === 'translation_history') {
              loadHistory();
          }
      };
      
      // Custom event for same-tab updates
      const handleCustomEvent = () => loadHistory();

      window.addEventListener('storage', handleStorageChange);
      window.addEventListener('history-updated', handleCustomEvent);
      
      return () => {
          window.removeEventListener('storage', handleStorageChange);
          window.removeEventListener('history-updated', handleCustomEvent);
      };
  }, []);

  const addToHistory = (src: string, tgt: string) => {
      if (!src || !tgt) return;
      setHistory(prev => {
          // Avoid duplicates at the top
          if (prev.length > 0 && prev[0].source === src && prev[0].target === tgt) return prev;
          const newHistory = [{ source: src, target: tgt, time: Date.now() }, ...prev].slice(0, 100); // Keep last 100
          localStorage.setItem('translation_history', JSON.stringify(newHistory));
          
          // Dispatch event for same-tab sync
          window.dispatchEvent(new Event('history-updated'));
          
          return newHistory;
      });
  };
  
  const clearHistory = () => {
      if (confirm('Are you sure you want to clear all history?')) {
          setHistory([]);
          localStorage.removeItem('translation_history');
          window.dispatchEvent(new Event('history-updated'));
      }
  };

  return {
    history,
    showHistory,
    setShowHistory,
    addToHistory,
    clearHistory
  };
}
