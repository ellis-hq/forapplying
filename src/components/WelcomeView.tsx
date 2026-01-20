import React, { useState } from 'react';
import {
  Upload,
  PenTool,
  FileText,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Info,
  Sparkles
} from 'lucide-react';
import { ResumeEntryMode } from '../types';

interface WelcomeViewProps {
  onSelectMode: (mode: ResumeEntryMode) => void;
}

const WelcomeView: React.FC<WelcomeViewProps> = ({ onSelectMode }) => {
  const [aboutExpanded, setAboutExpanded] = useState(false);

  return (
    <main className="max-w-3xl w-full animate-fade-in">
      {/* Welcome Header */}
      <div className="text-center mb-8">
        <h1 className="text-2xl md:text-3xl font-bold text-text-primary mb-3">
          Welcome to Forapplying
        </h1>
        <p className="text-text-secondary text-sm md:text-base max-w-lg mx-auto">
          Get your resume past ATS filters and in front of recruiters. Choose how you'd like to start:
        </p>
      </div>

      {/* About Section */}
      <div className="bg-accent-light border border-accent-muted/30 rounded-xl mb-8">
        <button
          onClick={() => setAboutExpanded(!aboutExpanded)}
          className="w-full px-4 py-3 flex items-center justify-between text-left"
        >
          <div className="flex items-center gap-2">
            <Info className="w-4 h-4 text-accent" />
            <span className="text-sm font-medium text-text-primary">What is Forapplying?</span>
          </div>
          {aboutExpanded ? (
            <ChevronUp className="w-4 h-4 text-accent" />
          ) : (
            <ChevronDown className="w-4 h-4 text-accent" />
          )}
        </button>
        {aboutExpanded && (
          <div className="px-4 pb-4 text-sm text-text-secondary leading-relaxed">
            <p>
              Most companies use <strong>Applicant Tracking Systems (ATS)</strong> to automatically scan resumes for keywords before a human ever sees them.
              Forapplying analyzes job descriptions to identify these keywords, then optimizes your resume to match—helping you get past the ATS and in front of a recruiter.
            </p>
          </div>
        )}
      </div>

      {/* Two Entry Point Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Option 1: I have a resume */}
        <button
          onClick={() => onSelectMode(ResumeEntryMode.UPLOAD)}
          className="group bg-surface p-8 rounded-2xl shadow-sm border-2 border-border hover:border-accent hover:shadow-md transition-all text-left"
        >
          <div className="flex items-start gap-4 mb-4">
            <div className="p-3 rounded-xl bg-accent-light group-hover:bg-accent/10 transition-colors">
              <Upload className="w-8 h-8 text-accent" />
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-bold text-text-primary mb-1 group-hover:text-accent transition-colors">
                I have a resume
              </h2>
              <p className="text-sm text-text-muted">
                Upload your existing PDF resume
              </p>
            </div>
          </div>

          <ul className="space-y-2 mb-6 text-sm text-text-secondary">
            <li className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-accent" />
              Upload your current resume PDF
            </li>
            <li className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-accent" />
              AI optimizes it for your target job
            </li>
          </ul>

          <div className="flex items-center justify-between text-accent font-semibold text-sm">
            <span>Upload & Optimize</span>
            <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </div>
        </button>

        {/* Option 2: Build/Update Resume */}
        <button
          onClick={() => onSelectMode(ResumeEntryMode.BUILD)}
          className="group bg-surface p-8 rounded-2xl shadow-sm border-2 border-border hover:border-accent hover:shadow-md transition-all text-left"
        >
          <div className="flex items-start gap-4 mb-4">
            <div className="p-3 rounded-xl bg-accent-light group-hover:bg-accent/10 transition-colors">
              <PenTool className="w-8 h-8 text-accent" />
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-bold text-text-primary mb-1 group-hover:text-accent transition-colors">
                Build or update my resume
              </h2>
              <p className="text-sm text-text-muted">
                Create from scratch or make changes
              </p>
            </div>
          </div>

          <ul className="space-y-2 mb-6 text-sm text-text-secondary">
            <li className="flex items-center gap-2">
              <PenTool className="w-4 h-4 text-accent" />
              Use our guided resume builder
            </li>
            <li className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-accent" />
              Then optimize for any job
            </li>
          </ul>

          <div className="flex items-center justify-between text-accent font-semibold text-sm">
            <span>Start Building</span>
            <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </div>
        </button>
      </div>

      {/* Hint text */}
      <p className="text-center text-xs text-text-muted mt-6">
        Don't worry—you can always edit your resume after uploading, or upload one later after building.
      </p>
    </main>
  );
};

export default WelcomeView;
