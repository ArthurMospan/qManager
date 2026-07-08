import React, { useState, useEffect } from 'react';
import axios from 'axios';
import DeveloperCard from '@/components/qmanager/DeveloperCard';
import { LoadingSpinner, EmptyState, Button } from '@/components/ui';
import { RefreshCw, AlertTriangle, Share2, Copy } from 'lucide-react';

function App() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [timeframe, setTimeframe] = useState('24h');
  const [snapshotMode, setSnapshotMode] = useState(false);
  const [singleDevMode, setSingleDevMode] = useState(null);
  const [limits, setLimits] = useState({ count: 0, max: 10 });
  
  // Basic markdown generator
  const copyMarkdown = () => {
    let md = `# qManager Звіт (${timeframe === 'week' ? 'Цей тиждень' : 'Сьогодні'})\n\n`;
    data.forEach(item => {
      const { developer, analysis } = item;
      const { summary_done = [], in_progress = [], time_tracked_hours = 0, blockers } = analysis || {};
      
      if (summary_done.length === 0 && in_progress.length === 0 && time_tracked_hours === 0 && !blockers) {
        return; // Skip inactive
      }
      
      md += `## ${developer.name} (${Number(time_tracked_hours).toFixed(1)} год)\n`;
      if (summary_done.length > 0) {
        md += `**Виконано:**\n${summary_done.map(t => `- ${t}`).join('\n')}\n`;
      }
      if (in_progress.length > 0) {
        md += `**В роботі:**\n${in_progress.map(t => `- ${t}`).join('\n')}\n`;
      }
      if (blockers) {
        md += `**Блокери:** ${blockers}\n`;
      }
      md += `\n`;
    });
    
    navigator.clipboard.writeText(md).then(() => {
      alert('Markdown скопійовано в буфер обміну!');
    });
  };

  const shareSnapshot = async () => {
    try {
      const res = await axios.post('/api/snapshot', { data });
      if (res.data.success) {
        const url = `${window.location.origin}/?snapshot=${res.data.id}`;
        await navigator.clipboard.writeText(url);
        alert(`Посилання на цей зріз скопійовано!\n\n${url}`);
      }
    } catch (e) {
      alert('Помилка створення посилання');
    }
  };
  
  const fetchLimits = async () => {
    try {
      const res = await axios.get('/api/limits');
      if (res.data.success) {
        setLimits({ count: res.data.count, max: res.data.max });
      }
    } catch (e) {}
  };

  const fetchDashboardData = async (selectedTimeframe = timeframe, snapshotId = null) => {
    setLoading(true);
    setError(null);
    try {
      let response;
      if (snapshotId) {
        response = await axios.get(`/api/snapshot/${snapshotId}`);
      } else {
        response = await axios.get(`/api/dashboard?timeframe=${selectedTimeframe}`);
      }
      
      if (response.data.success) {
        setData(response.data.data || []);
      } else {
        throw new Error(response.data.error || 'Невідома помилка');
      }
      fetchLimits();
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setLoading(false);
    }
  };

  const triggerManualSync = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await axios.post(`/api/sync?timeframe=${timeframe}`);
      if (response.data.success) {
        setData(response.data.data || []);
      } else {
        throw new Error(response.data.error);
      }
      fetchLimits();
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const snapId = params.get('snapshot');
    const devId = params.get('devId');
    const tf = params.get('timeframe') || '24h';
    
    if (snapId) {
      setSnapshotMode(true);
      fetchDashboardData(null, snapId);
    } else {
      setTimeframe(tf);
      if (devId) setSingleDevMode(devId);
      fetchDashboardData(tf);
    }
  }, []);

  if (singleDevMode && data.length > 0) {
    const devItem = data.find(d => d.developer.id === singleDevMode);
    if (!devItem) return null;
    return (
      <div id="capture-card" className="w-[450px] p-4 bg-[#1f1f1f]">
        <DeveloperCard 
          developer={devItem.developer} 
          analysis={devItem.analysis} 
          timeframe={timeframe}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-[#1f1f1f] p-6 lg:p-10 font-sans text-white selection:bg-blue-500/30">
      <div className="max-w-7xl mx-auto w-full flex flex-col gap-8">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
          
          <div className="flex gap-6">
            {!snapshotMode && (
              <>
                <button
                  onClick={() => { setTimeframe('24h'); fetchDashboardData('24h'); }}
                  className={`text-[15px] font-medium transition-all duration-200 border-b-2 pb-1 ${
                    timeframe === '24h' 
                      ? 'text-white border-white' 
                      : 'text-[#888] border-transparent hover:text-gray-300'
                  }`}
                >
                  Сьогодні
                </button>
                <button
                  onClick={() => { setTimeframe('week'); fetchDashboardData('week'); }}
                  className={`text-[15px] font-medium transition-all duration-200 border-b-2 pb-1 ${
                    timeframe === 'week' 
                      ? 'text-white border-white' 
                      : 'text-[#888] border-transparent hover:text-gray-300'
                  }`}
                >
                  Цей тиждень
                </button>
              </>
            )}
            {snapshotMode && (
              <span className="text-[15px] font-medium text-white border-b-2 border-blue-500 pb-1">
                Перегляд зрізу (Read-only)
              </span>
            )}
          </div>
          
          {/* Actions */}
          <div className="flex items-center gap-4">
            <button 
              onClick={copyMarkdown}
              disabled={loading || data.length === 0}
              className="flex items-center gap-2 text-[14px] font-medium text-[#888] hover:text-white transition-colors disabled:opacity-50"
            >
              <Copy className="w-4 h-4" /> MD
            </button>
            <button 
              onClick={shareSnapshot}
              disabled={loading || data.length === 0}
              className="flex items-center gap-2 text-[14px] font-medium text-[#888] hover:text-white transition-colors disabled:opacity-50"
            >
              <Share2 className="w-4 h-4" /> Поділитись
            </button>
            {!snapshotMode && (
              <div className="flex flex-col items-end ml-2">
                <button 
                  onClick={triggerManualSync}
                  disabled={loading || limits.count >= limits.max}
                  className="flex items-center gap-2 text-[14px] font-medium text-blue-400 hover:text-blue-300 transition-colors disabled:opacity-50"
                >
                  <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                  {loading ? 'Оновлення...' : 'Синхронізувати'}
                </button>
                <span className="text-[11px] text-gray-500 mt-1">Оновлень сьогодні: {limits.count}/{limits.max}</span>
              </div>
            )}
          </div>
        </div>

        {/* Content */}
        {loading && data.length === 0 ? (
          <div className="flex justify-center items-center py-32">
            <LoadingSpinner size="lg" className="text-white opacity-50" />
          </div>
        ) : error ? (
          <EmptyState 
            icon={AlertTriangle}
            title="Помилка завантаження" 
            description={error}
            action={!snapshotMode && <Button onClick={() => fetchDashboardData(timeframe)}>Спробувати знову</Button>}
          />
        ) : data.length === 0 ? (
          <EmptyState 
            title="Немає даних" 
            description="За обраний період нічого не знайдено."
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 items-stretch">
            {data.map((item, index) => (
              <DeveloperCard 
                key={item.developer?.id || index} 
                developer={item.developer} 
                analysis={item.analysis} 
                timeframe={timeframe}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
