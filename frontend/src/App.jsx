import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import DeveloperCard from '@/components/qmanager/DeveloperCard';
import { LoadingSpinner, EmptyState, Button } from '@/components/ui';
import {
  RefreshCw, AlertTriangle, Share2, Copy,
  LayoutGrid, GalleryHorizontalEnd, ChevronDown, Clock, User
} from 'lucide-react';

// ── Sync dropdown ──────────────────────────────────────────────────────────
function SyncDropdown({ meta, data, loading, onSync, snapshotMode }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  const COOLDOWN_MS = 3.5 * 60 * 60 * 1000; // 3.5 hours

  const formatLastSync = (ts, dataItems) => {
    if (!ts) {
      const fallback = dataItems?.[0]?.lastUpdated;
      if (fallback) {
        const d = new Date(fallback);
        return d.toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' });
      }
      return 'Ніколи';
    }
    const d = new Date(ts);
    return d.toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' });
  };

  const getNextSyncTime = (ts) => {
    if (!ts) return null;
    const next = new Date(ts + COOLDOWN_MS);
    return next.toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' });
  };

  const isCooldownActive = meta.lastSync && (Date.now() - meta.lastSync < COOLDOWN_MS);
  const nextSyncTime = getNextSyncTime(meta.lastSync);

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
        Оновлено: {formatLastSync(meta.lastSync, data)}
        <ChevronDown className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-2 w-64 bg-[#2a2a2a] border border-[#3a3a3a] rounded-xl shadow-2xl z-50 overflow-hidden">
          {/* Info row */}
          <div className="px-4 py-3 border-b border-[#3a3a3a]">
            <div className="text-[11px] text-gray-500 uppercase tracking-widest mb-1.5">Розклад оновлень</div>
            <div className="text-[12px] text-gray-400">
              Авто-оновлення кожні <span className="text-white font-semibold">4 год</span>
            </div>
            {isCooldownActive && nextSyncTime && (
              <div className="text-[12px] text-amber-400 mt-1">
                Ручне оновлення доступне о <span className="font-bold">{nextSyncTime}</span>
              </div>
            )}
          </div>

          {!snapshotMode && (
            <button
              onClick={() => { setOpen(false); onSync(); }}
              disabled={loading || isCooldownActive}
              className="w-full flex items-center gap-2.5 px-4 py-3 text-[13px] font-semibold text-blue-400 hover:bg-blue-500/10 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              title={isCooldownActive ? `Наступне оновлення о ${nextSyncTime}` : ''}
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              {loading ? 'Оновлення...' : isCooldownActive ? `Доступно о ${nextSyncTime}` : 'Оновити зараз'}
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
  const [syncError, setSyncError] = useState(null);

  // Telegram SDK Init
  useEffect(() => {
    if (window.Telegram?.WebApp) {
      const tg = window.Telegram.WebApp;
      tg.expand();
      if (tg.disableVerticalSwipes) tg.disableVerticalSwipes();
      tg.ready();
    }
  }, []);

  const scrollContainerRef = useRef(null);

  // Set 'all' as default when data loads
  useEffect(() => {
    if (data.length > 0 && !selectedDevId) {
      setSelectedDevId('all');
    }
  }, [data]);

  const currentIdx = data.findIndex(d => d.developer.id === selectedDevId);

  // Animated navigation & touch swipe (Using native CSS scroll snap now)
  const scrollToCard = (id) => {
    setSelectedDevId(id);
    const el = document.getElementById(`dev-card-${id}`);
    if (el && scrollContainerRef.current) {
      el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
  };

  const handleScroll = () => {
    if (!scrollContainerRef.current || viewMode !== 'swipe') return;
    const container = scrollContainerRef.current;
    const center = container.scrollLeft + container.clientWidth / 2;
    
    let closestId = null;
    let minDiff = Infinity;
    
    const cards = container.querySelectorAll('.snap-card');
    cards.forEach(card => {
      // card.offsetLeft is relative to the container if container is relative
      const cardCenter = card.offsetLeft + card.offsetWidth / 2;
      const diff = Math.abs(cardCenter - center);
      if (diff < minDiff) {
        minDiff = diff;
        closestId = card.dataset.id;
      }
    });
    
    if (closestId && closestId !== selectedDevId) {
      setSelectedDevId(closestId);
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
        const freshData = response.data.data || [];
        if (response.data.meta) setMeta(response.data.meta);

        if (freshData.length === 0 && !snapshotId) {
          setLoading(false);
          setSyncError(null);
          await triggerManualSync(selectedTimeframe);
          return;
        }

        setData(freshData);
      } else {
        throw new Error(response.data.error || 'Невідома помилка');
      }
    } catch (err) {
      setSyncError(`Помилка завантаження: ${err.response?.data?.error || err.message}`);
      if (data.length === 0) {
        setError(err.response?.data?.error || err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const triggerManualSync = async (selectedTimeframe) => {
    const tf = selectedTimeframe || timeframe;
    setLoading(true);
    setSyncError(null);
    try {
      const response = await axios.post(`/api/sync?timeframe=${tf}`);
      if (response.data.success) {
        setData(response.data.data || []);
        if (response.data.meta) setMeta(response.data.meta);
        if (response.data.syncError) {
          setSyncError(`Не вдалось отримати свіжі дані: ${response.data.syncError}. Показуються останні збережені дані.`);
        }
      } else {
        throw new Error(response.data.error);
      }
    } catch (err) {
      const errMsg = err.response?.data?.error || err.message || 'Невідома помилка';
      setSyncError(`Не вдалось оновити дані (${errMsg}). Показуються останні збережені дані.`);
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
    <div
      className="flex flex-col bg-[#1f1f1f] font-sans text-white selection:bg-blue-500/30"
      style={{
        // Telegram Mini App safe areas: top for header, bottom for nav bar
        paddingTop: 'calc(env(safe-area-inset-top, 24px) + 32px)',
        paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 80px)',
        minHeight: 'var(--tg-viewport-stable-height, 100dvh)',
      }}
    >
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
            data={data}
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

        {/* ── Timeframe tabs ── */}
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

        {/* ── Sync error banner ── */}
        {syncError && (
          <div className="flex items-start gap-3 px-4 py-3 bg-yellow-500/10 border border-yellow-500/30 rounded-xl text-[12px] text-yellow-400">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span className="flex-1">{syncError}</span>
            <button onClick={() => setSyncError(null)} className="text-yellow-500 hover:text-yellow-300 shrink-0">×</button>
          </div>
        )}

        {/* ── Developer tabs (swipe mode) ── */}
        {viewMode === 'swipe' && data.length > 0 && !snapshotMode && (
          <div className="flex overflow-x-auto gap-2 pb-0.5" style={{ scrollbarWidth: 'none' }}>
            <button
              onClick={() => setSelectedDevId('all')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full border transition-all shrink-0 ${
                selectedDevId === 'all'
                  ? 'border-blue-500 bg-blue-500/10 text-white font-medium'
                  : 'border-[#444] bg-[#2a2a2a] text-gray-400 hover:bg-[#333]'
              }`}
            >
              Всі
            </button>
            {data.map(item => (
              <button
                key={item.developer.id}
                onClick={() => scrollToCard(item.developer.id)}
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
          <div className="flex flex-col justify-center items-center py-32 gap-3">
            <LoadingSpinner size="lg" className="text-white opacity-50" />
            <p className="text-[13px] text-gray-500">Завантаження даних...</p>
          </div>
        ) : error && data.length === 0 ? (
          <EmptyState
            icon={AlertTriangle}
            title="Помилка завантаження"
            description={error}
            action={!snapshotMode && <Button onClick={() => fetchDashboardData(timeframe)}>Спробувати знову</Button>}
          />
        ) : data.length === 0 ? (
          <EmptyState title="Немає даних" description="За обраний період нічого не знайдено." />
        ) : viewMode === 'swipe' && selectedDevId === 'all' ? (
          /* ── ALL DEVS GRID & CHART ── */
          <div className="flex flex-col gap-6 mt-2">
            {/* Simple Bar Chart */}
            <div className="bg-[#2a2a2a] p-5 rounded-2xl border border-[#333]">
              <h3 className="text-[14px] font-bold text-gray-200 mb-4 flex items-center gap-2">
                <Clock className="w-4 h-4 text-blue-400" /> Активність команди
              </h3>
              <div className="flex flex-col gap-3">
                {data.map(item => {
                  const hours = Number(item.analysis?.time_tracked_hours || 0);
                  const maxHours = Math.max(...data.map(d => Number(d.analysis?.time_tracked_hours || 0)), 8);
                  const pct = Math.max((hours / maxHours) * 100, 2);
                  return (
                    <div key={item.developer.id} className="flex items-center gap-3">
                      <div className="w-6 h-6 rounded-full overflow-hidden shrink-0 bg-[#444] flex items-center justify-center">
                        {item.developer.avatarUrl ? (
                          <img src={item.developer.avatarUrl} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <User className="w-3 h-3 text-gray-400" />
                        )}
                      </div>
                      <div className="w-24 text-[11px] font-medium text-gray-300 truncate shrink-0">
                        {item.developer.name}
                      </div>
                      <div className="flex-1 h-2.5 bg-[#1f1f1f] rounded-full overflow-hidden">
                        <div className="h-full bg-blue-500 rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                      <div className="w-10 text-right text-[11px] font-bold text-gray-400 shrink-0">
                        {hours.toFixed(1)} г
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {data.map(item => (
                 <div
                   key={item.developer.id}
                   onClick={() => scrollToCard(item.developer.id)}
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
          </div>
        ) : viewMode === 'swipe' ? (
          /* ── SWIPE MODE: Native CSS Scroll Snap ── */
          <div
            ref={scrollContainerRef}
            onScroll={handleScroll}
            className="flex overflow-x-auto snap-x snap-mandatory gap-4 w-full px-2 py-2 -mx-2 no-scrollbar items-start relative"
            style={{ scrollBehavior: 'smooth' }}
          >
            {data.map(item => (
              <div 
                key={item.developer.id} 
                id={`dev-card-${item.developer.id}`}
                data-id={item.developer.id}
                className="snap-card min-w-[88%] sm:min-w-[400px] snap-center shrink-0 h-fit"
              >
                <DeveloperCard
                  developer={item.developer}
                  analysis={item.analysis}
                  timeframe={timeframe}
                  youtrackUrl={meta.youtrackUrl}
                  isSwipeMode={true}
                />
              </div>
            ))}
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
