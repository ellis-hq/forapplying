import React, { useState } from 'react';
import {
  Upload,
  Briefcase,
  Building2,
  Settings2,
  ChevronRight,
  Loader2,
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Info,
  FileText
} from 'lucide-react';
import { RewriteMode, ResumeStyle, RESUME_STYLES } from '../types';

interface InputViewProps {
  file: File | null;
  jobDesc: string;
  company: string;
  mode: RewriteMode;
  resumeStyle: ResumeStyle;
  isProcessing: boolean;
  error: string | null;
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  setJobDesc: (value: string) => void;
  setCompany: (value: string) => void;
  setMode: (mode: RewriteMode) => void;
  setResumeStyle: (style: ResumeStyle) => void;
  handleGenerate: () => void;
}

const StepLabel: React.FC<{ step: number; title: string }> = ({ step, title }) => (
  <div className="flex items-center gap-2 mb-3">
    <span className="flex items-center justify-center w-6 h-6 rounded-full bg-accent text-white text-xs font-bold">
      {step}
    </span>
    <span className="text-sm font-semibold text-text-secondary">{title}</span>
  </div>
);

const InputView: React.FC<InputViewProps> = ({
  file,
  jobDesc,
  company,
  mode,
  resumeStyle,
  isProcessing,
  error,
  onFileChange,
  setJobDesc,
  setCompany,
  setMode,
  setResumeStyle,
  handleGenerate,
}) => {
  const [aboutExpanded, setAboutExpanded] = useState(false);

  return (
    <main className="max-w-4xl w-full animate-fade-in">
      {/* About Section */}
      <div className="bg-accent-light border border-accent-muted/30 rounded-xl mb-6">
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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Left Column - Steps 1 & 2 */}
        <div className="bg-surface p-6 rounded-2xl shadow-sm border border-border space-y-6">
          {/* Step 1: Resume Upload */}
          <div>
            <StepLabel step={1} title="Upload Your Resume" />
            <div className={`relative border-2 border-dashed rounded-xl p-6 transition-all ${file ? 'border-accent-muted bg-accent-light' : 'border-border hover:border-accent-muted'}`}>
              <input
                type="file"
                accept="application/pdf"
                onChange={onFileChange}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              <div className="flex flex-col items-center justify-center text-center">
                {file ? (
                  <>
                    <CheckCircle2 className="w-8 h-8 text-accent mb-2" />
                    <p className="text-text-primary font-medium text-sm truncate w-full">{file.name}</p>
                    <p className="text-accent text-xs mt-1">Click or drag to replace</p>
                  </>
                ) : (
                  <>
                    <Upload className="w-8 h-8 text-text-muted mb-2" />
                    <p className="text-text-secondary font-medium text-sm">Click to upload your PDF</p>
                    <p className="text-text-muted text-xs mt-1">Standard ATS layout preferred</p>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Step 2: Company Name */}
          <div>
            <StepLabel step={2} title="Target Company" />
            <div className="relative">
              <Building2 className="w-4 h-4 text-text-muted absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                placeholder="e.g. Google, Stripe, Local Startup"
                className="w-full pl-10 pr-4 py-2 rounded-lg border border-border focus:ring-2 focus:ring-accent focus:border-accent outline-none transition-all"
              />
            </div>
          </div>

          {/* Optimization Mode (no step number, it's a sub-setting) */}
          <div className="space-y-2">
            <label className="text-sm font-semibold text-text-secondary flex items-center gap-2">
              <Settings2 className="w-4 h-4" /> Optimization Mode
            </label>
            <div className="flex p-1 bg-border-light rounded-lg">
              <button
                onClick={() => setMode(RewriteMode.CONSERVATIVE)}
                className={`flex-1 py-1.5 px-3 rounded-md text-sm font-medium transition-all ${mode === RewriteMode.CONSERVATIVE ? 'bg-surface shadow-sm text-accent' : 'text-text-muted hover:text-text-secondary'}`}
              >
                Conservative
              </button>
              <button
                onClick={() => setMode(RewriteMode.AGGRESSIVE)}
                className={`flex-1 py-1.5 px-3 rounded-md text-sm font-medium transition-all ${mode === RewriteMode.AGGRESSIVE ? 'bg-surface shadow-sm text-accent' : 'text-text-muted hover:text-text-secondary'}`}
              >
                Aggressive
              </button>
            </div>
            <p className="text-[10px] text-text-muted leading-tight">
              {mode === RewriteMode.CONSERVATIVE
                ? "Maintains your phrasing, injects keywords into skills/summary."
                : "Matches JD vocabulary exactly in your experience bullets while keeping facts true."}
            </p>
          </div>
        </div>

        {/* Right Column - Step 3 */}
        <div className="bg-surface p-6 rounded-2xl shadow-sm border border-border flex flex-col">
          <div className="flex-1 flex flex-col">
            <StepLabel step={3} title="Paste Job Description" />
            <textarea
              value={jobDesc}
              onChange={(e) => setJobDesc(e.target.value)}
              placeholder="Paste the full job requirements. We will extract and map all relevant keywords..."
              className="flex-1 w-full px-4 py-3 rounded-xl border border-border focus:ring-2 focus:ring-accent outline-none resize-none transition-all text-sm leading-relaxed min-h-[200px]"
            />
          </div>
        </div>
      </div>

      {/* Step 4: Resume Style Selection */}
      <div className="bg-surface p-6 rounded-2xl shadow-sm border border-border mt-8">
        <StepLabel step={4} title="Choose Resume Style" />
        <p className="text-xs text-text-muted mb-4">Select a template that best fits your background. This affects section ordering in the final PDF.</p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {RESUME_STYLES.map((style) => (
            <button
              key={style.id}
              onClick={() => setResumeStyle(style.id)}
              className={`p-4 rounded-xl border-2 text-left transition-all ${
                resumeStyle === style.id
                  ? 'border-accent bg-accent-light ring-2 ring-accent-muted'
                  : 'border-border hover:border-accent-muted hover:bg-border-light'
              }`}
            >
              <div className="flex items-start gap-2 mb-2">
                <FileText className={`w-5 h-5 mt-0.5 ${resumeStyle === style.id ? 'text-accent' : 'text-text-muted'}`} />
                <div>
                  <h3 className={`text-sm font-semibold ${resumeStyle === style.id ? 'text-text-primary' : 'text-text-primary'}`}>
                    {style.name}
                  </h3>
                  <p className="text-xs text-text-muted mt-0.5">Best for: {style.bestFor}</p>
                </div>
              </div>
              <p className={`text-xs leading-relaxed ${resumeStyle === style.id ? 'text-accent-hover' : 'text-text-muted'}`}>
                {style.description}
              </p>
              {resumeStyle === style.id && (
                <div className="mt-2 flex items-center gap-1">
                  <CheckCircle2 className="w-4 h-4 text-accent" />
                  <span className="text-xs font-medium text-accent">Selected</span>
                </div>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="mt-6 p-3 bg-error-light border border-error-border text-error text-sm rounded-lg flex items-start gap-2">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <p>{error}</p>
        </div>
      )}

      {/* Generate Button */}
      <button
        onClick={handleGenerate}
        disabled={isProcessing}
        className={`w-full mt-6 py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all ${isProcessing ? 'bg-accent-light text-accent cursor-not-allowed' : 'bg-accent text-white hover:bg-accent-hover shadow-lg shadow-accent-muted/30'}`}
      >
        {isProcessing ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            Semantic Mapping in Progress...
          </>
        ) : (
          <>
            Generate Optimized Package
            <ChevronRight className="w-5 h-5" />
          </>
        )}
      </button>
    </main>
  );
};

export default InputView;
