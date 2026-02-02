import { TailorResponse, RewriteMode, TailoredResumeData, GapTargetSection, ResumeStyle, EmploymentGap, EmploymentGapSuggestion } from "../types";
import { supabase } from "../lib/supabase";

// Backend API URL - uses Vite proxy in development
const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

async function getAuthHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function tailorResume(
  originalResumeText: string,
  jobDescription: string,
  companyName: string,
  mode: RewriteMode,
  resumeStyle: ResumeStyle = ResumeStyle.CLASSIC
): Promise<TailorResponse> {
  const authHeaders = await getAuthHeaders();
  const response = await fetch(`${API_BASE_URL}/tailor`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders,
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
  const authHeaders = await getAuthHeaders();
  const response = await fetch(`${API_BASE_URL}/gap-suggestion`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders,
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

/**
 * Generate AI suggestions for addressing an employment gap
 */
export async function generateEmploymentGapSuggestions(
  gap: EmploymentGap,
  resume: TailoredResumeData,
  jobDescription: string
): Promise<EmploymentGapSuggestion[]> {
  const authHeaders = await getAuthHeaders();
  const response = await fetch(`${API_BASE_URL}/employment-gap-suggestion`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders,
    },
    body: JSON.stringify({
      gap,
      resume,
      jobDescription,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || 'Failed to generate gap suggestions. Please try again.');
  }

  const result = await response.json();
  return result.suggestions as EmploymentGapSuggestion[];
}

/**
 * Convert a tailored resume to a condensed 1-page version
 */
export async function convertToOnePage(
  resumeData: TailoredResumeData,
  jobDescription: string
): Promise<TailoredResumeData> {
  const authHeaders = await getAuthHeaders();
  const response = await fetch(`${API_BASE_URL}/convert-one-page`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders,
    },
    body: JSON.stringify({
      resumeData,
      jobDescription,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || 'Failed to convert to one page. Please try again.');
  }

  const result = await response.json();
  return result as TailoredResumeData;
}
