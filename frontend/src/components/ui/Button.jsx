import { forwardRef } from 'react';

export const Button = forwardRef(({ 
  children, 
  variant = 'primary', 
  size = 'md', 
  className = '', 
  loading = false,
  disabled,
  ...props 
}, ref) => {
  const baseClass = 'btn';
  const variantClass = variant !== 'primary' ? `btn-${variant}` : 'btn-primary';
  const sizeClass = size === 'sm' ? 'btn-sm' : size === 'lg' ? 'btn-lg' : '';
  const loadingClass = loading ? 'loading' : '';

  return (
    <button 
      ref={ref}
      className={`${baseClass} ${variantClass} ${sizeClass} ${loadingClass} ${className}`.trim()} 
      disabled={disabled || loading}
      {...props}
    >
      {loading && <span className="spinner spinner-sm mr-2" />}
      {children}
    </button>
  );
});

Button.displayName = 'Button';
