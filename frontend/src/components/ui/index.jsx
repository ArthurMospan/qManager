import React from 'react';

const VARIANTS = {
  panel: 'bg-canvas rounded-[16px]',
  card:  'bg-white rounded-[16px]',
  inset: 'bg-[#f0f0f0] rounded-[16px]',
};

const PADDING = {
  none: '',
  xs:   'p-[8px]',
  sm:   'p-[12px]',
  md:   'p-[16px]',
  lg:   'p-[20px]',
  xl:   'p-[24px]',
  xxl:  'p-[32px]',
};

export function Surface({ variant = 'panel', padding = 'md', className = '', style, children }) {
  return (
    <div className={`${VARIANTS[variant] ?? VARIANTS.panel} ${PADDING[padding] ?? PADDING.md} ${className}`} style={style}>
      {children}
    </div>
  );
}

export function Button({ children, style = 'primary', size = 'md', icon: Icon, loading, disabled, onClick, className = '' }) {
  const baseStyles = 'inline-flex items-center justify-center font-medium rounded-[10px] transition-colors focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed';
  
  const styles = {
    primary: 'bg-[#1f1f1f] hover:bg-[#303030] text-white',
    secondary: 'bg-[#f4f4f5] hover:bg-[#e9e9e9] text-[#1f1f1f]',
    danger: 'bg-red-500 hover:bg-red-600 text-white'
  };
  
  const sizes = {
    sm: 'h-[28px] px-3 text-[12px]',
    md: 'h-[32px] px-4 text-[13px]',
    lg: 'h-[36px] px-5 text-[14px]'
  };

  return (
    <button 
      onClick={onClick} 
      disabled={disabled || loading} 
      className={`${baseStyles} ${styles[style]} ${sizes[size]} ${className}`}
    >
      {loading ? (
        <LoadingSpinner size="sm" className="mr-2" />
      ) : Icon ? (
        <Icon className="w-4 h-4 mr-2" />
      ) : null}
      {children}
    </button>
  );
}

export function Progress({ value = 0, color = 'primary', size = 'md' }) {
  const height = size === 'sm' ? 'h-1.5' : size === 'md' ? 'h-2' : 'h-3';
  const bgColor = color === 'red' ? 'bg-red-500' : 'bg-[#1f1f1f]';

  return (
    <div className={`w-full bg-[#e5e7eb] rounded-full overflow-hidden ${height}`}>
      <div 
        className={`${bgColor} h-full transition-all duration-500`} 
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }} 
      />
    </div>
  );
}

export function Alert({ style = 'info', icon: Icon, children }) {
  const styles = {
    info: 'bg-blue-50 text-blue-900 border-blue-200',
    danger: 'bg-red-50 text-red-900 border-red-200',
    warning: 'bg-yellow-50 text-yellow-900 border-yellow-200'
  };

  return (
    <div className={`flex items-start gap-3 p-3 rounded-[12px] border ${styles[style]}`}>
      {Icon && <Icon className="w-5 h-5 shrink-0 mt-0.5" />}
      <div className="flex-1">{children}</div>
    </div>
  );
}

export function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center p-12 text-center bg-white rounded-[16px] border border-[#f0f0f0]">
      {Icon && <Icon className="w-12 h-12 text-gray-300 mb-4" />}
      <h3 className="text-[16px] font-bold text-[#1f1f1f] mb-2">{title}</h3>
      <p className="text-[13px] text-[#6b7280] mb-6 max-w-sm">{description}</p>
      {action}
    </div>
  );
}

export function LoadingSpinner({ size = 'md', className = '' }) {
  const sizes = { sm: 'w-4 h-4', md: 'w-6 h-6', lg: 'w-10 h-10' };
  return (
    <div className={`animate-spin rounded-full border-2 border-gray-200 border-t-[#1f1f1f] ${sizes[size]} ${className}`} />
  );
}
