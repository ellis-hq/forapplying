export interface ResumeExperience {
  company: string;
  role: string;
  location: string;
  dateRange: string;
  bullets: string[];
}

export interface ResumeEducation {
  school: string;
  degree: string;
  dateRange: string;
  location: string;
}

export interface TailoredResumeData {
  contact: {
    name: string;
    email: string;
    phone: string;
    location: string;
    linkedin?: string;
  };
  summary: string;
  skills: {
    tools: string[];
    core: string[];
  };
  experience: ResumeExperience[];
  education: ResumeEducation[];
}

export interface Keyword {
  term: string;
  type: 'must-have' | 'nice-to-have';
  category: string;
  foundIn: string[];
}

export interface KeywordReport {
  keywords: Keyword[];
  gaps: string[];
}

export interface TailorResponse {
  resume: TailoredResumeData;
  coverLetter: string;
  report: KeywordReport;
}

export enum RewriteMode {
  CONSERVATIVE = 'conservative',
  AGGRESSIVE = 'aggressive'
}

// Resume style/template options
export enum ResumeStyle {
  CLASSIC = 'classic',
  HYBRID = 'hybrid',
  TECHNICAL = 'technical'
}

// Resume style metadata
export interface ResumeStyleInfo {
  id: ResumeStyle;
  name: string;
  bestFor: string;
  sectionOrder: string[];
  description: string;
}

export const RESUME_STYLES: ResumeStyleInfo[] = [
  {
    id: ResumeStyle.CLASSIC,
    name: 'Classic (Reverse-Chronological)',
    bestFor: 'Steady work history, corporate roles',
    sectionOrder: ['header', 'summary', 'experience', 'education', 'skills'],
    description: 'Traditional format emphasizing career progression. Best for most candidates.'
  },
  {
    id: ResumeStyle.HYBRID,
    name: 'Hybrid (Skills-Forward)',
    bestFor: 'Career switchers, mixed experience',
    sectionOrder: ['header', 'summary', 'skills', 'experience', 'education'],
    description: 'Leads with your strengths and transferable skills. Great for career changers.'
  },
  {
    id: ResumeStyle.TECHNICAL,
    name: 'Technical/Early-Career (Education-Forward)',
    bestFor: 'Students, recent grads, technical roles',
    sectionOrder: ['header', 'summary', 'education', 'skills', 'experience'],
    description: 'Highlights education and projects first. Ideal for students or those with limited work history.'
  }
];

// View states for the application flow
export enum AppView {
  INPUT = 'input',
  REVIEW = 'review',
  RESULT = 'result'
}

// Target section for adding gap suggestions
export type GapTargetSection = 'skills' | 'experience' | 'summary';

// State for each gap being addressed
export interface GapState {
  skill: string;
  status: 'pending' | 'suggesting' | 'editing' | 'accepted' | 'skipped';
  suggestion?: string;
  manualText?: string;
  targetSection?: GapTargetSection;
  targetExperienceIndex?: number; // Which experience entry to add to (if section is 'experience')
}

// Editable resume data extends the base with a job title and style
export interface EditableResumeData extends TailoredResumeData {
  jobTitle?: string;
  resumeStyle?: ResumeStyle;
}
