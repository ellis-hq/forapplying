import React, { useState, useMemo } from 'react';
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
  Lightbulb,
  Calendar
} from 'lucide-react';
import {
  TailorResponse,
  GapState,
  GapTargetSection,
  EditableResumeData,
  ResumeStyle,
  EmploymentGap,
  EmploymentGapResolutionState,
  EmploymentGapResolutionType,
  EmploymentGapSuggestion,
  ResumeProject,
  ResumeExperience,
  ResumeEducation,
  VolunteerEntry
} from '../types';
import { detectEmploymentGaps, generateGapSummary } from '../utils/employmentGapDetector';
import EmploymentGapAlert from './EmploymentGapAlert';
import GapResolutionForm from './GapResolutionForm';

interface ReviewEditViewProps {
  result: TailorResponse;
  jobDescription: string;
  resumeStyle: ResumeStyle;
  onGenerateSuggestion: (skill: string, targetSection: GapTargetSection) => Promise<string>;
  onGenerateEmploymentGapSuggestions: (gap: EmploymentGap) => Promise<EmploymentGapSuggestion[]>;
  onContinue: (editedResume: EditableResumeData, employmentGaps: EmploymentGap[], gapResolutions: EmploymentGapResolutionState[]) => void;
  onEditResume?: () => void;
}

const ReviewEditView: React.FC<ReviewEditViewProps> = ({
  result,
  jobDescription,
  resumeStyle,
  onGenerateSuggestion,
  onGenerateEmploymentGapSuggestions,
  onContinue,
  onEditResume
}) => {
  // Editable resume state - deep clone to avoid mutations
  const [editedResume, setEditedResume] = useState<EditableResumeData>(() => ({
    ...JSON.parse(JSON.stringify(result.resume)),
    jobTitle: '',
    resumeStyle
  }));

  // Skill Gap states
  const [gapStates, setGapStates] = useState<GapState[]>(() =>
    result.report.gaps.map(gap => ({
      skill: gap,
      status: 'pending'
    }))
  );

  // Currently active skill gap index
  const [activeGapIndex, setActiveGapIndex] = useState<number | null>(
    result.report.gaps.length > 0 ? 0 : null
  );

  // Employment Gap Detection
  const [employmentGaps] = useState<EmploymentGap[]>(() =>
    detectEmploymentGaps(result.resume.experience, result.resume.education)
  );

  const [employmentGapResolutions, setEmploymentGapResolutions] = useState<EmploymentGapResolutionState[]>(() =>
    employmentGaps.map(gap => ({
      gapId: gap.id,
      status: 'pending' as const
    }))
  );

  // Employment gap resolution form state
  const [activeGapForm, setActiveGapForm] = useState<{
    gap: EmploymentGap;
    type: EmploymentGapResolutionType;
    prefillData?: { title?: string; description?: string };
  } | null>(null);

  // Computed employment gap summary
  const employmentGapSummary = useMemo(() =>
    generateGapSummary(employmentGaps, employmentGapResolutions),
    [employmentGaps, employmentGapResolutions]
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

    const trimmedText = textToAdd.trim();

    // Apply the suggestion to the resume
    setEditedResume(prev => {
      const updated = { ...prev };
      switch (section) {
        case 'skills':
          updated.skills = {
            ...updated.skills,
            core: [...updated.skills.core, trimmedText]
          };
          break;
        case 'summary':
          updated.summary = `${updated.summary} ${trimmedText}`;
          break;
        case 'experience':
          const expIndex = gap.targetExperienceIndex ?? 0;
          if (updated.experience[expIndex]) {
            updated.experience = updated.experience.map((exp, i) =>
              i === expIndex
                ? { ...exp, bullets: [...exp.bullets, trimmedText] }
                : exp
            );
          }
          break;
      }
      return updated;
    });

    // Store the added content so we can remove it on undo
    updateGapState(index, { status: 'accepted', addedContent: trimmedText });
    setManualText('');
    moveToNextGap(index);
  };

  const handleUndoAccepted = (index: number) => {
    const gap = gapStates[index];
    const section = gap.targetSection || 'skills';
    const addedContent = gap.addedContent;

    if (!addedContent) {
      // No content tracked, just reset to pending
      updateGapState(index, { status: 'pending', suggestion: undefined, addedContent: undefined });
      return;
    }

    // Remove the previously added content from the resume
    setEditedResume(prev => {
      const updated = { ...prev };
      switch (section) {
        case 'skills':
          updated.skills = {
            ...updated.skills,
            core: updated.skills.core.filter(skill => skill !== addedContent)
          };
          break;
        case 'summary':
          // Remove the appended text from summary
          updated.summary = updated.summary.replace(` ${addedContent}`, '').replace(addedContent, '');
          break;
        case 'experience':
          const expIndex = gap.targetExperienceIndex ?? 0;
          if (updated.experience[expIndex]) {
            updated.experience = updated.experience.map((exp, i) =>
              i === expIndex
                ? { ...exp, bullets: exp.bullets.filter(b => b !== addedContent) }
                : exp
            );
          }
          break;
      }
      return updated;
    });

    // Reset the gap to editing state with the previous content pre-filled
    updateGapState(index, {
      status: 'editing',
      suggestion: addedContent,
      addedContent: undefined
    });
    setActiveGapIndex(index);
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

  // Employment Gap Handlers
  const updateEmploymentGapResolution = (gapId: string, updates: Partial<EmploymentGapResolutionState>) => {
    setEmploymentGapResolutions(prev =>
      prev.map(r => r.gapId === gapId ? { ...r, ...updates } : r)
    );
  };

  const handleEmploymentGapResolve = (gapId: string, type: EmploymentGapResolutionType) => {
    const gap = employmentGaps.find(g => g.id === gapId);
    if (!gap) return;
    setActiveGapForm({ gap, type });
  };

  const handleEmploymentGapDismiss = (gapId: string) => {
    updateEmploymentGapResolution(gapId, {
      status: 'dismissed',
      resolutionType: 'dismissed'
    });
  };

  const handleEmploymentGapAISuggest = async (gapId: string) => {
    const gap = employmentGaps.find(g => g.id === gapId);
    if (!gap) return;

    updateEmploymentGapResolution(gapId, { status: 'suggesting' });

    try {
      const suggestions = await onGenerateEmploymentGapSuggestions(gap);
      updateEmploymentGapResolution(gapId, {
        status: 'pending',
        aiSuggestions: suggestions
      });
    } catch (error) {
      console.error('Failed to generate employment gap suggestions:', error);
      updateEmploymentGapResolution(gapId, { status: 'pending' });
    }
  };

  const handleSelectEmploymentGapSuggestion = (gapId: string, suggestion: EmploymentGapSuggestion) => {
    const gap = employmentGaps.find(g => g.id === gapId);
    if (!gap) return;

    setActiveGapForm({
      gap,
      type: suggestion.type,
      prefillData: { title: suggestion.title, description: suggestion.description }
    });
  };

  const handleGapFormSubmit = (
    type: EmploymentGapResolutionType,
    data: ResumeProject | ResumeExperience | ResumeEducation | VolunteerEntry
  ) => {
    if (!activeGapForm) return;

    setEditedResume(prev => {
      const updated = { ...prev };

      switch (type) {
        case 'project':
          updated.projects = [...(updated.projects || []), data as ResumeProject];
          updated.includeProjects = true;
          break;
        case 'freelance':
          // Insert the experience in chronological order
          const newExp = data as ResumeExperience;
          const experiences = [...updated.experience];
          // Find the right position based on start date
          let insertIndex = experiences.length;
          for (let i = 0; i < experiences.length; i++) {
            const exp = experiences[i];
            const expYear = parseInt(exp.startYear || '0', 10);
            const newExpYear = parseInt(newExp.startYear || '0', 10);
            if (newExpYear > expYear) {
              insertIndex = i;
              break;
            }
          }
          experiences.splice(insertIndex, 0, newExp);
          updated.experience = experiences;
          break;
        case 'education':
          updated.education = [...updated.education, data as ResumeEducation];
          break;
        case 'volunteer':
          updated.volunteer = [...(updated.volunteer || []), data as VolunteerEntry];
          updated.includeVolunteer = true;
          break;
      }

      return updated;
    });

    // Mark the gap as resolved and store the added data for undo
    updateEmploymentGapResolution(activeGapForm.gap.id, {
      status: 'resolved',
      resolutionType: type,
      addedData: data
    });

    setActiveGapForm(null);
  };

  const handleUndoEmploymentGap = (gapId: string) => {
    const resolution = employmentGapResolutions.find(r => r.gapId === gapId);
    if (!resolution || !resolution.addedData || !resolution.resolutionType) {
      // No data to undo, just reset to pending
      updateEmploymentGapResolution(gapId, {
        status: 'pending',
        resolutionType: undefined,
        addedData: undefined
      });
      return;
    }

    // Remove the previously added data from the resume
    setEditedResume(prev => {
      const updated = { ...prev };

      switch (resolution.resolutionType) {
        case 'project':
          const projectData = resolution.addedData as ResumeProject;
          updated.projects = (updated.projects || []).filter(
            p => p.name !== projectData.name || p.dateRange !== projectData.dateRange
          );
          if (updated.projects.length === 0) {
            updated.includeProjects = false;
          }
          break;
        case 'freelance':
          const expData = resolution.addedData as ResumeExperience;
          updated.experience = updated.experience.filter(
            e => e.company !== expData.company || e.role !== expData.role || e.dateRange !== expData.dateRange
          );
          break;
        case 'education':
          const eduData = resolution.addedData as ResumeEducation;
          updated.education = updated.education.filter(
            e => e.school !== eduData.school || e.degree !== eduData.degree || e.dateRange !== eduData.dateRange
          );
          break;
        case 'volunteer':
          const volData = resolution.addedData as VolunteerEntry;
          updated.volunteer = (updated.volunteer || []).filter(
            v => v.organization !== volData.organization || v.role !== volData.role || v.dateRange !== volData.dateRange
          );
          if (updated.volunteer.length === 0) {
            updated.includeVolunteer = false;
          }
          break;
      }

      return updated;
    });

    // Open the form with the previous data pre-filled
    const gap = employmentGaps.find(g => g.id === gapId);
    if (gap && resolution.resolutionType !== 'dismissed') {
      // Get prefill data based on the resolution type
      let prefillData: { title?: string; description?: string } | undefined;

      switch (resolution.resolutionType) {
        case 'project':
          const proj = resolution.addedData as ResumeProject;
          prefillData = { title: proj.name, description: proj.description };
          break;
        case 'freelance':
          const exp = resolution.addedData as ResumeExperience;
          prefillData = { title: `${exp.role} at ${exp.company}`, description: exp.bullets.join('\n') };
          break;
        case 'education':
          const edu = resolution.addedData as ResumeEducation;
          prefillData = { title: `${edu.degree} at ${edu.school}` };
          break;
        case 'volunteer':
          const vol = resolution.addedData as VolunteerEntry;
          prefillData = { title: `${vol.role} at ${vol.organization}`, description: vol.description };
          break;
      }

      setActiveGapForm({
        gap,
        type: resolution.resolutionType,
        prefillData
      });
    }

    // Reset the resolution state
    updateEmploymentGapResolution(gapId, {
      status: 'pending',
      resolutionType: undefined,
      addedData: undefined
    });
  };

  const handleGapFormCancel = () => {
    setActiveGapForm(null);
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
                  onUndo={handleUndoAccepted}
                />
              ))}
            </div>
          </div>
        )}

        {/* Employment Gap Cards */}
        {employmentGaps.length > 0 && (
          <div className="bg-surface p-6 rounded-2xl shadow-sm border border-border">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold text-text-primary flex items-center gap-2">
                <Calendar className="w-4 h-4 text-warning" />
                Employment Gaps
              </h2>
              <span className="text-xs text-text-muted">
                {employmentGapSummary.addressedGaps}/{employmentGapSummary.totalGaps} addressed
              </span>
            </div>

            <p className="text-xs text-text-muted mb-4">
              We detected gaps between your jobs. Addressing them can strengthen your application.
            </p>

            {/* Progress indicator */}
            <div className="w-full bg-border-light rounded-full h-1.5 mb-6">
              <div
                className="bg-warning h-1.5 rounded-full transition-all duration-300"
                style={{ width: `${(employmentGapSummary.addressedGaps / employmentGapSummary.totalGaps) * 100}%` }}
              />
            </div>

            {/* Gap Alert Cards */}
            <div className="space-y-4">
              {employmentGaps.map(gap => {
                const resolution = employmentGapResolutions.find(r => r.gapId === gap.id)!;
                return (
                  <EmploymentGapAlert
                    key={gap.id}
                    gap={gap}
                    resolution={resolution}
                    onResolve={handleEmploymentGapResolve}
                    onDismiss={handleEmploymentGapDismiss}
                    onAISuggest={handleEmploymentGapAISuggest}
                    onSelectSuggestion={handleSelectEmploymentGapSuggestion}
                    onUndo={handleUndoEmploymentGap}
                  />
                );
              })}
            </div>
          </div>
        )}

        {/* Gap Resolution Form Modal */}
        {activeGapForm && (
          <GapResolutionForm
            gap={activeGapForm.gap}
            resolutionType={activeGapForm.type}
            prefillData={activeGapForm.prefillData}
            onSubmit={handleGapFormSubmit}
            onCancel={handleGapFormCancel}
          />
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
          onClick={() => onContinue(editedResume, employmentGaps, employmentGapResolutions)}
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

              {/* Projects Section */}
              {editedResume.includeProjects && editedResume.projects && editedResume.projects.length > 0 && (
                <div className="mt-6">
                  <h3 className="text-xs font-bold uppercase border-b border-text-primary pb-0.5 mb-2">
                    Projects
                  </h3>
                  <div className="space-y-3">
                    {editedResume.projects.map((proj, i) => (
                      <div key={i}>
                        <div className="flex justify-between items-baseline mb-0.5">
                          <h4 className="font-bold text-sm">{proj.name}</h4>
                          <span className="font-bold italic text-xs">{proj.dateRange}</span>
                        </div>
                        <p className="text-text-secondary text-xs">{proj.description}</p>
                        {proj.technologies && (
                          <p className="text-text-muted text-xs mt-1">Technologies: {proj.technologies}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Volunteer Section */}
              {editedResume.includeVolunteer && editedResume.volunteer && editedResume.volunteer.length > 0 && (
                <div className="mt-6">
                  <h3 className="text-xs font-bold uppercase border-b border-text-primary pb-0.5 mb-2">
                    Volunteer Work
                  </h3>
                  <div className="space-y-3">
                    {editedResume.volunteer.map((vol, i) => (
                      <div key={i}>
                        <div className="flex justify-between items-baseline mb-0.5">
                          <h4 className="font-bold text-sm uppercase">{vol.organization}</h4>
                          <span className="font-bold italic text-xs">{vol.dateRange}</span>
                        </div>
                        <p className="italic text-text-secondary text-xs">{vol.role}</p>
                        <p className="text-text-muted text-xs mt-1">{vol.description}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Certifications Section */}
              {editedResume.includeCertifications && editedResume.certifications && editedResume.certifications.length > 0 && (
                <div className="mt-6">
                  <h3 className="text-xs font-bold uppercase border-b border-text-primary pb-0.5 mb-2">
                    Certifications
                  </h3>
                  <div className="space-y-2">
                    {editedResume.certifications.map((cert, i) => (
                      <div key={i} className="flex justify-between items-baseline">
                        <div>
                          <span className="font-bold">{cert.name}</span>
                          {cert.issuer && <span className="text-text-muted"> — {cert.issuer}</span>}
                        </div>
                        <span className="text-text-muted text-xs italic">
                          {cert.dateObtained}
                          {cert.expirationDate && !cert.noExpiration && ` (Exp: ${cert.expirationDate})`}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Clinical Hours Section */}
              {editedResume.includeClinicalHours && editedResume.clinicalHours && editedResume.clinicalHours.length > 0 && (
                <div className="mt-6">
                  <h3 className="text-xs font-bold uppercase border-b border-text-primary pb-0.5 mb-2">
                    Clinical Hours
                  </h3>
                  <div className="space-y-3">
                    {editedResume.clinicalHours.map((clinical, i) => (
                      <div key={i}>
                        <div className="flex justify-between items-baseline mb-0.5">
                          <h4 className="font-bold text-sm">{clinical.siteName}</h4>
                          <span className="font-bold text-xs">{clinical.hoursCompleted} hours</span>
                        </div>
                        {clinical.role && <p className="italic text-text-secondary text-xs">{clinical.role}</p>}
                        {clinical.description && (
                          <p className="text-text-muted text-xs mt-1">{clinical.description}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Publications Section */}
              {editedResume.includePublications && editedResume.publications && editedResume.publications.length > 0 && (
                <div className="mt-6">
                  <h3 className="text-xs font-bold uppercase border-b border-text-primary pb-0.5 mb-2">
                    Publications
                  </h3>
                  <div className="space-y-2">
                    {editedResume.publications.map((pub, i) => (
                      <div key={i}>
                        <p>
                          <span className="font-bold">{pub.title}</span>
                          {pub.publication && <span className="text-text-muted"> — {pub.publication}</span>}
                          {pub.date && <span className="text-text-muted">, {pub.date}</span>}
                        </p>
                        {pub.url && (
                          <p className="text-accent text-xs">{pub.url}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Languages Section */}
              {editedResume.includeLanguages && editedResume.languages && editedResume.languages.length > 0 && (
                <div className="mt-6">
                  <h3 className="text-xs font-bold uppercase border-b border-text-primary pb-0.5 mb-2">
                    Languages
                  </h3>
                  <p>{editedResume.languages.join(' • ')}</p>
                </div>
              )}

              {/* Awards Section */}
              {editedResume.includeAwards && editedResume.awards && editedResume.awards.length > 0 && (
                <div className="mt-6">
                  <h3 className="text-xs font-bold uppercase border-b border-text-primary pb-0.5 mb-2">
                    Awards & Honors
                  </h3>
                  <div className="space-y-2">
                    {editedResume.awards.map((award, i) => (
                      <div key={i}>
                        <div className="flex justify-between items-baseline">
                          <span className="font-bold">{award.title}</span>
                          {award.date && <span className="text-text-muted text-xs italic">{award.date}</span>}
                        </div>
                        {award.issuer && <p className="text-text-muted text-xs">{award.issuer}</p>}
                        {award.description && (
                          <p className="text-text-secondary text-xs mt-0.5">{award.description}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
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
  onUndo: (index: number) => void;
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
  onUpdateGap,
  onUndo
}) => {
  const [selectedSection, setSelectedSection] = useState<GapTargetSection>('skills');
  const [selectedExpIndex, setSelectedExpIndex] = useState(0);

  if (gap.status === 'accepted') {
    return (
      <div className="p-3 rounded-lg bg-success-light border border-success-border">
        <div className="flex items-center gap-2">
          <Check className="w-4 h-4 text-success" />
          <span className="text-sm font-medium text-success">{gap.skill}</span>
          <button
            onClick={() => onUndo(index)}
            className="ml-auto flex items-center gap-1 px-2 py-1 text-xs text-success hover:text-success hover:bg-success/10 rounded transition-colors"
          >
            <Pencil className="w-3 h-3" />
            Edit
          </button>
        </div>
      </div>
    );
  }

  if (gap.status === 'skipped') {
    return (
      <div className="p-3 rounded-lg bg-border-light border border-border opacity-60 hover:opacity-100 transition-opacity">
        <div className="flex items-center gap-2">
          <SkipForward className="w-4 h-4 text-text-muted" />
          <span className="text-sm font-medium text-text-muted">{gap.skill}</span>
          <button
            onClick={() => onUndo(index)}
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
