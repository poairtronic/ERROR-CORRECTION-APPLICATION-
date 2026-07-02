export function Card({ children, className = '', title, action }) {
  return (
    <div className={`card ${className}`}>
      {(title || action) && (
        <div className="card-header flex justify-between items-center mb-4">
          {title && <h3 className="m-0 text-lg font-semibold">{title}</h3>}
          {action && <div>{action}</div>}
        </div>
      )}
      <div className="card-body">
        {children}
      </div>
    </div>
  );
}
