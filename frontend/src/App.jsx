import React, { useState, useEffect } from 'react';
import axios from 'axios';
import DeveloperCard from '@/components/qmanager/DeveloperCard';
import { LoadingSpinner, EmptyState, Button } from '@/components/ui';
import { RefreshCw, AlertTriangle, Share2, Copy, LayoutGrid, GalleryHorizontalEnd, ChevronLeft, ChevronRight, User } from 'lucide-react';

function App() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [timeframe, setTimeframe] = useState('24h');
  const [snapshotMode, setSnapshotMode] = useState(false);
  const [singleDevMode, setSingleDevMode] = useState(null);
  const [meta, setMeta] = useState({ lastSync: 0, manualSyncsUsed: 0, manualSyncsMax: 50 });
  const [selectedDevId, setSelectedDevId] = useState('all');
  const [viewMode, setViewMode] = useState('swipe');
  
  // Swipe handling
  const [touchStart, setTouchStart] = useState(null);
  const [touchEnd, setTouchEnd] = useState(null);

  const onTouchStart = (e) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const onTouchMove = (e) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const onTouchEndHandler = () => {
    if (!touchStart || !touchEnd || selectedDevId === 'all') return;
    const distance = touchStart - touchEnd;
    const minSwipeDistance = 50;
    
    const currentIndex = data.findIndex(d => d.developer.id === selectedDevId);
    if (currentIndex === -1) return;

    if (distance > minSwipeDistance && currentIndex < data.length - 1) {
      // Swiped left, go to next
      setSelectedDevId(data[currentIndex + 1].developer.id);
    }
    if (distance < -minSwipeDistance && currentIndex > 0) {
      // Swiped right, go to previous
      setSelectedDevId(data[currentIndex - 1].developer.id);
    }
  };

  const goNextDev = () => {
    const currentIndex = data.findIndex(d => d.developer.id === selectedDevId);
    if (currentIndex < data.length - 1) setSelectedDevId(data[currentIndex + 1].developer.id);
  };

  const goPrevDev = () => {
    const currentIndex = data.findIndex(d => d.developer.id === selectedDevId);
    if (currentIndex > 0) setSelectedDevId(data[currentIndex - 1].developer.id);
  };
  
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
  
  const formatLastSync = (ts) => {
    if (!ts) return 'Ніколи';
    const d = new Date(ts);
    return d.toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' });
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
        if (response.data.meta) {
          setMeta(response.data.meta);
        }
      } else {
        throw new Error(response.data.error || 'Невідома помилка');
      }
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
        if (response.data.meta) {
          setMeta(response.data.meta);
        }
      } else {
        throw new Error(response.data.error);
      }
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
        
        {/* Top Header Actions */}
        <div className="flex flex-col-reverse sm:flex-row justify-between items-start sm:items-center gap-4 text-[12px] text-gray-400">
          <div className="flex flex-col">
            <span>Останнє оновлення: {formatLastSync(meta.lastSync)}</span>
            <span>Ліміт оновлень: {meta.manualSyncsUsed}/{meta.manualSyncsMax}</span>
          </div>
          
          <div className="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-end">
            <div className="flex items-center gap-3">
              <button 
                onClick={copyMarkdown}
                disabled={loading || data.length === 0}
                className="flex items-center gap-1.5 font-medium hover:text-white transition-colors disabled:opacity-50"
              >
                <Copy className="w-3.5 h-3.5" /> MD
              </button>
              <button 
                onClick={shareSnapshot}
                disabled={loading || data.length === 0}
                className="flex items-center gap-1.5 font-medium hover:text-white transition-colors disabled:opacity-50"
              >
                <Share2 className="w-3.5 h-3.5" /> Поділитись
              </button>
            </div>
            
            <div className="flex items-center gap-2 bg-[#2a2a2a] p-1 rounded-lg">
              <button 
                onClick={() => setViewMode('list')}
                className={`p-1.5 rounded-md transition-colors ${viewMode === 'list' ? 'bg-[#444] text-white' : 'text-gray-500 hover:text-gray-300'}`}
                title="Режим списку"
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button 
                onClick={() => setViewMode('swipe')}
                className={`p-1.5 rounded-md transition-colors ${viewMode === 'swipe' ? 'bg-[#444] text-white' : 'text-gray-500 hover:text-gray-300'}`}
                title="Режим свайпів"
              >
                <GalleryHorizontalEnd className="w-4 h-4" />
              </button>
            </div>
            
            {!snapshotMode && (
              <button 
                onClick={triggerManualSync}
                disabled={loading || meta.manualSyncsUsed >= meta.manualSyncsMax}
                className="flex items-center gap-1.5 font-bold text-blue-400 hover:text-blue-300 transition-colors disabled:opacity-50 uppercase tracking-wide"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                {loading ? 'Оновлення...' : 'Примусово оновити'}
              </button>
            )}
          </div>
        </div>

        {/* Timeframe Full-Width Tabs */}
        {!snapshotMode ? (
          <div className="flex w-full bg-[#2a2a2a] p-1.5 rounded-xl">
            <button
              onClick={() => { setTimeframe('24h'); fetchDashboardData('24h'); }}
              className={`flex-1 py-2.5 text-center rounded-lg text-[15px] font-semibold transition-all duration-200 ${
                timeframe === '24h' 
                  ? 'bg-[#3a3a3a] text-white shadow-sm' 
                  : 'text-gray-400 hover:text-gray-200 hover:bg-[#333]'
              }`}
            >
              Сьогодні
            </button>
            <button
              onClick={() => { setTimeframe('week'); fetchDashboardData('week'); }}
              className={`flex-1 py-2.5 text-center rounded-lg text-[15px] font-semibold transition-all duration-200 ${
                timeframe === 'week' 
                  ? 'bg-[#3a3a3a] text-white shadow-sm' 
                  : 'text-gray-400 hover:text-gray-200 hover:bg-[#333]'
              }`}
            >
              Цей тиждень
            </button>
          </div>
        ) : (
          <div className="w-full text-center py-3 bg-blue-500/10 text-blue-400 rounded-xl font-medium">
            Режим перегляду збереженого зрізу (Read-only)
          </div>
        )}

        {/* Developer Tabs (Horizontal scroll) */}
        {data.length > 0 && !snapshotMode && (
          <div className="flex overflow-x-auto pb-2 gap-3 no-scrollbar" style={{ scrollbarWidth: 'none' }}>
            <button
              onClick={() => setSelectedDevId('all')}
              className={`flex items-center gap-2 px-4 py-2 rounded-full border transition-all shrink-0 ${
                selectedDevId === 'all' 
                  ? 'border-blue-500 bg-blue-500/10 text-white font-medium' 
                  : 'border-[#444] bg-[#2a2a2a] text-gray-400 hover:bg-[#333]'
              }`}
            >
              👥 Вся команда
            </button>
            {data.map(item => (
              <button
                key={item.developer.id}
                onClick={() => setSelectedDevId(item.developer.id)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-full border transition-all shrink-0 ${
                  selectedDevId === item.developer.id 
                    ? 'border-blue-500 bg-blue-500/10 text-white font-medium' 
                    : 'border-[#444] bg-[#2a2a2a] text-gray-400 hover:bg-[#333]'
                }`}
              >
                {item.developer.avatarUrl ? (
                  <img src={item.developer.avatarUrl} alt="" className="w-6 h-6 rounded-full object-cover" />
                ) : (
                  <div className="w-6 h-6 rounded-full bg-gray-600 flex items-center justify-center text-[10px]">👤</div>
                )}
                <span className="whitespace-nowrap text-sm">{item.developer.name}</span>
              </button>
            ))}
          </div>
        )}

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
        ) : selectedDevId === 'all' && viewMode === 'swipe' ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {data.map(item => (
               <div 
                 key={item.developer.id} 
                 onClick={() => setSelectedDevId(item.developer.id)}
                 className="flex flex-col items-center gap-3 p-6 bg-[#2a2a2a] hover:bg-[#333] hover:scale-105 rounded-2xl cursor-pointer transition-all border border-[#333]"
               >
                 {item.developer.avatarUrl ? (
                   <img src={item.developer.avatarUrl} className="w-20 h-20 rounded-full object-cover border-2 border-[#444]" alt={item.developer.name} />
                 ) : (
                   <div className="w-20 h-20 rounded-full bg-[#444] flex items-center justify-center border-2 border-[#555]"><User className="w-8 h-8 text-gray-400" /></div>
                 )}
                 <div className="text-center">
                   <div className="font-bold text-[14px] text-white whitespace-nowrap overflow-hidden text-ellipsis w-28">{item.developer.name}</div>
                   <div className="text-[12px] text-gray-400 font-medium mt-1">
                     {Number(item.analysis?.time_tracked_hours || 0).toFixed(1).replace(/\.0$/, '')} год
                   </div>
                 </div>
               </div>
            ))}
          </div>
        ) : (
          <div 
            className={`w-full ${viewMode === 'swipe' && selectedDevId !== 'all' ? 'flex justify-center' : 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 items-stretch'}`}
            onTouchStart={viewMode === 'swipe' ? onTouchStart : undefined}
            onTouchMove={viewMode === 'swipe' ? onTouchMove : undefined}
            onTouchEnd={viewMode === 'swipe' ? onTouchEndHandler : undefined}
          >
            {viewMode === 'swipe' && selectedDevId !== 'all' && (
              <button 
                onClick={goPrevDev} 
                disabled={data.findIndex(d => d.developer.id === selectedDevId) === 0}
                className="hidden md:flex items-center justify-center p-4 text-gray-500 hover:text-white disabled:opacity-20 transition-colors mr-4"
              >
                <ChevronLeft className="w-10 h-10" />
              </button>
            )}

            <div className={viewMode === 'swipe' && selectedDevId !== 'all' ? 'w-full max-w-lg min-h-[500px]' : 'w-full h-full'}>
              {(selectedDevId === 'all' ? data : data.filter(d => d.developer.id === selectedDevId)).map((item, index) => (
                <DeveloperCard 
                  key={item.developer?.id || index} 
                  developer={item.developer} 
                  analysis={item.analysis} 
                  timeframe={timeframe}
                  youtrackUrl={meta.youtrackUrl}
                />
              ))}
            </div>

            {viewMode === 'swipe' && selectedDevId !== 'all' && (
              <button 
                onClick={goNextDev} 
                disabled={data.findIndex(d => d.developer.id === selectedDevId) === data.length - 1}
                className="hidden md:flex items-center justify-center p-4 text-gray-500 hover:text-white disabled:opacity-20 transition-colors ml-4"
              >
                <ChevronRight className="w-10 h-10" />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
