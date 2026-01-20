import React, { useState } from 'react';
import {
  Sparkles,
  PenLine,
  SkipForward,
  ChevronRight,
  Loader2,
  Check,
  X,
  Pencil,
  AlertCircle,
  Lightbulb
} from 'lucide-react';
import { TailorResponse, GapState, GapTargetSection, EditableResumeData, ResumeStyle } from '../types';

interface ReviewEditViewProps {
  result: TailorResponse;
  jobDescription: string;
  resumeStyle: ResumeStyle;
  onGenerateSuggestion: (skill: string, targetSection: GapTargetSection) => Promise<string>;
  onContinue: (editedResume: EditableResumeData) => void;
  onEditResume?: () => void;
}

const ReviewEditView: React.FC<ReviewEditViewProps> = ({
  result,
  jobDescription,
  resumeStyle,
  onGenerateSuggestion,
  onContinue,
  onEditResume
}) => {
  // Editable resume state - deep clone to avoid mutations
  const [editedResume, setEditedResume] = useState<EditableResumeData>(() => ({
    ...JSON.parse(JSON.stringify(result.resume)),
    jobTitle: '',
    resumeStyle
  }));

  // Gap states
  const [gapStates, setGapStates] = useState<GapState[]>(() =>
    result.report.gaps.map(gap => ({
      skill: gap,
      status: 'pending'
    }))
  );

  // Currently active gap index
  const [activeGapIndex, setActiveGapIndex] = useState<number | null>(
    result.report.gaps.length > 0 ? 0 : null
  );

  // Job title editing
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [tempJobTitle, setTempJobTitle] = useState(editedResume.jobTitle || '');

  // Track if user is editing manual text
  const [manualText, setManualText] = useState('');

  const updateGapState = (index: number, updates: Partial<GapState>) => {
    setGapStates(prev => prev.map((gap, i) =>
      i === index ? { ...gap, ...updates } : gap
    ));
  };

  const handleAISuggest = async (index: number, targetSection: GapTargetSection) => {
    const gap = gapStates[index];
    updateGapState(index, { status: 'suggesting', targetSection });

    try {
      const suggestion = await onGenerateSuggestion(gap.skill, targetSection);
      updateGapState(index, { status: 'editing', suggestion });
    } catch (error) {
      console.error('Failed to generate suggestion:', error);
      updateGapState(index, { status: 'pending' });
    }
  };

  const handleAddManually = (index: number) => {
    updateGapState(index, { status: 'editing', suggestion: undefined });
    setManualText('');
  };

  const handleSkip = (index: number) => {
    updateGapState(index, { status: 'skipped' });
    moveToNextGap(index);
  };

  const handleAcceptSuggestion = (index: number) => {
    const gap = gapStates[index];
    const textToAdd = gap.suggestion || gap.manualText || manualText;
    const section = gap.targetSection || 'skills';

    if (!textToAdd?.trim()) return;

    // Apply the suggestion to the resume
    setEditedResume(prev => {
      const updated = { ...prev };
      switch (section) {
        case 'skills':
          updated.skills = {
            ...updated.skills,
            core: [...updated.skills.core, textToAdd.trim()]
          };
          break;
        case 'summary':
          updated.summary = `${updated.summary} ${textToAdd.trim()}`;
          break;
        case 'experience':
          const expIndex = gap.targetExperienceIndex ?? 0;
          if (updated.experience[expIndex]) {
            updated.experience = updated.experience.map((exp, i) =>
              i === expIndex
                ? { ...exp, bullets: [...exp.bullets, textToAdd.trim()] }
                : exp
            );
          }
          break;
      }
      return updated;
    });

    updateGapState(index, { status: 'accepted' });
    setManualText('');
    moveToNextGap(index);
  };

  const handleDiscard = (index: number) => {
    updateGapState(index, { status: 'pending', suggestion: undefined, manualText: undefined });
    setManualText('');
  };

  const moveToNextGap = (currentIndex: number) => {
    const nextPending = gapStates.findIndex((g, i) =>
      i > currentIndex && g.status === 'pending'
    );
    if (nextPending !== -1) {
      setActiveGapIndex(nextPending);
    } else {
      // Check if there are any pending before
      const anyPending = gapStates.findIndex(g => g.status === 'pending');
      setActiveGapIndex(anyPending !== -1 ? anyPending : null);
    }
  };

  const handleSaveJobTitle = () => {
    setEditedResume(prev => ({ ...prev, jobTitle: tempJobTitle }));
    setIsEditingTitle(false);
  };

  const pendingGaps = gapStates.filter(g => g.status === 'pending').length;
  const processedGaps = gapStates.filter(g => g.status === 'accepted' || g.status === 'skipped').length;

  return (
    <main className="max-w-6xl w-full grid grid-cols-1 lg:grid-cols-5 gap-8 animate-fade-in">
      {/* Left Column - Gap Filler */}
      <section className="lg:col-span-2 space-y-6">
        {/* Job Title Card */}
        <div className="bg-surface p-6 rounded-2xl shadow-sm border border-border">
          <h2 className="text-sm font-bold text-text-primary mb-4 flex items-center gap-2">
            <Pencil className="w-4 h-4 text-accent" />
            Job Title (Optional)
          </h2>
          <p className="text-xs text-text-muted mb-3">
            Add a job title to appear below your name on the resume
          </p>
          {isEditingTitle ? (
            <div className="flex gap-2">
              <input
                type="text"
                value={tempJobTitle}
                onChange={(e) => setTempJobTitle(e.target.value)}
                placeholder="e.g., Senior Software Engineer"
                className="flex-1 px-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-accent focus:border-transparent"
                autoFocus
              />
              <button
                onClick={handleSaveJobTitle}
                className="px-3 py-2 bg-accent text-white rounded-lg hover:bg-accent-hover transition-colors"
              >
                <Check className="w-4 h-4" />
              </button>
              <button
                onClick={() => {
                  setIsEditingTitle(false);
                  setTempJobTitle(editedResume.jobTitle || '');
                }}
                className="px-3 py-2 border border-border text-text-secondary rounded-lg hover:bg-border-light transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setIsEditingTitle(true)}
              className="w-full flex items-center justify-between px-4 py-3 border border-dashed border-border rounded-lg text-text-secondary hover:border-accent-muted hover:bg-accent-light transition-all"
            >
              <span className="text-sm">
                {editedResume.jobTitle || 'Click to add job title...'}
              </span>
              <PenLine className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Gap Filler Cards */}
        {gapStates.length > 0 && (
          <div className="bg-surface p-6 rounded-2xl shadow-sm border border-border">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold text-text-primary flex items-center gap-2">
                <Lightbulb className="w-4 h-4 text-accent" />
                Fill Skill Gaps
              </h2>
              <span className="text-xs text-text-muted">
                {processedGaps}/{gapStates.length} addressed
              </span>
            </div>

            <p className="text-xs text-text-muted mb-4">
              These skills from the job description are missing from your resume. Add them to improve your ATS score.
            </p>

            {/* Progress indicator */}
            <div className="w-full bg-border-light rounded-full h-1.5 mb-6">
              <div
                className="bg-accent h-1.5 rounded-full transition-all duration-300"
                style={{ width: `${(processedGaps / gapStates.length) * 100}%` }}
              />
            </div>

            {/* Gap Cards */}
            <div className="space-y-3 max-h-[50vh] overflow-y-auto custom-scrollbar pr-2">
              {gapStates.map((gap, index) => (
                <GapCard
                  key={gap.skill}
                  gap={gap}
                  index={index}
                  isActive={activeGapIndex === index}
                  experiences={editedResume.experience}
                  manualText={manualText}
                  setManualText={setManualText}
                  onSelect={() => setActiveGapIndex(index)}
                  onAISuggest={handleAISuggest}
                  onAddManually={handleAddManually}
                  onSkip={handleSkip}
                  onAccept={handleAcceptSuggestion}
                  onDiscard={handleDiscard}
                  onUpdateGap={updateGapState}
                />
              ))}
            </div>
          </div>
        )}

        {/* Edit Resume Button */}
        {onEditResume && (
          <button
            onClick={onEditResume}
            className="w-full flex items-center justify-center gap-2 px-6 py-3 border border-accent text-accent hover:bg-accent-light rounded-xl text-sm font-medium transition-all"
          >
            <Pencil className="w-4 h-4" />
            Edit Resume in Builder
          </button>
        )}

        {/* Continue Button */}
        <button
          onClick={() => onContinue(editedResume)}
          className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-accent hover:bg-accent-hover text-white rounded-xl text-sm font-bold shadow-sm transition-all"
        >
          Continue to Download
          <ChevronRight className="w-4 h-4" />
        </button>

        {pendingGaps > 0 && (
          <p className="text-xs text-center text-text-muted">
            {pendingGaps} gap{pendingGaps > 1 ? 's' : ''} remaining — you can still continue
          </p>
        )}
      </section>

      {/* Right Column - Resume Preview */}
      <section className="lg:col-span-3">
        <div className="bg-surface rounded-2xl shadow-sm border border-border overflow-hidden">
          <div className="bg-border-light px-6 py-4 border-b border-border">
            <div className="flex items-center gap-2 text-accent font-bold text-sm">
              <AlertCircle className="w-4 h-4" /> Live Preview
            </div>
            <p className="text-xs text-text-muted mt-1">Changes update in real-time</p>
          </div>

          <div className="p-8 bg-surface max-h-[80vh] overflow-y-auto custom-scrollbar flex flex-col items-center">
            <div className="w-full max-w-[700px] shadow-sm border border-border p-12 bg-surface text-text-primary text-[11px] leading-relaxed">
              {/* Header with editable job title */}
              <div className="text-center mb-8">
                <h1 className="text-2xl font-bold uppercase mb-1 tracking-tight">
                  {editedResume.contact.name}
                </h1>
                {editedResume.jobTitle && (
                  <p className="text-sm text-text-secondary mb-1">{editedResume.jobTitle}</p>
                )}
                <p className="text-text-muted">
                  {editedResume.contact.email} • {editedResume.contact.phone} • {editedResume.contact.location}
                </p>
              </div>

              <div className="mb-6">
                <h3 className="text-xs font-bold uppercase border-b border-text-primary pb-0.5 mb-2">
                  Professional Summary
                </h3>
                <p>{editedResume.summary}</p>
              </div>

              <div className="mb-6">
                <h3 className="text-xs font-bold uppercase border-b border-text-primary pb-0.5 mb-2">
                  Technical Skills
                </h3>
                <div className="space-y-1">
                  <p>
                    <span className="font-bold">Core Competencies:</span>{' '}
                    {editedResume.skills.core.join(' • ')}
                  </p>
                  <p>
                    <span className="font-bold">Technologies & Tools:</span>{' '}
                    {editedResume.skills.tools.join(' • ')}
                  </p>
                </div>
              </div>

              <div className="mb-6">
                <h3 className="text-xs font-bold uppercase border-b border-text-primary pb-0.5 mb-2">
                  Experience
                </h3>
                <div className="space-y-6">
                  {editedResume.experience.map((exp, i) => (
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
                <h3 className="text-xs font-bold uppercase border-b border-text-primary pb-0.5 mb-2">
                  Education
                </h3>
                <div className="space-y-3">
                  {editedResume.education.map((edu, i) => (
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
          </div>
        </div>
      </section>
    </main>
  );
};

// Gap Card Component
interface GapCardProps {
  gap: GapState;
  index: number;
  isActive: boolean;
  experiences: EditableResumeData['experience'];
  manualText: string;
  setManualText: (text: string) => void;
  onSelect: () => void;
  onAISuggest: (index: number, section: GapTargetSection) => void;
  onAddManually: (index: number) => void;
  onSkip: (index: number) => void;
  onAccept: (index: number) => void;
  onDiscard: (index: number) => void;
  onUpdateGap: (index: number, updates: Partial<GapState>) => void;
}

const GapCard: React.FC<GapCardProps> = ({
  gap,
  index,
  isActive,
  experiences,
  manualText,
  setManualText,
  onSelect,
  onAISuggest,
  onAddManually,
  onSkip,
  onAccept,
  onDiscard,
  onUpdateGap
}) => {
  const [selectedSection, setSelectedSection] = useState<GapTargetSection>('skills');
  const [selectedExpIndex, setSelectedExpIndex] = useState(0);

  if (gap.status === 'accepted') {
    return (
      <div className="p-3 rounded-lg bg-success-light border border-success-border">
        <div className="flex items-center gap-2">
          <Check className="w-4 h-4 text-success" />
          <span className="text-sm font-medium text-success">{gap.skill}</span>
          <span className="text-xs text-success ml-auto">Added</span>
        </div>
      </div>
    );
  }

  if (gap.status === 'skipped') {
    return (
      <div className="p-3 rounded-lg bg-border-light border border-border opacity-60">
        <div className="flex items-center gap-2">
          <SkipForward className="w-4 h-4 text-text-muted" />
          <span className="text-sm font-medium text-text-muted">{gap.skill}</span>
          <span className="text-xs text-text-muted ml-auto">Skipped</span>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`rounded-lg border transition-all cursor-pointer ${
        isActive
          ? 'bg-surface border-accent-muted shadow-sm'
          : 'bg-border-light border-border hover:border-text-muted'
      }`}
      onClick={() => !isActive && onSelect()}
    >
      <div className="p-4">
        <p className="text-sm font-medium text-text-secondary mb-2">
          Your resume is missing: <span className="text-accent font-semibold">{gap.skill}</span>
        </p>

        {isActive && gap.status === 'pending' && (
          <>
            <p className="text-xs text-text-muted mb-3">
              Do you have experience with this? Choose where to add it:
            </p>

            {/* Section selector */}
            <div className="flex gap-2 mb-3">
              <button
                onClick={(e) => { e.stopPropagation(); setSelectedSection('skills'); }}
                className={`flex-1 px-2 py-1.5 text-xs rounded-lg border transition-colors ${
                  selectedSection === 'skills'
                    ? 'bg-accent-light border-accent-muted text-accent-hover'
                    : 'bg-border-light border-border text-text-secondary hover:bg-border'
                }`}
              >
                Skills
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); setSelectedSection('experience'); }}
                className={`flex-1 px-2 py-1.5 text-xs rounded-lg border transition-colors ${
                  selectedSection === 'experience'
                    ? 'bg-accent-light border-accent-muted text-accent-hover'
                    : 'bg-border-light border-border text-text-secondary hover:bg-border'
                }`}
              >
                Experience
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); setSelectedSection('summary'); }}
                className={`flex-1 px-2 py-1.5 text-xs rounded-lg border transition-colors ${
                  selectedSection === 'summary'
                    ? 'bg-accent-light border-accent-muted text-accent-hover'
                    : 'bg-border-light border-border text-text-secondary hover:bg-border'
                }`}
              >
                Summary
              </button>
            </div>

            {/* Experience selector if experience is selected */}
            {selectedSection === 'experience' && (
              <select
                value={selectedExpIndex}
                onChange={(e) => {
                  e.stopPropagation();
                  setSelectedExpIndex(parseInt(e.target.value));
                }}
                onClick={(e) => e.stopPropagation()}
                className="w-full mb-3 px-2 py-1.5 text-xs border border-border rounded-lg focus:ring-2 focus:ring-accent"
              >
                {experiences.map((exp, i) => (
                  <option key={i} value={i}>
                    {exp.role} at {exp.company}
                  </option>
                ))}
              </select>
            )}

            {/* Action buttons */}
            <div className="flex gap-2">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onUpdateGap(index, { targetSection: selectedSection, targetExperienceIndex: selectedExpIndex });
                  onAISuggest(index, selectedSection);
                }}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-accent hover:bg-accent-hover text-white rounded-lg text-xs font-medium transition-colors"
              >
                <Sparkles className="w-3 h-3" /> AI Suggest
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onUpdateGap(index, { targetSection: selectedSection, targetExperienceIndex: selectedExpIndex });
                  onAddManually(index);
                }}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 border border-border hover:bg-border-light text-text-secondary rounded-lg text-xs font-medium transition-colors"
              >
                <PenLine className="w-3 h-3" /> Add Manually
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); onSkip(index); }}
                className="px-3 py-2 text-text-muted hover:text-text-secondary rounded-lg text-xs transition-colors"
              >
                <SkipForward className="w-4 h-4" />
              </button>
            </div>
          </>
        )}

        {isActive && gap.status === 'suggesting' && (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="w-5 h-5 text-accent animate-spin" />
            <span className="ml-2 text-sm text-text-muted">Generating suggestion...</span>
          </div>
        )}

        {isActive && gap.status === 'editing' && (
          <div className="space-y-3">
            <textarea
              value={gap.suggestion ?? manualText}
              onChange={(e) => {
                e.stopPropagation();
                if (gap.suggestion !== undefined) {
                  onUpdateGap(index, { suggestion: e.target.value });
                } else {
                  setManualText(e.target.value);
                }
              }}
              onClick={(e) => e.stopPropagation()}
              placeholder={`Write your ${gap.targetSection} content here...`}
              className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-accent focus:border-transparent resize-none"
              rows={3}
            />
            <div className="flex gap-2">
              <button
                onClick={(e) => { e.stopPropagation(); onAccept(index); }}
                disabled={!(gap.suggestion || manualText)?.trim()}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-success hover:opacity-90 disabled:bg-border text-white rounded-lg text-xs font-medium transition-colors"
              >
                <Check className="w-3 h-3" /> Accept
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); onDiscard(index); }}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 border border-border hover:bg-border-light text-text-secondary rounded-lg text-xs font-medium transition-colors"
              >
                <X className="w-3 h-3" /> Discard
              </button>
            </div>
            <p className="text-[10px] text-text-muted text-center">
              Adding to: {gap.targetSection === 'experience' ? `${experiences[gap.targetExperienceIndex ?? 0]?.role}` : gap.targetSection}
            </p>
          </div>
        )}

        {!isActive && gap.status === 'pending' && (
          <p className="text-xs text-text-muted">Click to expand</p>
        )}
      </div>
    </div>
  );
};

export default ReviewEditView;
