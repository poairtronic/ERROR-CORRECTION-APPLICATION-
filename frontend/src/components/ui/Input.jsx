import { forwardRef } from 'react';

export const Input = forwardRef(({ 
  label, 
  error, 
  className = '', 
  fullWidth = false,
  ...props 
}, ref) => {
  return (
    <div className={`form-group ${fullWidth ? 'full' : ''} ${className}`.trim()}>
      {label && <label>{label}</label>}
      <input ref={ref} className={error ? 'input-error' : ''} {...props} />
      {error && <span className="error-text text-sm text-red-500 mt-1">{error}</span>}
    </div>
  );
});

Input.displayName = 'Input';

export const Select = forwardRef(({ 
  label, 
  error, 
  options = [], 
  className = '', 
  fullWidth = false,
  placeholder = 'Select...',
  ...props 
}, ref) => {
  return (
    <div className={`form-group ${fullWidth ? 'full' : ''} ${className}`.trim()}>
      {label && <label>{label}</label>}
      <select ref={ref} className={error ? 'input-error' : ''} {...props}>
        {placeholder && <option value="" disabled>{placeholder}</option>}
        {options.map(opt => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
      {error && <span className="error-text text-sm text-red-500 mt-1">{error}</span>}
    </div>
  );
});

Select.displayName = 'Select';
