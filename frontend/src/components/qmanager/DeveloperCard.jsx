import React from 'react';
import { Surface, Progress, Alert } from '@/components/ui';
import { User, CheckCircle2, Clock, AlertTriangle, Moon } from 'lucide-react';

export default function DeveloperCard({ developer, analysis, timeframe }) {
  const { 
    summary_done = [], 
    in_progress = [], 
    time_tracked_hours = 0, 
    prev_time_tracked_hours = 0,
    blockers = null, 
    daily_hours = [],
    stuck_tasks = [],
    tasks_done = 0,
    tasks_in_progress = 0
  } = analysis || {};

  const displayHours = Number(time_tracked_hours).toFixed(1).replace(/\.0$/, '');
  const hasZeroTime = time_tracked_hours === 0;
  
  const isInactive = summary_done.length === 0 && in_progress.length === 0 && hasZeroTime && !blockers && stuck_tasks.length === 0;

  const hoursDiff = time_tracked_hours - prev_time_tracked_hours;
  const isTrendUp = hoursDiff >= 0;

  const daysAbbr = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд'];
  
  // Find max daily hours to scale the mini-chart
  const maxDaily = Math.max(...daily_hours, 8); // At least scale to 8h

  return (
    <Surface className={`flex flex-col h-full bg-white rounded-xl shadow-lg border-0 overflow-hidden transition-all duration-300 ${isInactive ? 'opacity-50 grayscale-[0.5]' : 'hover:scale-[1.02] hover:shadow-xl'}`}>
      
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
      {!isInactive && (
        <div className="flex items-center px-6 py-3 bg-gray-50 border-b border-gray-100 gap-4 text-[12px] font-medium text-gray-600">
          <div className="flex items-center gap-1.5 flex-1 justify-center">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
            Виконано: <span className="font-bold text-gray-900">{tasks_done}</span>
          </div>
          <div className="w-px h-4 bg-gray-200" />
          <div className="flex items-center gap-1.5 flex-1 justify-center">
            <Clock className="w-3.5 h-3.5 text-blue-500" />
            В роботі: <span className="font-bold text-gray-900">{tasks_in_progress}</span>
          </div>
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
                  {summary_done.map((task, idx) => <li key={idx}>{task}</li>)}
                </ul>
              </div>
            )}

            {in_progress.length > 0 && (
              <div className="flex flex-col gap-2.5">
                <h4 className="text-[11px] font-bold text-blue-600 uppercase tracking-widest flex items-center gap-1.5">
                  <Clock className="w-4 h-4" /> В роботі
                </h4>
                <ul className="list-disc pl-5 text-[14px] text-gray-700 space-y-2 leading-relaxed">
                  {in_progress.map((task, idx) => <li key={idx}>{task}</li>)}
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
                    {stuck_tasks.map((task, idx) => <li key={idx}>{task}</li>)}
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
  );
}
