'use client';

import { useState } from 'react';
import Translator from './Translator';
import HistoryList from './HistoryList';

export default function Dashboard() {
  const [refreshHistory, setRefreshHistory] = useState(0);

  return (
    <div className="space-y-8">
      <Translator onTranslationComplete={() => setRefreshHistory(prev => prev + 1)} />
      <HistoryList refreshTrigger={refreshHistory} />
    </div>
  );
}
