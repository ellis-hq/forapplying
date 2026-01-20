export interface ResumeExperience {
  company: string;
  role: string;
  location: string;
  dateRange: string;
  startMonth?: string;
  startYear?: string;
  endMonth?: string;
  endYear?: string;
  isCurrentRole?: boolean;
  bullets: string[];
}

export interface ResumeEducation {
  school: string;
  degree: string;
  fieldOfStudy?: string;
  dateRange: string;
  startMonth?: string;
  startYear?: string;
  endMonth?: string;
  endYear?: string;
  isInProgress?: boolean;
  location: string;
}

export interface ResumeProject {
  name: string;
  dateRange: string;
  description: string;
  technologies: string;
}

export interface ResumeCertification {
  name: string;
  issuer: string;
  dateObtained: string;
  expirationDate?: string;
  noExpiration?: boolean;
}

export interface ClinicalHoursEntry {
  siteName: string;
  role: string;
  hoursCompleted: number;
  startMonth?: string;
  startYear?: string;
  endMonth?: string;
  endYear?: string;
  description?: string;
}

export interface VolunteerEntry {
  organization: string;
  role: string;
  dateRange: string;
  description: string;
}

export interface PublicationEntry {
  title: string;
  publication: string;
  date: string;
  url?: string;
}

export interface AwardEntry {
  title: string;
  issuer: string;
  date: string;
  description?: string;
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
  objective?: string;
  includeObjective?: boolean;
  skills: {
    tools: string[];
    core: string[];
  };
  experience: ResumeExperience[];
  education: ResumeEducation[];
  // Optional sections
  projects?: ResumeProject[];
  includeProjects?: boolean;
  certifications?: ResumeCertification[];
  includeCertifications?: boolean;
  clinicalHours?: ClinicalHoursEntry[];
  includeClinicalHours?: boolean;
  volunteer?: VolunteerEntry[];
  includeVolunteer?: boolean;
  publications?: PublicationEntry[];
  includePublications?: boolean;
  languages?: string[];
  includeLanguages?: boolean;
  awards?: AwardEntry[];
  includeAwards?: boolean;
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
  WELCOME = 'welcome',
  INPUT = 'input',
  BUILDER = 'builder',
  REVIEW = 'review',
  RESULT = 'result'
}

// Entry mode for how user is creating their resume
export enum ResumeEntryMode {
  UPLOAD = 'upload',
  BUILD = 'build'
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
  addedContent?: string; // Track what was added so we can remove it on undo
}

// Editable resume data extends the base with a job title and style
export interface EditableResumeData extends TailoredResumeData {
  jobTitle?: string;
  resumeStyle?: ResumeStyle;
}

// Employment Gap Detection Types
export interface EmploymentGap {
  id: string;
  startDate: { month: number; year: number; };
  endDate: { month: number; year: number; };
  durationMonths: number;
  previousJob: { company: string; role: string; endDate: string; };
  nextJob: { company: string; role: string; startDate: string; };
  isOldGap: boolean;  // 10+ years ago
  isCoveredByEducation: boolean;
  educationCoverage?: { school: string; degree: string; };
}

export type EmploymentGapResolutionStatus = 'pending' | 'suggesting' | 'resolved' | 'dismissed';
export type EmploymentGapResolutionType = 'project' | 'freelance' | 'education' | 'volunteer' | 'dismissed';

export interface EmploymentGapResolutionState {
  gapId: string;
  status: EmploymentGapResolutionStatus;
  resolutionType?: EmploymentGapResolutionType;
  aiSuggestions?: Array<{ type: string; title: string; description: string; }>;
  addedData?: ResumeProject | ResumeExperience | ResumeEducation | VolunteerEntry; // Track what was added for undo
}

export interface EmploymentGapSuggestion {
  type: EmploymentGapResolutionType;
  title: string;
  description: string;
}
