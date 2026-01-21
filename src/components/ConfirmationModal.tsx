import React from 'react';
import { AlertTriangle, X } from 'lucide-react';

interface ConfirmationModalProps {
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  title?: string;
  message?: string;
}

const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  isOpen,
  onConfirm,
  onCancel,
  title = 'Confirm Download',
  message = 'Are you sure you want to download? This will cost you 1 download.',
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onCancel}
      />

      {/* Modal */}
      <div className="relative bg-surface rounded-2xl shadow-xl border border-border p-6 max-w-md w-full mx-4 animate-fade-in">
        {/* Close button */}
        <button
          onClick={onCancel}
          className="absolute top-4 right-4 text-text-muted hover:text-text-primary transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Icon and content */}
        <div className="flex flex-col items-center text-center">
          <div className="w-12 h-12 rounded-full bg-warning-light flex items-center justify-center mb-4">
            <AlertTriangle className="w-6 h-6 text-warning" />
          </div>

          <h2 className="text-lg font-bold text-text-primary mb-2">{title}</h2>
          <p className="text-text-secondary text-sm mb-6">{message}</p>

          {/* Buttons */}
          <div className="flex gap-3 w-full">
            <button
              onClick={onCancel}
              className="flex-1 px-4 py-2.5 border border-border hover:bg-border-light text-text-secondary rounded-lg text-sm font-bold transition-all"
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              className="flex-1 px-4 py-2.5 bg-accent hover:bg-accent-hover text-white rounded-lg text-sm font-bold shadow-sm transition-all"
            >
              Yes, proceed
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConfirmationModal;
