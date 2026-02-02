import React, { useState, useMemo, useCallback } from 'react';
import { User } from '@supabase/supabase-js';
import { extractTextFromPDF, generateATSPDF, generateCoverLetterPDF } from './services/pdfService';
import { tailorResume as tailorResumeAPI, generateGapSuggestion, generateEmploymentGapSuggestions, convertToOnePage as convertToOnePageAPI } from './services/claudeService';
import {
  TailorResponse,
  RewriteMode,
  AppView,
  EditableResumeData,
  GapTargetSection,
  ResumeStyle,
  TailoredResumeData,
  ResumeEntryMode,
  EmploymentGap,
  EmploymentGapResolutionState,
  EmploymentGapSuggestion
} from './types';
import { UserProfile } from './lib/supabase';
import Header from './components/Header';
import Footer from './components/Footer';
import WelcomeView from './components/WelcomeView';
import InputView from './components/InputView';
import ResumeBuilder from './components/ResumeBuilder';
import ResultView from './components/ResultView';
import ReviewEditView from './components/ReviewEditView';
import AboutView from './components/AboutView';
import AuthGate from './components/AuthGate';

type ResumeTailorProps = {
  user: User;
  profile: UserProfile;
  onDownload: () => Promise<void>;
};

// Normalize date formats in resume data to "Month Year" format (e.g., "January 2020")
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const MONTH_ABBREV_MAP: Record<string, string> = {
  'jan': 'January', 'feb': 'February', 'mar': 'March', 'apr': 'April',
  'may': 'May', 'jun': 'June', 'jul': 'July', 'aug': 'August',
  'sep': 'September', 'sept': 'September', 'oct': 'October', 'nov': 'November', 'dec': 'December'
};

function isSingleDateToken(value: string): boolean {
  const s = value.trim();
  if (!s) return true;
  return (
    /^\d{4}-\d{1,2}$/.test(s) || // YYYY-MM
    /^\d{1,2}\/\d{4}$/.test(s) || // MM/YYYY
    /^\d{4}$/.test(s) || // YYYY
    /^[A-Za-z]+\.?\s+\d{4}$/.test(s) // Month YYYY / Mon YYYY / Sept. YYYY
  );
}

function splitDateRangeParts(dateRange: string): { startPart: string; endPart: string } {
  const trimmed = dateRange.trim();
  if (!trimmed) return { startPart: '', endPart: '' };
  if (isSingleDateToken(trimmed)) return { startPart: trimmed, endPart: '' };
  const rangeMatch = trimmed.match(/^(.+?)\s*[–—-]\s*(.+)$/);
  if (rangeMatch) return { startPart: rangeMatch[1].trim(), endPart: rangeMatch[2].trim() };
  return { startPart: trimmed, endPart: '' };
}

function parseDatePart(s: string): { month: string; year: string } {
  if (!s) return { month: '', year: '' };
  const slashMatch = s.match(/^(\d{1,2})\/(\d{4})$/);
  if (slashMatch) return { month: MONTHS[parseInt(slashMatch[1], 10) - 1] || '', year: slashMatch[2] };
  const isoMatch = s.match(/^(\d{4})-(\d{1,2})$/);
  if (isoMatch) return { month: MONTHS[parseInt(isoMatch[2], 10) - 1] || '', year: isoMatch[1] };
  const wordMatch = s.match(/^([A-Za-z]+)\.?\s+(\d{4})$/);
  if (wordMatch) {
    const normalized = wordMatch[1].toLowerCase().replace(/[^a-z]/g, '');
    const full = MONTH_ABBREV_MAP[normalized] || MONTHS.find(m => m.toLowerCase() === normalized) || '';
    return { month: full, year: wordMatch[2] };
  }
  const yearMatch = s.match(/^(\d{4})$/);
  if (yearMatch) return { month: '', year: yearMatch[1] };
  return { month: '', year: '' };
}

function normalizeResumeDates(resume: TailoredResumeData): TailoredResumeData {
  console.log('[DATE-DEBUG] normalizeResumeDates called with', resume.experience?.length, 'experience entries');
  const hydrateEntry = (entry: any, currentKey: 'isCurrentRole' | 'isInProgress') => {
    const dateRange = entry.dateRange || '';
    console.log('[DATE-DEBUG] hydrateEntry input:', { dateRange, startMonth: entry.startMonth, startYear: entry.startYear });
    const { startPart, endPart } = splitDateRangeParts(dateRange);
    const start = parseDatePart(startPart);
    const isCurrent = /present|current/i.test(endPart);
    const end = isCurrent ? { month: '', year: '' } : parseDatePart(endPart);
    const startMonth = entry.startMonth || start.month;
    const startYear = entry.startYear || start.year;
    const endMonth = entry.endMonth || end.month;
    const endYear = entry.endYear || end.year;
    const isCurrentValue = entry[currentKey] ?? isCurrent;
    const startStr = startMonth && startYear ? `${startMonth} ${startYear}` : startYear || '';
    const endStr = isCurrentValue ? 'Present' : (endMonth && endYear ? `${endMonth} ${endYear}` : endYear || '');
    const newDateRange = startStr && endStr ? `${startStr} – ${endStr}` : startStr || endStr || dateRange;
    console.log('[DATE-DEBUG] hydrateEntry output:', { startMonth, startYear, endMonth, endYear, isCurrentValue, dateRange: newDateRange });
    return { ...entry, startMonth, startYear, endMonth, endYear, [currentKey]: isCurrentValue, dateRange: newDateRange };
  };
  return {
    ...resume,
    experience: resume.experience.map(entry => hydrateEntry(entry, 'isCurrentRole')),
    education: resume.education.map(entry => hydrateEntry(entry, 'isInProgress')),
  };
}

const ResumeTailor: React.FC<ResumeTailorProps> = ({ user, profile, onDownload }) => {
  const [file, setFile] = useState<File | null>(null);
  const [jobDesc, setJobDesc] = useState('');
  const [company, setCompany] = useState('');
  const [mode, setMode] = useState<RewriteMode>(RewriteMode.CONSERVATIVE);
  const [resumeStyle, setResumeStyle] = useState<ResumeStyle>(ResumeStyle.CLASSIC);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<TailorResponse | null>(null);
  const [currentView, setCurrentView] = useState<AppView>(AppView.WELCOME);
  const [editedResume, setEditedResume] = useState<EditableResumeData | null>(null);
  const [entryMode, setEntryMode] = useState<ResumeEntryMode | null>(null);
  const [builtResume, setBuiltResume] = useState<TailoredResumeData | null>(null);
  const [employmentGaps, setEmploymentGaps] = useState<EmploymentGap[]>([]);
  const [gapResolutions, setGapResolutions] = useState<EmploymentGapResolutionState[]>([]);
  const [previousView, setPreviousView] = useState<AppView>(AppView.WELCOME);
  const [onePageResume, setOnePageResume] = useState<TailoredResumeData | null>(null);
  const [isConverting, setIsConverting] = useState(false);

  const matchScore = useMemo(() => {
    if (!result) return 0;
    const total = result.report.keywords.length + result.report.gaps.length;
    if (total === 0) return 100;
    return Math.round((result.report.keywords.length / total) * 100);
  }, [result]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selected = e.target.files[0];
      if (selected.type !== 'application/pdf') {
        setError('Please upload a PDF file.');
        return;
      }
      setFile(selected);
      setError(null);
    }
  };

  // Convert built resume to text format for Claude
  const resumeToText = (resume: TailoredResumeData): string => {
    let text = '';

    // Contact
    text += `${resume.contact.name}\n`;
    text += `${resume.contact.email} | ${resume.contact.phone} | ${resume.contact.location}\n`;
    if (resume.contact.linkedin) text += `${resume.contact.linkedin}\n`;
    text += '\n';

    // Objective
    if (resume.includeObjective && resume.objective) {
      text += `OBJECTIVE\n${resume.objective}\n\n`;
    }

    // Summary
    if (resume.summary) {
      text += `PROFESSIONAL SUMMARY\n${resume.summary}\n\n`;
    }

    // Skills
    if (resume.skills.core.length > 0 || resume.skills.tools.length > 0) {
      text += 'SKILLS\n';
      if (resume.skills.core.length > 0) {
        text += `Core Competencies: ${resume.skills.core.join(', ')}\n`;
      }
      if (resume.skills.tools.length > 0) {
        text += `Tools & Technologies: ${resume.skills.tools.join(', ')}\n`;
      }
      text += '\n';
    }

    // Experience
    if (resume.experience.length > 0) {
      text += 'EXPERIENCE\n';
      resume.experience.forEach(exp => {
        text += `${exp.role} at ${exp.company}\n`;
        text += `${exp.location} | ${exp.dateRange}\n`;
        exp.bullets.forEach(bullet => {
          if (bullet.trim()) text += `• ${bullet}\n`;
        });
        text += '\n';
      });
    }

    // Education
    if (resume.education.length > 0) {
      text += 'EDUCATION\n';
      resume.education.forEach(edu => {
        text += `${edu.degree}${edu.fieldOfStudy ? ` in ${edu.fieldOfStudy}` : ''}\n`;
        text += `${edu.school}, ${edu.location} | ${edu.dateRange}\n\n`;
      });
    }

    // Projects
    if (resume.includeProjects && resume.projects && resume.projects.length > 0) {
      text += 'PROJECTS\n';
      resume.projects.forEach(proj => {
        text += `${proj.name} (${proj.dateRange})\n`;
        text += `${proj.description}\n`;
        if (proj.technologies) text += `Technologies: ${proj.technologies}\n`;
        text += '\n';
      });
    }

    // Certifications
    if (resume.includeCertifications && resume.certifications && resume.certifications.length > 0) {
      text += 'CERTIFICATIONS\n';
      resume.certifications.forEach(cert => {
        text += `${cert.name}, ${cert.issuer} (${cert.dateObtained})\n`;
      });
      text += '\n';
    }

    // Clinical Hours
    if (resume.includeClinicalHours && resume.clinicalHours && resume.clinicalHours.length > 0) {
      text += 'CLINICAL HOURS / PRACTICUM\n';
      resume.clinicalHours.forEach(entry => {
        text += `${entry.role} at ${entry.siteName} - ${entry.hoursCompleted} hours\n`;
        if (entry.description) text += `${entry.description}\n`;
        text += '\n';
      });
    }

    // Volunteer
    if (resume.includeVolunteer && resume.volunteer && resume.volunteer.length > 0) {
      text += 'VOLUNTEER WORK\n';
      resume.volunteer.forEach(vol => {
        text += `${vol.role} at ${vol.organization} (${vol.dateRange})\n`;
        text += `${vol.description}\n\n`;
      });
    }

    // Publications
    if (resume.includePublications && resume.publications && resume.publications.length > 0) {
      text += 'PUBLICATIONS\n';
      resume.publications.forEach(pub => {
        text += `"${pub.title}" - ${pub.publication}, ${pub.date}\n`;
      });
      text += '\n';
    }

    // Languages
    if (resume.includeLanguages && resume.languages && resume.languages.length > 0) {
      text += `LANGUAGES\n${resume.languages.join(', ')}\n\n`;
    }

    // Awards
    if (resume.includeAwards && resume.awards && resume.awards.length > 0) {
      text += 'AWARDS & HONORS\n';
      resume.awards.forEach(award => {
        text += `${award.title}, ${award.issuer} (${award.date})\n`;
        if (award.description) text += `${award.description}\n`;
      });
      text += '\n';
    }

    return text;
  };

  const handleGenerate = async () => {
    // For upload mode, need file; for build mode, need builtResume
    if (entryMode === ResumeEntryMode.UPLOAD && !file) {
      setError('Please upload a resume PDF.');
      return;
    }
    if (entryMode === ResumeEntryMode.BUILD && !builtResume) {
      setError('Please build your resume first.');
      return;
    }
    if (!jobDesc.trim() || !company.trim()) {
      setError('Please provide Job Description and Company Name.');
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      let resumeText: string;

      if (entryMode === ResumeEntryMode.UPLOAD && file) {
        resumeText = await extractTextFromPDF(file);
        if (!resumeText.trim()) {
          throw new Error('Could not extract text from the PDF. It might be an image-only scan.');
        }
      } else if (builtResume) {
        resumeText = resumeToText(builtResume);
      } else {
        throw new Error('No resume data available.');
      }

      const tailoringResult = await tailorResumeAPI(resumeText, jobDesc, company, mode, resumeStyle);
      // Normalize all dates to "Month Year" format before storing
      tailoringResult.resume = normalizeResumeDates(tailoringResult.resume);
      setResult(tailoringResult);
      setCurrentView(AppView.REVIEW); // Go to review screen after generation
    } catch (err: unknown) {
      console.error(err);
      const errorMessage = err instanceof Error ? err.message : 'An error occurred during processing.';
      setError(errorMessage);
    } finally {
      setIsProcessing(false);
    }
  };

  const downloadResume = async () => {
    if (!result) return;
    // Track the download (don't block on failure)
    try {
      await onDownload();
    } catch (err) {
      console.error('Failed to track download:', err);
    }
    // Use edited resume if available, otherwise use original
    const resumeToDownload = editedResume || result.resume;
    const doc = generateATSPDF(resumeToDownload);
    doc.save(`${resumeToDownload.contact.name.replace(/\s+/g, '_')}_Resume_${company.replace(/\s+/g, '_')}.pdf`);
  };

  const downloadCoverLetter = async () => {
    if (!result) return;
    // Track the download (don't block on failure)
    try {
      await onDownload();
    } catch (err) {
      console.error('Failed to track download:', err);
    }
    const doc = generateCoverLetterPDF(result.coverLetter, result.resume.contact);
    doc.save(`Cover_Letter_${company.replace(/\s+/g, '_')}.pdf`);
  };

  const handleConvertToOnePage = async () => {
    if (!result) return;
    const resumeData = editedResume || result.resume;
    setIsConverting(true);
    setError(null);
    try {
      const onePage = await convertToOnePageAPI(resumeData, jobDesc);
      setOnePageResume(normalizeResumeDates(onePage));
    } catch (err: unknown) {
      console.error(err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to convert to one page.';
      setError(errorMessage);
    } finally {
      setIsConverting(false);
    }
  };

  const downloadOnePageResume = async () => {
    if (!onePageResume) return;
    try {
      await onDownload();
    } catch (err) {
      console.error('Failed to track download:', err);
    }
    const doc = generateATSPDF(onePageResume);
    doc.save(`${onePageResume.contact.name.replace(/\s+/g, '_')}_Resume_1Page_${company.replace(/\s+/g, '_')}.pdf`);
  };

  const reset = () => {
    setResult(null);
    setFile(null);
    setJobDesc('');
    setCompany('');
    setError(null);
    setMode(RewriteMode.CONSERVATIVE);
    setResumeStyle(ResumeStyle.CLASSIC);
    setCurrentView(AppView.WELCOME);
    setEditedResume(null);
    setEntryMode(null);
    setBuiltResume(null);
    setEmploymentGaps([]);
    setGapResolutions([]);
    setOnePageResume(null);
    setIsConverting(false);
  };

  // Handler for selecting entry mode from welcome screen
  const handleSelectMode = (mode: ResumeEntryMode) => {
    setEntryMode(mode);
    if (mode === ResumeEntryMode.UPLOAD) {
      setCurrentView(AppView.INPUT);
    } else {
      setCurrentView(AppView.BUILDER);
    }
  };

  // Handler for when resume builder completes
  const handleBuilderContinue = (resume: TailoredResumeData) => {
    setBuiltResume(resume);
    setCurrentView(AppView.INPUT);
  };

  // Handler for going back to builder from input
  const handleBackToBuilder = () => {
    setCurrentView(AppView.BUILDER);
  };

  // Handler for going back to welcome
  const handleBackToWelcome = () => {
    setCurrentView(AppView.WELCOME);
    setEntryMode(null);
  };

  // Handler for going to About page
  const handleAbout = () => {
    setPreviousView(currentView);
    setCurrentView(AppView.ABOUT);
  };

  // Handler for going back from About page
  const handleBackFromAbout = () => {
    setCurrentView(previousView);
  };

  // Handler for editing resume from review screen
  const handleEditResume = () => {
    if (result) {
      setBuiltResume(result.resume);
    }
    setEntryMode(ResumeEntryMode.BUILD);
    setCurrentView(AppView.BUILDER);
  };

  const handleEditOnePageResume = () => {
    if (!onePageResume) return;
    setCurrentView(AppView.ONE_PAGE_BUILDER);
  };

  // Handler for generating gap suggestions via Claude API
  const handleGenerateSuggestion = useCallback(async (skill: string, targetSection: GapTargetSection): Promise<string> => {
    if (!result) throw new Error('No resume data available');
    return generateGapSuggestion(skill, result.resume, targetSection, jobDesc);
  }, [result, jobDesc]);

  // Handler for generating employment gap suggestions
  const handleGenerateEmploymentGapSuggestions = useCallback(async (gap: EmploymentGap): Promise<EmploymentGapSuggestion[]> => {
    if (!result) throw new Error('No resume data available');
    return generateEmploymentGapSuggestions(gap, result.resume, jobDesc);
  }, [result, jobDesc]);

  // Handler for continuing from review to result view
  const handleContinueFromReview = useCallback((
    edited: EditableResumeData,
    gaps: EmploymentGap[],
    resolutions: EmploymentGapResolutionState[]
  ) => {
    setEditedResume(edited);
    setEmploymentGaps(gaps);
    setGapResolutions(resolutions);
    setCurrentView(AppView.RESULT);
  }, []);

  const handleOnePageBuilderContinue = (resume: TailoredResumeData) => {
    setOnePageResume(resume);
    setCurrentView(AppView.RESULT);
  };

  const handleBackFromOnePageBuilder = () => {
    setCurrentView(AppView.RESULT);
  };

  // Create a modified result with edited resume for ResultView
  const resultForDisplay = useMemo(() => {
    if (!result) return null;
    if (!editedResume) return result;
    return {
      ...result,
      resume: editedResume
    };
  }, [result, editedResume]);

  return (
    <div className="min-h-screen bg-bg flex flex-col items-center py-8 px-4">
      <Header showReset={currentView !== AppView.WELCOME && currentView !== AppView.ABOUT} onReset={reset} onAbout={handleAbout} />

      {currentView === AppView.WELCOME && (
        <WelcomeView onSelectMode={handleSelectMode} />
      )}

      {currentView === AppView.BUILDER && (
        <ResumeBuilder
          initialData={builtResume}
          resumeStyle={resumeStyle}
          setResumeStyle={setResumeStyle}
          onContinue={handleBuilderContinue}
          onBack={handleBackToWelcome}
        />
      )}

      {currentView === AppView.ONE_PAGE_BUILDER && onePageResume && (
        <ResumeBuilder
          initialData={onePageResume}
          resumeStyle={resumeStyle}
          setResumeStyle={setResumeStyle}
          onContinue={handleOnePageBuilderContinue}
          onBack={handleBackFromOnePageBuilder}
          builderMode="onePage"
          storageKeyOverride="forapply_onepage_builder_data"
        />
      )}

      {currentView === AppView.INPUT && (
        <InputView
          file={file}
          jobDesc={jobDesc}
          company={company}
          mode={mode}
          resumeStyle={resumeStyle}
          isProcessing={isProcessing}
          error={error}
          onFileChange={handleFileChange}
          setJobDesc={setJobDesc}
          setCompany={setCompany}
          setMode={setMode}
          setResumeStyle={setResumeStyle}
          handleGenerate={handleGenerate}
          entryMode={entryMode}
          builtResume={builtResume}
          onBackToBuilder={handleBackToBuilder}
          onBackToWelcome={handleBackToWelcome}
        />
      )}

      {currentView === AppView.REVIEW && result && (
        <ReviewEditView
          result={result}
          jobDescription={jobDesc}
          resumeStyle={resumeStyle}
          onGenerateSuggestion={handleGenerateSuggestion}
          onGenerateEmploymentGapSuggestions={handleGenerateEmploymentGapSuggestions}
          onContinue={handleContinueFromReview}
          onEditResume={handleEditResume}
        />
      )}

      {currentView === AppView.RESULT && resultForDisplay && (
        <ResultView
          result={resultForDisplay}
          matchScore={matchScore}
          downloadResume={downloadResume}
          downloadCoverLetter={downloadCoverLetter}
          company={company}
          employmentGaps={employmentGaps}
          gapResolutions={gapResolutions}
          onConvertToOnePage={handleConvertToOnePage}
          onEditOnePage={handleEditOnePageResume}
          onePageResume={onePageResume}
          isConverting={isConverting}
          downloadOnePageResume={downloadOnePageResume}
        />
      )}

      {currentView === AppView.ABOUT && (
        <AboutView onBack={handleBackFromAbout} />
      )}

      <Footer />
    </div>
  );
};

const App: React.FC = () => {
  return (
    <AuthGate>
      {(user, profile, incrementDownloads) => (
        <ResumeTailor
          user={user}
          profile={profile}
          onDownload={incrementDownloads}
        />
      )}
    </AuthGate>
  );
};

export default App;
