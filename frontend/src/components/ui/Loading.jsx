export function LoadingSpinner({ size = 'md', className = '' }) {
  const sizeClass = size === 'sm' ? 'w-4 h-4 border-2' : size === 'lg' ? 'w-12 h-12 border-4' : 'w-8 h-8 border-3';
  return (
    <div className={`spinner ${sizeClass} ${className}`.trim()} />
  );
}

export function LoadingScreen({ message = 'Loading...' }) {
  return (
    <div className="flex flex-col items-center justify-center h-[50vh]">
      <LoadingSpinner size="lg" className="mb-4 text-blue-600" />
      <p className="text-slate-500 font-medium">{message}</p>
    </div>
  );
}

export function Skeleton({ className = '' }) {
  return <div className={`skeleton rounded ${className}`.trim()} />;
}
