import React, { useState } from 'react';
import {
  Download,
  XCircle,
  Target,
  FileBadge,
  FileText,
  Loader2
} from 'lucide-react';
import { TailorResponse } from '../types';

interface ResultViewProps {
  result: TailorResponse;
  matchScore: number;
  downloadResume: () => Promise<void>;
  downloadCoverLetter: () => Promise<void>;
  company: string;
}

const ScoreCircle: React.FC<{ score: number }> = ({ score }) => (
  <div className="relative w-24 h-24 flex items-center justify-center mb-3">
    <svg className="w-full h-full transform -rotate-90">
      <circle cx="48" cy="48" r="40" stroke="currentColor" strokeWidth="8" fill="transparent" className="text-border-light" />
      <circle cx="48" cy="48" r="40" stroke="currentColor" strokeWidth="8" fill="transparent" strokeDasharray={251} strokeDashoffset={251 - (251 * score) / 100} className="text-accent" />
    </svg>
    <span className="absolute text-xl font-bold text-text-primary">{score}%</span>
  </div>
);

const ResultView: React.FC<ResultViewProps> = ({
  result,
  matchScore,
  downloadResume,
  downloadCoverLetter,
}) => {
  const [isDownloadingResume, setIsDownloadingResume] = useState(false);
  const [isDownloadingCoverLetter, setIsDownloadingCoverLetter] = useState(false);

  const handleDownloadResume = async () => {
    setIsDownloadingResume(true);
    try {
      await downloadResume();
    } finally {
      setIsDownloadingResume(false);
    }
  };

  const handleDownloadCoverLetter = async () => {
    setIsDownloadingCoverLetter(true);
    try {
      await downloadCoverLetter();
    } finally {
      setIsDownloadingCoverLetter(false);
    }
  };

  return (
    <main className="max-w-6xl w-full grid grid-cols-1 lg:grid-cols-4 gap-8 animate-fade-in">
      {/* Keyword Coverage & Score */}
      <section className="lg:col-span-1 space-y-6">
        <div className="bg-surface p-6 rounded-2xl shadow-sm border border-border">
          <div className="flex flex-col items-center mb-6 text-center">
            <ScoreCircle score={matchScore} />
            <h2 className="text-sm font-bold text-text-primary">ATS Match Score</h2>
            <p className="text-xs text-text-muted mt-1">Based on keyword coverage</p>
          </div>

          <div className="space-y-6">
            <div>
              <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3 flex items-center gap-2">
                <Target className="w-3 h-3 text-accent" /> Injected Keywords
              </h3>
              <div className="space-y-2 max-h-64 overflow-y-auto custom-scrollbar">
                {result.report.keywords.map((kw, i) => (
                  <div key={i} className="flex flex-col p-2 rounded-lg bg-border-light border border-border">
                    <div className="flex justify-between items-center mb-1">
                      <p className="text-xs font-semibold text-text-secondary">{kw.term}</p>
                      <span className={`text-[9px] px-1.5 py-0.5 rounded ${kw.type === 'must-have' ? 'bg-accent-light text-accent-hover' : 'bg-border text-text-muted'}`}>
                        {kw.type === 'must-have' ? 'CORE' : 'NICE'}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {kw.foundIn.map((section, j) => (
                        <span key={j} className="text-[9px] text-success bg-success-light px-1 border border-success-border rounded">
                          {section}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {result.report.gaps.length > 0 && (
              <div>
                <h3 className="text-xs font-semibold text-error uppercase tracking-wider mb-3 flex items-center gap-2">
                  <XCircle className="w-3 h-3" /> Remaining Gaps
                </h3>
                <div className="flex flex-wrap gap-1.5">
                  {result.report.gaps.map((gap, i) => (
                    <span key={i} className="px-2 py-1 bg-error-light text-error rounded border border-error-border text-[10px] font-medium">
                      {gap}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Resume Preview */}
      <section className="lg:col-span-3 space-y-6">
        <div className="bg-surface rounded-2xl shadow-sm border border-border overflow-hidden">
          <div className="bg-border-light px-6 py-4 border-b border-border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex gap-4">
              <div className="flex items-center gap-2 text-accent font-bold text-sm">
                <FileBadge className="w-4 h-4" /> Optimized Output
              </div>
            </div>
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={handleDownloadResume}
                disabled={isDownloadingResume}
                className="flex items-center gap-2 px-4 py-2 bg-accent hover:bg-accent-hover disabled:bg-accent/70 text-white rounded-lg text-sm font-bold shadow-sm transition-all disabled:cursor-not-allowed"
              >
                {isDownloadingResume ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Download className="w-4 h-4" />
                )}
                {isDownloadingResume ? 'Downloading...' : 'Download Resume'}
              </button>
              <button
                onClick={handleDownloadCoverLetter}
                disabled={isDownloadingCoverLetter}
                className="flex items-center gap-2 px-4 py-2 border border-border hover:bg-border-light disabled:bg-border-light/50 text-text-secondary rounded-lg text-sm font-bold transition-all disabled:cursor-not-allowed"
              >
                {isDownloadingCoverLetter ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Download className="w-4 h-4" />
                )}
                {isDownloadingCoverLetter ? 'Downloading...' : 'Cover Letter (Optional)'}
              </button>
            </div>
          </div>

          <div className="p-8 bg-surface max-h-[85vh] overflow-y-auto custom-scrollbar flex flex-col items-center">
            {/* Visual Representation of the Tailored Resume */}
            <div className="w-full max-w-[700px] shadow-sm border border-border p-12 bg-surface text-text-primary text-[11px] leading-relaxed">
              <div className="text-center mb-8">
                <h1 className="text-2xl font-bold uppercase mb-1 tracking-tight">{result.resume.contact.name}</h1>
                <p className="text-text-muted">
                  {result.resume.contact.email} • {result.resume.contact.phone} • {result.resume.contact.location}
                </p>
              </div>

              <div className="mb-6">
                <h3 className="text-xs font-bold uppercase border-b border-text-primary pb-0.5 mb-2">Professional Summary</h3>
                <p>{result.resume.summary}</p>
              </div>

              <div className="mb-6">
                <h3 className="text-xs font-bold uppercase border-b border-text-primary pb-0.5 mb-2">Technical Skills</h3>
                <div className="space-y-1">
                  <p><span className="font-bold">Core Competencies:</span> {result.resume.skills.core.join(' • ')}</p>
                  <p><span className="font-bold">Technologies & Tools:</span> {result.resume.skills.tools.join(' • ')}</p>
                </div>
              </div>

              <div className="mb-6">
                <h3 className="text-xs font-bold uppercase border-b border-text-primary pb-0.5 mb-2">Experience</h3>
                <div className="space-y-6">
                  {result.resume.experience.map((exp, i) => (
                    <div key={i}>
                      <div className="flex justify-between items-baseline mb-0.5">
                        <h4 className="font-bold text-sm uppercase">{exp.company}</h4>
                        <span className="font-bold italic">{exp.dateRange}</span>
                      </div>
                      <div className="flex justify-between items-baseline mb-2 italic text-text-secondary">
                        <span>{exp.role}</span>
                        <span>{exp.location}</span>
                      </div>
                      <ul className="list-disc ml-4 space-y-1 text-text-secondary">
                        {exp.bullets.map((b, j) => (
                          <li key={j}>{b}</li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="text-xs font-bold uppercase border-b border-text-primary pb-0.5 mb-2">Education</h3>
                <div className="space-y-3">
                  {result.resume.education.map((edu, i) => (
                    <div key={i} className="flex justify-between items-start">
                      <div>
                        <p className="font-bold uppercase">{edu.school}</p>
                        <p>{edu.degree}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold italic">{edu.dateRange}</p>
                        <p className="italic text-text-muted">{edu.location}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="w-full max-w-[700px] mt-12 mb-8 bg-border-light p-10 border border-border rounded-lg">
              <div className="flex items-center gap-2 mb-6 text-accent">
                <FileText className="w-5 h-5" />
                <h3 className="font-bold uppercase text-xs tracking-widest">Tailored Cover Letter</h3>
              </div>
              <div className="whitespace-pre-wrap font-serif text-text-secondary leading-relaxed text-sm">
                {result.coverLetter}
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
};

export default ResultView;
