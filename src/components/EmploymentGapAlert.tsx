import React from 'react';
import {
  Calendar,
  Briefcase,
  GraduationCap,
  Heart,
  Sparkles,
  X,
  Loader2,
  Check,
  Clock,
  BookOpen,
  Pencil
} from 'lucide-react';
import {
  EmploymentGap,
  EmploymentGapResolutionState,
  EmploymentGapResolutionType,
  EmploymentGapSuggestion
} from '../types';

interface EmploymentGapAlertProps {
  gap: EmploymentGap;
  resolution: EmploymentGapResolutionState;
  onResolve: (gapId: string, type: EmploymentGapResolutionType) => void;
  onDismiss: (gapId: string) => void;
  onAISuggest: (gapId: string) => void;
  onSelectSuggestion: (gapId: string, suggestion: EmploymentGapSuggestion) => void;
  onUndo: (gapId: string) => void;
}

const EmploymentGapAlert: React.FC<EmploymentGapAlertProps> = ({
  gap,
  resolution,
  onResolve,
  onDismiss,
  onAISuggest,
  onSelectSuggestion,
  onUndo
}) => {
  // Format duration as human-readable
  const formatDuration = (months: number): string => {
    if (months < 12) {
      return `${months} month${months > 1 ? 's' : ''}`;
    }
    const years = Math.floor(months / 12);
    const remainingMonths = months % 12;
    if (remainingMonths === 0) {
      return `${years} year${years > 1 ? 's' : ''}`;
    }
    return `${years} year${years > 1 ? 's' : ''}, ${remainingMonths} month${remainingMonths > 1 ? 's' : ''}`;
  };

  // If resolved, show success state
  if (resolution.status === 'resolved') {
    return (
      <div className="p-4 rounded-lg bg-success-light border border-success-border">
        <div className="flex items-center gap-2">
          <Check className="w-4 h-4 text-success" />
          <span className="text-sm font-medium text-success">
            Gap addressed ({formatDuration(gap.durationMonths)})
          </span>
          <span className="text-xs text-success capitalize">
            Added {resolution.resolutionType}
          </span>
          <button
            onClick={() => onUndo(gap.id)}
            className="ml-auto flex items-center gap-1 px-2 py-1 text-xs text-success hover:text-success hover:bg-success/10 rounded transition-colors"
          >
            <Pencil className="w-3 h-3" />
            Edit
          </button>
        </div>
      </div>
    );
  }

  // If dismissed, show muted state
  if (resolution.status === 'dismissed') {
    return (
      <div className="p-4 rounded-lg bg-border-light border border-border opacity-60 hover:opacity-100 transition-opacity">
        <div className="flex items-center gap-2">
          <X className="w-4 h-4 text-text-muted" />
          <span className="text-sm font-medium text-text-muted">
            Gap skipped ({formatDuration(gap.durationMonths)})
          </span>
          <button
            onClick={() => onUndo(gap.id)}
            className="ml-auto flex items-center gap-1 px-2 py-1 text-xs text-text-muted hover:text-text-secondary hover:bg-border rounded transition-colors"
          >
            <X className="w-3 h-3" />
            Undo
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-warning-border bg-warning-light overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-warning-border bg-warning-light/50">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-warning/10 rounded-lg">
            <Calendar className="w-5 h-5 text-warning" />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-text-primary">
              {formatDuration(gap.durationMonths)} Gap Detected
            </h3>
            <p className="text-xs text-text-muted mt-0.5">
              {gap.previousJob.endDate} — {gap.nextJob.startDate}
            </p>
          </div>
          {gap.isOldGap && (
            <span className="px-2 py-0.5 text-[10px] bg-border-light border border-border rounded-full text-text-muted">
              10+ years ago
            </span>
          )}
        </div>

        {/* Job context */}
        <div className="mt-3 text-xs text-text-secondary space-y-1">
          <p>
            <span className="text-text-muted">After:</span> {gap.previousJob.role} at {gap.previousJob.company}
          </p>
          <p>
            <span className="text-text-muted">Before:</span> {gap.nextJob.role} at {gap.nextJob.company}
          </p>
        </div>

        {/* Education coverage indicator */}
        {gap.isCoveredByEducation && gap.educationCoverage && (
          <div className="mt-3 flex items-center gap-2 px-3 py-2 bg-success-light border border-success-border rounded-lg">
            <GraduationCap className="w-4 h-4 text-success" />
            <span className="text-xs text-success">
              Covered by education: {gap.educationCoverage.degree} at {gap.educationCoverage.school}
            </span>
          </div>
        )}

        {/* Friendly message */}
        {!gap.isCoveredByEducation && (
          <p className="mt-3 text-xs text-text-muted italic">
            {gap.isOldGap
              ? "This gap is from a while ago — employers rarely ask about older history, but you can still address it if you'd like."
              : "Employment gaps are common and nothing to worry about. Let's add context to strengthen your application."}
          </p>
        )}
      </div>

      {/* Loading state */}
      {resolution.status === 'suggesting' && (
        <div className="p-6 flex flex-col items-center justify-center">
          <Loader2 className="w-6 h-6 text-accent animate-spin mb-2" />
          <p className="text-sm text-text-muted">Generating suggestions based on your background...</p>
        </div>
      )}

      {/* AI Suggestions */}
      {resolution.status === 'pending' && resolution.aiSuggestions && resolution.aiSuggestions.length > 0 && (
        <div className="p-4 border-b border-warning-border">
          <p className="text-xs font-medium text-text-secondary mb-3">AI Suggestions based on your experience:</p>
          <div className="space-y-2">
            {resolution.aiSuggestions.map((suggestion, i) => (
              <button
                key={i}
                onClick={() => onSelectSuggestion(gap.id, suggestion as EmploymentGapSuggestion)}
                className="w-full text-left p-3 rounded-lg border border-border bg-surface hover:border-accent-muted hover:bg-accent-light transition-all group"
              >
                <div className="flex items-center gap-2 mb-1">
                  {suggestion.type === 'project' && <Briefcase className="w-3.5 h-3.5 text-accent" />}
                  {suggestion.type === 'freelance' && <Briefcase className="w-3.5 h-3.5 text-accent" />}
                  {suggestion.type === 'education' && <BookOpen className="w-3.5 h-3.5 text-accent" />}
                  {suggestion.type === 'volunteer' && <Heart className="w-3.5 h-3.5 text-accent" />}
                  <span className="text-sm font-medium text-text-primary group-hover:text-accent">
                    {suggestion.title}
                  </span>
                  <span className="text-[10px] px-1.5 py-0.5 bg-border-light border border-border rounded text-text-muted capitalize ml-auto">
                    {suggestion.type}
                  </span>
                </div>
                <p className="text-xs text-text-muted line-clamp-2">{suggestion.description}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Resolution Options (only show if not suggesting and no suggestions yet) */}
      {resolution.status === 'pending' && (!resolution.aiSuggestions || resolution.aiSuggestions.length === 0) && (
        <div className="p-4">
          <p className="text-xs font-medium text-text-secondary mb-3">
            {gap.isCoveredByEducation
              ? "Already covered, but you can add more context:"
              : "How would you like to address this gap?"}
          </p>

          {/* Resolution buttons */}
          <div className="grid grid-cols-2 gap-2 mb-3">
            <button
              onClick={() => onResolve(gap.id, 'project')}
              className="flex items-center gap-2 px-3 py-2.5 rounded-lg border border-border bg-surface hover:border-accent-muted hover:bg-accent-light transition-all text-left"
            >
              <Briefcase className="w-4 h-4 text-accent" />
              <div>
                <p className="text-xs font-medium text-text-primary">Project</p>
                <p className="text-[10px] text-text-muted">Personal or side project</p>
              </div>
            </button>

            <button
              onClick={() => onResolve(gap.id, 'freelance')}
              className="flex items-center gap-2 px-3 py-2.5 rounded-lg border border-border bg-surface hover:border-accent-muted hover:bg-accent-light transition-all text-left"
            >
              <Briefcase className="w-4 h-4 text-accent" />
              <div>
                <p className="text-xs font-medium text-text-primary">Freelance</p>
                <p className="text-[10px] text-text-muted">Contract or consulting</p>
              </div>
            </button>

            <button
              onClick={() => onResolve(gap.id, 'education')}
              className="flex items-center gap-2 px-3 py-2.5 rounded-lg border border-border bg-surface hover:border-accent-muted hover:bg-accent-light transition-all text-left"
            >
              <BookOpen className="w-4 h-4 text-accent" />
              <div>
                <p className="text-xs font-medium text-text-primary">Education</p>
                <p className="text-[10px] text-text-muted">Course or certification</p>
              </div>
            </button>

            <button
              onClick={() => onResolve(gap.id, 'volunteer')}
              className="flex items-center gap-2 px-3 py-2.5 rounded-lg border border-border bg-surface hover:border-accent-muted hover:bg-accent-light transition-all text-left"
            >
              <Heart className="w-4 h-4 text-accent" />
              <div>
                <p className="text-xs font-medium text-text-primary">Volunteer</p>
                <p className="text-[10px] text-text-muted">Non-profit or community</p>
              </div>
            </button>
          </div>

          {/* AI Suggest and Dismiss buttons */}
          <div className="flex gap-2">
            <button
              onClick={() => onAISuggest(gap.id)}
              className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-accent hover:bg-accent-hover text-white rounded-lg text-xs font-medium transition-colors"
            >
              <Sparkles className="w-3.5 h-3.5" />
              AI Suggest Ideas
            </button>
            <button
              onClick={() => onDismiss(gap.id)}
              className="px-3 py-2 text-text-muted hover:text-text-secondary hover:bg-border-light rounded-lg text-xs transition-colors"
            >
              Leave as is
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default EmploymentGapAlert;
