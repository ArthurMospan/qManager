import React, { useState } from 'react';
import { Surface, Progress, Alert } from '@/components/ui';
import { User, CheckCircle2, Clock, AlertTriangle, Moon, RotateCw, List, MessageSquare, Timer } from 'lucide-react';

export default function DeveloperCard({ developer, analysis, timeframe, youtrackUrl }) {
  const { 
    summary_done = [], 
    in_progress = [], 
    time_tracked_hours = 0, 
    prev_time_tracked_hours = 0,
    blockers = null, 
    daily_hours = [],
    stuck_tasks = [],
    taskStates = {},
    raw_actions = []
  } = analysis || {};

  const [isFlipped, setIsFlipped] = useState(false);

  const displayHours = Number(time_tracked_hours).toFixed(1).replace(/\.0$/, '');
  const hasZeroTime = time_tracked_hours === 0;
  
  const isInactive = summary_done.length === 0 && in_progress.length === 0 && hasZeroTime && !blockers && stuck_tasks.length === 0;

  const hoursDiff = time_tracked_hours - prev_time_tracked_hours;
  const isTrendUp = hoursDiff >= 0;

  const daysAbbr = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд'];
  
  // Find max daily hours to scale the mini-chart
  const maxDaily = Math.max(...daily_hours, 8); // At least scale to 8h

  const renderTaskWithLink = (taskText) => {
    if (!youtrackUrl) return taskText;
    const regex = /\[?([A-Za-z]+-\d+)\]?/;
    const match = taskText.match(regex);
    if (match) {
      const issueId = match[1];
      const restText = taskText.replace(match[0], '').replace(/^[-:\s]+/, '');
      return (
        <span className="leading-relaxed">
          <a 
            href={`${youtrackUrl}/issue/${issueId}`} 
            target="_blank" 
            rel="noreferrer" 
            className="text-blue-500 hover:text-blue-600 hover:underline font-semibold mr-1.5 transition-colors"
          >
            [{issueId}]
          </a>
          {restText}
        </span>
      );
    }
    return taskText;
  };

  return (
    <div className="relative w-full h-full" style={{ perspective: '1000px' }}>
      <div 
        className={`w-full h-full transition-transform duration-700`}
        style={{ transformStyle: 'preserve-3d', transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0)' }}
      >
        {/* FRONT */}
        <Surface 
          className={`flex flex-col h-full bg-white rounded-xl shadow-lg border-0 overflow-hidden transition-shadow ${isInactive ? 'opacity-50 grayscale-[0.5]' : 'hover:shadow-xl'}`}
          style={{ backfaceVisibility: 'hidden' }}
        >
      
      {/* Header Profile */}
      <div className="p-6 pb-4 flex flex-col gap-4 border-b border-gray-100">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-full overflow-hidden bg-gray-100 flex items-center justify-center shrink-0 border border-gray-200">
            {developer.avatarUrl ? (
              <img src={developer.avatarUrl} alt={developer.name} className="w-full h-full object-cover" />
            ) : (
              <User className="w-6 h-6 text-gray-400" />
            )}
          </div>
          <div className="flex-1 min-w-0 flex justify-between items-center">
            <h3 className="font-bold text-gray-900 text-[16px] truncate">{developer.name}</h3>
            <div className="flex items-center gap-3">
              <div className="flex flex-col items-end">
                <div className={`text-[15px] font-bold ${hasZeroTime ? 'text-red-500' : 'text-gray-900'}`}>
                  {displayHours} <span className="text-[12px] text-gray-500 font-medium">год</span>
                </div>
                {!isInactive && timeframe === 'week' && prev_time_tracked_hours > 0 && (
                  <div className={`text-[10px] font-bold flex items-center gap-0.5 ${isTrendUp ? 'text-emerald-500' : 'text-red-500'}`}>
                    {isTrendUp ? '▲' : '▼'} {Math.abs(hoursDiff).toFixed(1)} год
                  </div>
                )}
              </div>
              {!isInactive && raw_actions.length > 0 && (
                <button 
                  onClick={() => setIsFlipped(true)} 
                  className="text-gray-400 hover:text-blue-500 p-2 -mr-2 rounded-full hover:bg-blue-50 transition-colors"
                  title="Показати історію YouTrack"
                >
                  <RotateCw className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Time Tracking Progress */}
        {!isInactive && timeframe === '24h' && (
          <div className="pt-1">
            <Progress 
              value={Math.min((time_tracked_hours / 8) * 100, 100)} 
              color={hasZeroTime ? 'red' : 'primary'}
              size="sm"
            />
          </div>
        )}

        {/* Time Tracking Week Mini-Chart */}
        {!isInactive && timeframe === 'week' && (
          <div className="flex justify-between items-end h-[40px] pt-2 gap-1">
            {daily_hours.map((hours, idx) => {
              const heightPct = Math.max(Math.min((hours / maxDaily) * 100, 100), 2); // min 2% so empty bars show as a line
              const isEmpty = hours === 0;
              return (
                <div key={idx} className="flex flex-col items-center flex-1 gap-1 group relative">
                  <div className="w-full bg-gray-100 rounded-sm overflow-hidden flex items-end h-[24px]">
                    <div 
                      className={`w-full rounded-sm transition-all duration-500 ${isEmpty ? 'bg-transparent' : 'bg-blue-500'}`} 
                      style={{ height: `${heightPct}%` }}
                    />
                  </div>
                  <span className={`text-[9px] font-medium uppercase tracking-wider ${isEmpty ? 'text-gray-300' : 'text-gray-500'}`}>
                    {daysAbbr[idx]}
                  </span>
                  
                  {/* Tooltip */}
                  {!isEmpty && (
                    <div className="absolute -top-7 opacity-0 group-hover:opacity-100 bg-gray-900 text-white text-[10px] py-0.5 px-1.5 rounded transition-opacity pointer-events-none whitespace-nowrap z-10">
                      {Number(hours).toFixed(1).replace(/\.0$/, '')} год
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Mini Dashboard */}
      {!isInactive && Object.keys(taskStates).length > 0 && (
        <div className="flex flex-wrap items-center justify-center px-4 py-3 bg-gray-50 border-b border-gray-100 gap-x-4 gap-y-2 text-[11px] font-medium text-gray-600">
          {Object.entries(taskStates).map(([state, count], idx, arr) => (
            <React.Fragment key={state}>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: state === 'Done' || state === 'Виконано' ? '#10b981' : state.toLowerCase().includes('progress') || state === 'В роботі' ? '#3b82f6' : '#8b5cf6' }}></span>
                {state}: <span className="font-bold text-gray-900">{count}</span>
              </div>
              {idx < arr.length - 1 && <div className="w-px h-3 bg-gray-200" />}
            </React.Fragment>
          ))}
        </div>
      )}

      {isInactive ? (
        <div className="flex-1 flex flex-col items-center justify-center text-gray-400 gap-3 py-10">
          <Moon className="w-10 h-10 opacity-20" />
          <span className="text-[14px] font-medium tracking-wide">Немає активності</span>
        </div>
      ) : (
        <div className="flex-1 flex flex-col p-6 gap-6 bg-[#fafafa]">
          
          {/* Lists */}
          <div className="flex flex-col gap-5 flex-1">
            {summary_done.length > 0 && (
              <div className="flex flex-col gap-2.5">
                <h4 className="text-[11px] font-bold text-emerald-600 uppercase tracking-widest flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" /> Виконано
                </h4>
                <ul className="list-disc pl-5 text-[14px] text-gray-700 space-y-2 leading-relaxed">
                  {summary_done.map((task, idx) => <li key={idx}>{renderTaskWithLink(task)}</li>)}
                </ul>
              </div>
            )}

            {in_progress.length > 0 && (
              <div className="flex flex-col gap-2.5">
                <h4 className="text-[11px] font-bold text-blue-600 uppercase tracking-widest flex items-center gap-1.5">
                  <Clock className="w-4 h-4" /> В роботі
                </h4>
                <ul className="list-disc pl-5 text-[14px] text-gray-700 space-y-2 leading-relaxed">
                  {in_progress.map((task, idx) => <li key={idx}>{renderTaskWithLink(task)}</li>)}
                </ul>
              </div>
            )}
            
            {summary_done.length === 0 && in_progress.length === 0 && !hasZeroTime && (
              <div className="text-[13px] text-gray-500 italic mt-auto">
                Час залогвано, але чітких завдань не виявлено.
              </div>
            )}
          </div>

          {/* Stuck Tasks Alert */}
          {stuck_tasks.length > 0 && (
            <div className="mt-2">
              <Alert style="danger" icon={Moon}>
                <div className="flex flex-col gap-1">
                  <span className="text-[12px] font-bold uppercase tracking-wide">⚠️ Застрягли (без змін &gt;5 днів)</span>
                  <ul className="list-disc pl-5 text-[13px] leading-relaxed">
                    {stuck_tasks.map((task, idx) => <li key={idx}>{renderTaskWithLink(task)}</li>)}
                  </ul>
                </div>
              </Alert>
            </div>
          )}

          {/* Blockers */}
          {blockers && (
            <div className="mt-2">
              <Alert style="warning" icon={AlertTriangle}>
                <div className="text-[13px] font-medium leading-relaxed">
                  {blockers}
                </div>
              </Alert>
            </div>
          )}
        </div>
      )}
        </Surface>

        {/* BACK */}
        <Surface 
          className="absolute inset-0 flex flex-col bg-white rounded-xl shadow-lg border-0 overflow-hidden"
          style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
        >
          {/* Back Header */}
          <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-gray-50 shrink-0">
             <h3 className="font-bold text-gray-900 flex items-center gap-2 text-[15px]">
               <List className="w-4 h-4 text-blue-500" /> 
               Історія ({developer.name})
             </h3>
             <button 
               onClick={() => setIsFlipped(false)} 
               className="text-gray-400 hover:text-gray-700 p-2 -mr-2 rounded-full hover:bg-gray-200 transition-colors"
             >
               <RotateCw className="w-4 h-4" />
             </button>
          </div>

          {/* Back Content (Timeline) */}
          <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-4 bg-[#fafafa]" style={{ scrollbarWidth: 'thin' }}>
             {raw_actions.length === 0 ? (
               <div className="text-[13px] text-gray-500 text-center py-10">Немає активності за цей період.</div>
             ) : (
               raw_actions.map((action, idx) => (
                  <div key={idx} className="flex flex-col gap-3 p-4 bg-white border border-gray-100 rounded-lg shadow-sm">
                     
                     {/* Issue Header */}
                     <div className="flex justify-between items-start gap-2">
                       <a 
                         href={youtrackUrl ? `${youtrackUrl}/issue/${action.issueId}` : '#'} 
                         target="_blank" 
                         rel="noreferrer"
                         className="font-bold text-[14px] text-blue-500 hover:text-blue-600 hover:underline"
                       >
                         [{action.issueId}]
                       </a>
                       {action.timeLoggedMinutes > 0 && (
                         <span className="text-[11px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded flex items-center gap-1 shrink-0">
                           <Timer className="w-3 h-3"/> {Number(action.timeLoggedMinutes / 60).toFixed(1).replace(/\.0$/, '')} год
                         </span>
                       )}
                     </div>

                     <div className="text-[13px] text-gray-800 font-medium leading-snug">
                       {action.summary}
                     </div>

                     {/* Comments */}
                     {action.comments && action.comments.length > 0 && (
                       <div className="mt-1 flex flex-col gap-2">
                         {action.comments.map((c, i) => (
                           <div key={i} className="text-[12px] text-gray-600 bg-blue-50/50 p-3 rounded-md border border-blue-100/50 flex items-start gap-2.5">
                             <MessageSquare className="w-3.5 h-3.5 mt-0.5 shrink-0 text-blue-400" />
                             <span className="leading-relaxed break-words whitespace-pre-wrap">{c}</span>
                           </div>
                         ))}
                       </div>
                     )}
                     
                  </div>
               ))
             )}
          </div>
        </Surface>

      </div>
    </div>
  );
}
