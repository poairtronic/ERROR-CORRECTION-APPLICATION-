export function Badge({ children, variant = 'default', className = '' }) {
  const badgeClass = variant !== 'default' ? `badge-${variant}` : 'badge-default';
  
  return (
    <span className={`badge ${badgeClass} ${className}`.trim()}>
      {children}
    </span>
  );
}
