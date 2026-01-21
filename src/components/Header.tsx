import React from 'react';
import { FileText, RefreshCw, Info } from 'lucide-react';

interface HeaderProps {
  showReset: boolean;
  onReset: () => void;
  onAbout: () => void;
}

const Header: React.FC<HeaderProps> = ({ showReset, onReset, onAbout }) => (
  <header className="max-w-4xl w-full mb-8 flex items-center justify-between">
    <div className="flex items-center gap-3">
      <div className="p-2 bg-accent rounded-lg shadow-lg shadow-accent-muted/30">
        <FileText className="text-white w-8 h-8" />
      </div>
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Forapplying</h1>
        <p className="text-text-muted text-sm">Professional keyword-mapping engine</p>
      </div>
    </div>
    <div className="flex items-center gap-4">
      <button
        onClick={onAbout}
        className="flex items-center gap-1.5 text-text-muted hover:text-accent transition-colors font-medium text-sm"
      >
        <Info className="w-4 h-4" /> About
      </button>
      {showReset && (
        <button
          onClick={onReset}
          className="flex items-center gap-2 text-text-muted hover:text-accent transition-colors font-medium text-sm"
        >
          <RefreshCw className="w-4 h-4" /> Start Over
        </button>
      )}
    </div>
  </header>
);

export default Header;
