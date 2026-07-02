import { useEffect } from 'react';
import { FiX } from 'react-icons/fi';

export function Dialog({ isOpen, onClose, title, children, footer, maxWidth = '500px' }) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => { document.body.style.overflow = 'unset'; };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="modal-overlay fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm" onClick={onClose}>
      <div 
        className="modal bg-white rounded-xl shadow-2xl flex flex-col max-h-[90vh] animate-in fade-in zoom-in duration-200"
        style={{ width: '100%', maxWidth }}
        onClick={e => e.stopPropagation()}
      >
        <div className="modal-header p-5 border-b flex justify-between items-center">
          <h2 className="text-xl font-bold text-slate-800 m-0">{title}</h2>
          <button className="btn btn-ghost btn-sm p-2 rounded-full hover:bg-slate-100" onClick={onClose}>
            <FiX size={20} />
          </button>
        </div>
        
        <div className="modal-body p-6 overflow-y-auto">
          {children}
        </div>

        {footer && (
          <div className="modal-footer p-5 border-t bg-slate-50 rounded-b-xl flex justify-end gap-3">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
