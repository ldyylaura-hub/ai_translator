'use client';

import { useEffect, useState } from 'react';
import axios from 'axios';
import { Trash2, Clock, ArrowRight } from 'lucide-react';

interface HistoryItem {
  id: number;
  sourceText: string;
  translatedText: string;
  sourceLang: string;
  targetLang: string;
  createdAt: string;
}

export default function HistoryList({ refreshTrigger }: { refreshTrigger: number }) {
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchHistory = async () => {
    try {
      const res = await axios.get('/api/history');
      setHistory(res.data.history);
    } catch (error) {
      console.error('Failed to fetch history', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, [refreshTrigger]);

  const handleDelete = async (id: number) => {
    try {
      await axios.delete(`/api/history/${id}`);
      setHistory(history.filter(item => item.id !== id));
    } catch (error) {
      console.error('Failed to delete history', error);
    }
  };

  if (loading) {
    return <div className="text-center py-8 text-gray-500">Loading history...</div>;
  }

  if (history.length === 0) {
    return (
      <div className="text-center py-12 bg-gray-50 rounded-xl border border-dashed border-gray-300">
        <Clock className="w-12 h-12 mx-auto text-gray-300 mb-3" />
        <p className="text-gray-500">No translation history yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
        <Clock className="w-5 h-5" />
        Recent Translations
      </h3>
      <div className="grid grid-cols-1 gap-4">
        {history.map((item) => (
          <div key={item.id} className="bg-white p-4 rounded-lg shadow-sm border border-gray-100 hover:shadow-md transition-shadow group">
            <div className="flex justify-between items-start mb-2">
              <div className="flex items-center gap-2 text-xs font-medium text-gray-500 uppercase tracking-wide">
                <span>{item.sourceLang}</span>
                <ArrowRight className="w-3 h-3" />
                <span>{item.targetLang}</span>
              </div>
              <button
                onClick={() => handleDelete(item.id)}
                className="text-gray-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
                title="Delete"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
            
            <div className="grid md:grid-cols-2 gap-4">
              <div className="text-gray-800 line-clamp-2">{item.sourceText}</div>
              <div className="text-blue-700 line-clamp-2">{item.translatedText}</div>
            </div>
            
            <div className="mt-2 text-xs text-gray-400">
              {new Date(item.createdAt).toLocaleString()}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
