import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import DeveloperCard from '@/components/qmanager/DeveloperCard';
import { LoadingSpinner, EmptyState, Button } from '@/components/ui';
import {
  RefreshCw, AlertTriangle, Share2, Copy,
  LayoutGrid, GalleryHorizontalEnd, ChevronDown, Clock, Zap, User
} from 'lucide-react';

// ── Sync dropdown ──────────────────────────────────────────────────────────
function SyncDropdown({ meta, loading, onSync, snapshotMode }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  const formatLastSync = (ts) => {
    if (!ts) return 'Ніколи';
    const d = new Date(ts);
    return d.toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' });
  };

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-1.5 text-[12px] text-gray-400 hover:text-gray-200 transition-colors"
      >
        <Clock className="w-3.5 h-3.5" />
        Оновлено: {formatLastSync(meta.lastSync)}
        <ChevronDown className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-2 w-60 bg-[#2a2a2a] border border-[#3a3a3a] rounded-xl shadow-2xl z-50 overflow-hidden">
          <div className="px-4 py-3 border-b border-[#3a3a3a]">
            <div className="text-[11px] text-gray-500 uppercase tracking-widest mb-2">Ліміт оновлень</div>
            <div className="flex items-center gap-2">
              <div className="flex-1 bg-[#1a1a1a] rounded-full h-1.5 overflow-hidden">
                <div
                  className="h-full bg-blue-500 rounded-full transition-all"
                  style={{ width: `${(meta.manualSyncsUsed / meta.manualSyncsMax) * 100}%` }}
                />
              </div>
              <span className="text-[12px] font-bold text-gray-300 shrink-0">
                {meta.manualSyncsUsed}/{meta.manualSyncsMax}
              </span>
            </div>
          </div>

          {!snapshotMode && (
            <button
              onClick={() => { setOpen(false); onSync(); }}
              disabled={loading || meta.manualSyncsUsed >= meta.manualSyncsMax}
              className="w-full flex items-center gap-2.5 px-4 py-3 text-[13px] font-semibold text-blue-400 hover:bg-blue-500/10 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              {loading ? 'Оновлення...' : 'Примусово оновити'}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main App ───────────────────────────────────────────────────────────────
function App() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [timeframe, setTimeframe] = useState('24h');
  const [snapshotMode, setSnapshotMode] = useState(false);
  const [singleDevMode, setSingleDevMode] = useState(null);
  const [meta, setMeta] = useState({ lastSync: 0, manualSyncsUsed: 0, manualSyncsMax: 50 });
  const [selectedDevId, setSelectedDevId] = useState(null);
  const [viewMode, setViewMode] = useState('swipe');

  // Set first dev as default when data loads
  useEffect(() => {
    if (data.length > 0 && !selectedDevId) {
      setSelectedDevId(data[0].developer.id);
    }
  }, [data]);

  const currentIdx = data.findIndex(d => d.developer.id === selectedDevId);

  const goNextDev = () => {
    if (currentIdx < data.length - 1) setSelectedDevId(data[currentIdx + 1].developer.id);
  };

  const goPrevDev = () => {
    if (currentIdx > 0) setSelectedDevId(data[currentIdx - 1].developer.id);
  };

  // Touch swipe for swipe mode
  const touchStartX = useRef(0);
  const touchDeltaX = useRef(0);

  const handleTouchStart = (e) => {
    touchStartX.current = e.touches[0].clientX;
    touchDeltaX.current = 0;
  };

  const handleTouchMove = (e) => {
    touchDeltaX.current = e.touches[0].clientX - touchStartX.current;
  };

  const handleTouchEnd = () => {
    const dx = touchDeltaX.current;
    if (Math.abs(dx) > 60) {
      if (dx < 0) goNextDev();
      else goPrevDev();
    }
  };

  const copyMarkdown = () => {
    let md = `# qManager Звіт (${timeframe === 'week' ? 'Цей тиждень' : 'Сьогодні'})\n\n`;
    data.forEach(item => {
      const { developer, analysis } = item;
      const { summary_done = [], in_progress = [], time_tracked_hours = 0, blockers } = analysis || {};
      if (summary_done.length === 0 && in_progress.length === 0 && time_tracked_hours === 0 && !blockers) return;
      md += `## ${developer.name} (${Number(time_tracked_hours).toFixed(1)} год)\n`;
      if (summary_done.length > 0) md += `**Виконано:**\n${summary_done.map(t => `- ${t}`).join('\n')}\n`;
      if (in_progress.length > 0) md += `**В роботі:**\n${in_progress.map(t => `- ${t}`).join('\n')}\n`;
      if (blockers) md += `**Блокери:** ${blockers}\n`;
      md += `\n`;
    });
    navigator.clipboard.writeText(md).then(() => alert('Markdown скопійовано!'));
  };

  const shareSnapshot = async () => {
    try {
      const res = await axios.post('/api/snapshot', { data });
      if (res.data.success) {
        const url = `${window.location.origin}/?snapshot=${res.data.id}`;
        await navigator.clipboard.writeText(url);
        alert(`Посилання скопійовано!\n\n${url}`);
      }
    } catch { alert('Помилка створення посилання'); }
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
        if (response.data.meta) setMeta(response.data.meta);
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
        if (response.data.meta) setMeta(response.data.meta);
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

  // Single dev capture mode (screenshot/share)
  if (singleDevMode && data.length > 0) {
    const devItem = data.find(d => d.developer.id === singleDevMode);
    if (!devItem) return null;
    return (
      <div id="capture-card" className="w-[450px] p-4 bg-[#1f1f1f]">
        <DeveloperCard developer={devItem.developer} analysis={devItem.analysis} timeframe={timeframe} />
      </div>
    );
  }

  const currentItem = data.find(d => d.developer.id === selectedDevId);

  return (
    <div className="flex flex-col min-h-screen bg-[#1f1f1f] font-sans text-white selection:bg-blue-500/30">
      <div className="max-w-7xl mx-auto w-full flex flex-col gap-4 px-6 py-5 lg:px-10 lg:py-6">

        {/* ── Row 1: Brand + Actions ── */}
        <div className="flex items-center justify-between">
          <span className="text-[15px] font-bold tracking-tight text-white">AIW Systems</span>

          <div className="flex items-center gap-3 text-[12px] text-gray-400">
            <button
              onClick={copyMarkdown}
              disabled={loading || data.length === 0}
              className="flex items-center gap-1.5 hover:text-white transition-colors disabled:opacity-40"
            >
              <Copy className="w-3.5 h-3.5" /> Копіювати MD
            </button>
            <div className="w-px h-4 bg-[#3a3a3a]" />
            <button
              onClick={shareSnapshot}
              disabled={loading || data.length === 0}
              className="flex items-center gap-1.5 hover:text-white transition-colors disabled:opacity-40"
            >
              <Share2 className="w-3.5 h-3.5" /> Поділитись
            </button>
          </div>
        </div>

        {/* ── Row 2: Sync info + View Toggle ── */}
        <div className="flex items-center justify-between">
          <SyncDropdown
            meta={meta}
            loading={loading}
            onSync={triggerManualSync}
            snapshotMode={snapshotMode}
          />

          <div className="flex items-center gap-1.5 bg-[#2a2a2a] p-1 rounded-lg">
            <button
              onClick={() => setViewMode('swipe')}
              className={`p-1.5 rounded-md transition-colors ${viewMode === 'swipe' ? 'bg-[#444] text-white' : 'text-gray-500 hover:text-gray-300'}`}
              title="Режим свайпу"
            >
              <GalleryHorizontalEnd className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded-md transition-colors ${viewMode === 'list' ? 'bg-[#444] text-white' : 'text-gray-500 hover:text-gray-300'}`}
              title="Режим сітки"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* ── Timeframe tabs (compact height) ── */}
        {!snapshotMode ? (
          <div className="flex w-full bg-[#2a2a2a] p-1 rounded-lg">
            <button
              onClick={() => { setTimeframe('24h'); fetchDashboardData('24h'); }}
              className={`flex-1 py-1.5 text-center rounded-md text-[13px] font-semibold transition-all duration-200 ${
                timeframe === '24h'
                  ? 'bg-[#3a3a3a] text-white shadow-sm'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-[#333]'
              }`}
            >
              Сьогодні
            </button>
            <button
              onClick={() => { setTimeframe('week'); fetchDashboardData('week'); }}
              className={`flex-1 py-1.5 text-center rounded-md text-[13px] font-semibold transition-all duration-200 ${
                timeframe === 'week'
                  ? 'bg-[#3a3a3a] text-white shadow-sm'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-[#333]'
              }`}
            >
              Цей тиждень
            </button>
          </div>
        ) : (
          <div className="w-full text-center py-2 bg-blue-500/10 text-blue-400 rounded-lg text-[13px] font-medium">
            Режим перегляду збереженого зрізу (Read-only)
          </div>
        )}

        {/* ── Developer tabs (swipe mode) ── */}
        {viewMode === 'swipe' && data.length > 0 && !snapshotMode && (
          <div className="flex overflow-x-auto gap-2 pb-0.5" style={{ scrollbarWidth: 'none' }}>
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
                  <img src={item.developer.avatarUrl} alt="" className="w-5 h-5 rounded-full object-cover" />
                ) : (
                  <div className="w-5 h-5 rounded-full bg-gray-600 flex items-center justify-center">
                    <User className="w-3 h-3 text-gray-400" />
                  </div>
                )}
                <span className="whitespace-nowrap text-[12px]">{item.developer.name}</span>
              </button>
            ))}
          </div>
        )}

        {/* ── Content ── */}
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
          <EmptyState title="Немає даних" description="За обраний період нічого не знайдено." />
        ) : viewMode === 'swipe' ? (
          /* ── SWIPE MODE: one card, tabs navigate ── */
          <div
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            className="flex justify-center w-full"
          >
            <div className="w-full max-w-lg">
              {currentItem && (
                <DeveloperCard
                  developer={currentItem.developer}
                  analysis={currentItem.analysis}
                  timeframe={timeframe}
                  youtrackUrl={meta.youtrackUrl}
                  isSwipeMode={true}
                />
              )}
            </div>
          </div>
        ) : (
          /* ── LIST / GRID MODE ── */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 items-start">
            {data.map((item, index) => (
              <DeveloperCard
                key={item.developer?.id || index}
                developer={item.developer}
                analysis={item.analysis}
                timeframe={timeframe}
                youtrackUrl={meta.youtrackUrl}
                isSwipeMode={false}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
