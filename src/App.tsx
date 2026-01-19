import React, { useState, useMemo, useCallback } from 'react';
import { extractTextFromPDF, generateATSPDF, generateCoverLetterPDF } from './services/pdfService';
import { tailorResume as tailorResumeAPI, generateGapSuggestion } from './services/claudeService';
import { TailorResponse, RewriteMode, AppView, EditableResumeData, GapTargetSection, ResumeStyle } from './types';
import Header from './components/Header';
import Footer from './components/Footer';
import InputView from './components/InputView';
import ResultView from './components/ResultView';
import ReviewEditView from './components/ReviewEditView';

const App: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [jobDesc, setJobDesc] = useState('');
  const [company, setCompany] = useState('');
  const [mode, setMode] = useState<RewriteMode>(RewriteMode.CONSERVATIVE);
  const [resumeStyle, setResumeStyle] = useState<ResumeStyle>(ResumeStyle.CLASSIC);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<TailorResponse | null>(null);
  const [currentView, setCurrentView] = useState<AppView>(AppView.INPUT);
  const [editedResume, setEditedResume] = useState<EditableResumeData | null>(null);

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

  const handleGenerate = async () => {
    if (!file || !jobDesc.trim() || !company.trim()) {
      setError('Please provide all inputs: Resume PDF, Job Description, and Company Name.');
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      const resumeText = await extractTextFromPDF(file);
      if (!resumeText.trim()) {
        throw new Error('Could not extract text from the PDF. It might be an image-only scan.');
      }

      const tailoringResult = await tailorResumeAPI(resumeText, jobDesc, company, mode, resumeStyle);
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

  const downloadResume = () => {
    if (!result) return;
    // Use edited resume if available, otherwise use original
    const resumeToDownload = editedResume || result.resume;
    const doc = generateATSPDF(resumeToDownload);
    doc.save(`${resumeToDownload.contact.name.replace(/\s+/g, '_')}_Resume_${company.replace(/\s+/g, '_')}.pdf`);
  };

  const downloadCoverLetter = () => {
    if (!result) return;
    const doc = generateCoverLetterPDF(result.coverLetter, result.resume.contact);
    doc.save(`Cover_Letter_${company.replace(/\s+/g, '_')}.pdf`);
  };

  const reset = () => {
    setResult(null);
    setFile(null);
    setJobDesc('');
    setCompany('');
    setError(null);
    setMode(RewriteMode.CONSERVATIVE);
    setResumeStyle(ResumeStyle.CLASSIC);
    setCurrentView(AppView.INPUT);
    setEditedResume(null);
  };

  // Handler for generating gap suggestions via Claude API
  const handleGenerateSuggestion = useCallback(async (skill: string, targetSection: GapTargetSection): Promise<string> => {
    if (!result) throw new Error('No resume data available');
    return generateGapSuggestion(skill, result.resume, targetSection, jobDesc);
  }, [result, jobDesc]);

  // Handler for continuing from review to result view
  const handleContinueFromReview = useCallback((edited: EditableResumeData) => {
    setEditedResume(edited);
    setCurrentView(AppView.RESULT);
  }, []);

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
      <Header showReset={currentView !== AppView.INPUT} onReset={reset} />

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
        />
      )}

      {currentView === AppView.REVIEW && result && (
        <ReviewEditView
          result={result}
          jobDescription={jobDesc}
          resumeStyle={resumeStyle}
          onGenerateSuggestion={handleGenerateSuggestion}
          onContinue={handleContinueFromReview}
        />
      )}

      {currentView === AppView.RESULT && resultForDisplay && (
        <ResultView
          result={resultForDisplay}
          matchScore={matchScore}
          downloadResume={downloadResume}
          downloadCoverLetter={downloadCoverLetter}
          company={company}
        />
      )}

      <Footer />
    </div>
  );
};

export default App;
