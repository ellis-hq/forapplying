import { TailorResponse, RewriteMode, TailoredResumeData, GapTargetSection, ResumeStyle } from "../types";

// Backend API URL - uses Vite proxy in development
const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

export async function tailorResume(
  originalResumeText: string,
  jobDescription: string,
  companyName: string,
  mode: RewriteMode,
  resumeStyle: ResumeStyle = ResumeStyle.CLASSIC
): Promise<TailorResponse> {
  const response = await fetch(`${API_BASE_URL}/tailor`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      resumeText: originalResumeText,
      jobDescription,
      companyName,
      mode,
      resumeStyle,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || 'Failed to tailor resume. Please try again.');
  }

  const result = await response.json();
  return result as TailorResponse;
}

/**
 * Generate a suggestion for a missing skill based on the user's resume context
 */
export async function generateGapSuggestion(
  skill: string,
  resume: TailoredResumeData,
  targetSection: GapTargetSection,
  jobDescription: string
): Promise<string> {
  const response = await fetch(`${API_BASE_URL}/gap-suggestion`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      skill,
      resume,
      targetSection,
      jobDescription,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || 'Failed to generate suggestion. Please try again.');
  }

  const result = await response.json();
  return result.suggestion;
}
