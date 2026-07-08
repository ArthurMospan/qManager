import React from 'react';
import { Surface, Progress, Alert } from '@/components/ui';
import { User, CheckCircle2, Clock, AlertTriangle, Moon } from 'lucide-react';

export default function DeveloperCard({ developer, analysis, timeframe }) {
  const { summary_done = [], in_progress = [], time_tracked_hours = 0, blockers = null, daily_hours = [] } = analysis || {};

  const displayHours = Number(time_tracked_hours).toFixed(1).replace(/\.0$/, '');
  const hasZeroTime = time_tracked_hours === 0;
  
  const isInactive = summary_done.length === 0 && in_progress.length === 0 && hasZeroTime && !blockers;

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
            <div className={`text-[15px] font-bold ${hasZeroTime ? 'text-red-500' : 'text-gray-900'}`}>
              {displayHours} <span className="text-[12px] text-gray-500 font-medium">год</span>
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

          {/* Blockers */}
          {blockers && (
            <div className="mt-2">
              <Alert style="danger" icon={AlertTriangle}>
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
