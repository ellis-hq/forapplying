import React, { useState, useEffect, useCallback } from 'react';
import {
  User,
  Mail,
  Phone,
  MapPin,
  Linkedin,
  Briefcase,
  GraduationCap,
  Wrench,
  FolderOpen,
  Award,
  Clock,
  Heart,
  BookOpen,
  Globe,
  Trophy,
  Plus,
  Trash2,
  ChevronUp,
  ChevronDown,
  ChevronRight,
  X,
  RotateCcw,
  Eye,
  EyeOff,
  AlertCircle,
  Target,
  FileText
} from 'lucide-react';
import {
  TailoredResumeData,
  ResumeExperience,
  ResumeEducation,
  ResumeProject,
  ResumeCertification,
  ClinicalHoursEntry,
  VolunteerEntry,
  PublicationEntry,
  AwardEntry,
  ResumeStyle,
  RESUME_STYLES
} from '../types';

interface ResumeBuilderProps {
  initialData?: TailoredResumeData | null;
  resumeStyle: ResumeStyle;
  setResumeStyle: (style: ResumeStyle) => void;
  onContinue: (resume: TailoredResumeData) => void;
  onBack: () => void;
  builderMode?: 'full' | 'onePage';
  storageKeyOverride?: string;
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const YEARS = Array.from({ length: 50 }, (_, i) => (new Date().getFullYear() - i).toString());
const MAX_CERT_NAME_LENGTH = 47;

const STORAGE_KEY = 'forapply_resume_builder_data';

const MONTH_ABBREVS: Record<string, string> = {
  'jan': 'January', 'feb': 'February', 'mar': 'March', 'apr': 'April',
  'may': 'May', 'jun': 'June', 'jul': 'July', 'aug': 'August',
  'sep': 'September', 'sept': 'September', 'oct': 'October', 'nov': 'November', 'dec': 'December'
};

function resolveMonth(input: string): string {
  if (!input) return '';
  const normalized = input.toLowerCase().replace(/[^a-z]/g, '');
  const full = MONTHS.find(m => m.toLowerCase() === normalized);
  if (full) return full;
  return MONTH_ABBREVS[normalized] || '';
}

function isSingleDateToken(value: string): boolean {
  const s = value.trim();
  if (!s) return true;
  return (
    /^\d{4}-\d{1,2}$/.test(s) || // YYYY-MM
    /^\d{1,2}\/\d{4}$/.test(s) || // MM/YYYY
    /^\d{1,2}\/\d{2}$/.test(s) || // MM/YY
    /^\d{1,2}-\d{4}$/.test(s) || // MM-YYYY
    /^\d{1,2}\.\d{4}$/.test(s) || // MM.YYYY
    /^\d{4}\/\d{1,2}$/.test(s) || // YYYY/MM
    /^\d{4}\.\d{1,2}$/.test(s) || // YYYY.MM
    /^\d{4}$/.test(s) || // YYYY
    /^[A-Za-z]+\.?\s+\d{4}$/.test(s) // Month YYYY / Mon YYYY / Sept. YYYY
  );
}

// Helper to parse a dateRange string back into month/year components
function parseDateRange(dateRange?: string): {
  startMonth: string; startYear: string; endMonth: string; endYear: string; isCurrent: boolean;
} {
  const result = { startMonth: '', startYear: '', endMonth: '', endYear: '', isCurrent: false };
  if (!dateRange) return result;

  const trimmed = dateRange.trim();
  let startPart = trimmed;
  let endPart = '';

  if (!isSingleDateToken(trimmed)) {
    const rangeMatch = trimmed.match(/^(.+?)\s*[–—-]\s*(.+)$/);
    if (rangeMatch) {
      startPart = rangeMatch[1].trim();
      endPart = rangeMatch[2].trim();
    } else {
      const toMatch = trimmed.match(/^(.+?)\s+(?:to|through|until)\s+(.+)$/i);
      if (toMatch) {
        startPart = toMatch[1].trim();
        endPart = toMatch[2].trim();
      }
    }
  }

  const parseDate = (s: string): { month: string; year: string } => {
    if (!s) return { month: '', year: '' };
    // Try "Month Year" or "Mon Year" (e.g., "January 2020" or "Jan 2020")
    const monthYearMatch = s.match(/^([A-Za-z]+)\.?\s*[-/ ]?\s*(\d{4})$/);
    if (monthYearMatch) {
      return { month: resolveMonth(monthYearMatch[1]), year: monthYearMatch[2] };
    }
    // Try "MM/YYYY" format (e.g., "02/2020")
    const slashMatch = s.match(/^(\d{1,2})\/(\d{4})$/);
    if (slashMatch) {
      const monthIdx = parseInt(slashMatch[1], 10) - 1;
      return { month: MONTHS[monthIdx] || '', year: slashMatch[2] };
    }
    // Try "MM/YY" format (e.g., "02/20")
    const slashShortYearMatch = s.match(/^(\d{1,2})\/(\d{2})$/);
    if (slashShortYearMatch) {
      const monthIdx = parseInt(slashShortYearMatch[1], 10) - 1;
      const yearNum = parseInt(slashShortYearMatch[2], 10);
      const year = Number.isNaN(yearNum) ? '' : (yearNum >= 70 ? `19${slashShortYearMatch[2]}` : `20${slashShortYearMatch[2]}`);
      return { month: MONTHS[monthIdx] || '', year };
    }
    // Try "MM-YYYY" or "MM.YYYY"
    const dashMatch = s.match(/^(\d{1,2})-(\d{4})$/);
    if (dashMatch) {
      const monthIdx = parseInt(dashMatch[1], 10) - 1;
      return { month: MONTHS[monthIdx] || '', year: dashMatch[2] };
    }
    const dotMatch = s.match(/^(\d{1,2})\.(\d{4})$/);
    if (dotMatch) {
      const monthIdx = parseInt(dotMatch[1], 10) - 1;
      return { month: MONTHS[monthIdx] || '', year: dotMatch[2] };
    }
    const spaceMatch = s.match(/^(\d{1,2})\s+(\d{4})$/);
    if (spaceMatch) {
      const monthIdx = parseInt(spaceMatch[1], 10) - 1;
      return { month: MONTHS[monthIdx] || '', year: spaceMatch[2] };
    }
    // Try "YYYY-MM" format (e.g., "2019-05")
    const isoMatch = s.match(/^(\d{4})-(\d{1,2})$/);
    if (isoMatch) {
      const monthIdx = parseInt(isoMatch[2], 10) - 1;
      return { month: MONTHS[monthIdx] || '', year: isoMatch[1] };
    }
    // Try "YYYY/MM" or "YYYY.MM" format (e.g., "2019/05")
    const isoSlashMatch = s.match(/^(\d{4})\/(\d{1,2})$/);
    if (isoSlashMatch) {
      const monthIdx = parseInt(isoSlashMatch[2], 10) - 1;
      return { month: MONTHS[monthIdx] || '', year: isoSlashMatch[1] };
    }
    const isoDotMatch = s.match(/^(\d{4})\.(\d{1,2})$/);
    if (isoDotMatch) {
      const monthIdx = parseInt(isoDotMatch[2], 10) - 1;
      return { month: MONTHS[monthIdx] || '', year: isoDotMatch[1] };
    }
    const isoSpaceMatch = s.match(/^(\d{4})\s+(\d{1,2})$/);
    if (isoSpaceMatch) {
      const monthIdx = parseInt(isoSpaceMatch[2], 10) - 1;
      return { month: MONTHS[monthIdx] || '', year: isoSpaceMatch[1] };
    }
    // Try year only (e.g., "2020")
    const yearMatch = s.match(/^(\d{4})$/);
    if (yearMatch) {
      return { month: '', year: yearMatch[1] };
    }
    return { month: '', year: '' };
  };

  const start = parseDate(startPart);
  result.startMonth = start.month;
  result.startYear = start.year;

  if (/present|current/i.test(endPart)) {
    result.isCurrent = true;
  } else {
    const end = parseDate(endPart);
    result.endMonth = end.month;
    result.endYear = end.year;
  }

  return result;
}

// Helper to hydrate date fields on experience/education entries loaded from initialData
function hydrateInitialData(data: TailoredResumeData): TailoredResumeData {
  return {
    ...data,
    experience: (data.experience || []).map(exp => {
      const parsed = parseDateRange(exp.dateRange);
      const startMonth = exp.startMonth || parsed.startMonth;
      const startYear = exp.startYear || parsed.startYear;
      const endMonth = exp.endMonth || parsed.endMonth;
      const endYear = exp.endYear || parsed.endYear;
      const isCurrentRole = exp.isCurrentRole ?? parsed.isCurrent;
      return {
        ...exp,
        startMonth,
        startYear,
        endMonth,
        endYear,
        isCurrentRole,
        // Reformat dateRange to match user's preferred format
        dateRange: (startMonth && startYear)
          ? formatDateRange(startMonth, startYear, endMonth, endYear, isCurrentRole)
          : exp.dateRange,
      };
    }),
    education: (data.education || []).map(edu => {
      const parsed = parseDateRange(edu.dateRange);
      const startMonth = edu.startMonth || parsed.startMonth;
      const startYear = edu.startYear || parsed.startYear;
      const endMonth = edu.endMonth || parsed.endMonth;
      const endYear = edu.endYear || parsed.endYear;
      const isInProgress = edu.isInProgress ?? parsed.isCurrent;
      return {
        ...edu,
        startMonth,
        startYear,
        endMonth,
        endYear,
        isInProgress,
        dateRange: (startMonth && startYear)
          ? formatDateRange(startMonth, startYear, endMonth, endYear, isInProgress)
          : edu.dateRange,
      };
    }),
    certifications: (data.certifications || []).map(cert => ({
      ...cert,
      name: cert.name ? cert.name.slice(0, MAX_CERT_NAME_LENGTH) : ''
    })),
  };
}

// Helper to create date range string from month/year (always uses "Month Year" format)
function formatDateRange(
  startMonth?: string,
  startYear?: string,
  endMonth?: string,
  endYear?: string,
  isCurrent?: boolean
): string {
  const start = startMonth && startYear ? `${startMonth} ${startYear}` : startYear || '';
  const end = isCurrent ? 'Present' : (endMonth && endYear ? `${endMonth} ${endYear}` : endYear || '');
  return start && end ? `${start} – ${end}` : start || end;
}

function getDisplayDateRange(
  dateRange: string | undefined,
  startMonth?: string,
  startYear?: string,
  endMonth?: string,
  endYear?: string,
  isCurrent?: boolean
): string {
  if (startMonth || startYear || endMonth || endYear || isCurrent) {
    return formatDateRange(startMonth, startYear, endMonth, endYear, isCurrent);
  }
  if (!dateRange) return '';
  const parsed = parseDateRange(dateRange);
  if (!parsed.startMonth && !parsed.startYear && !parsed.endMonth && !parsed.endYear && !parsed.isCurrent) {
    return dateRange;
  }
  return formatDateRange(parsed.startMonth, parsed.startYear, parsed.endMonth, parsed.endYear, parsed.isCurrent);
}

// Empty resume template
const createEmptyResume = (): TailoredResumeData => ({
  contact: {
    name: '',
    email: '',
    phone: '',
    location: '',
    linkedin: ''
  },
  summary: '',
  objective: '',
  includeObjective: false,
  skills: {
    tools: [],
    core: []
  },
  experience: [],
  education: [],
  projects: [],
  includeProjects: false,
  certifications: [],
  includeCertifications: false,
  clinicalHours: [],
  includeClinicalHours: false,
  volunteer: [],
  includeVolunteer: false,
  publications: [],
  includePublications: false,
  languages: [],
  includeLanguages: false,
  awards: [],
  includeAwards: false
});

const ResumeBuilder: React.FC<ResumeBuilderProps> = ({
  initialData,
  resumeStyle,
  setResumeStyle,
  onContinue,
  onBack,
  builderMode = 'full',
  storageKeyOverride
}) => {
  const storageKey = storageKeyOverride || STORAGE_KEY;
  const isOnePageMode = builderMode === 'onePage';
  // Load from localStorage or use initial data
  if (import.meta.env.DEV) {
    console.log('[DATE-DEBUG] ResumeBuilder mount, initialData:', initialData ? { expCount: initialData.experience?.length, exp0: initialData.experience?.[0] ? { dateRange: initialData.experience[0].dateRange, startMonth: initialData.experience[0].startMonth, startYear: initialData.experience[0].startYear } : 'none' } : 'null');
  }
  const [resume, setResume] = useState<TailoredResumeData>(() => {
    if (initialData) return hydrateInitialData({ ...createEmptyResume(), ...initialData });
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      try {
        return hydrateInitialData({ ...createEmptyResume(), ...JSON.parse(saved) });
      } catch {
        return createEmptyResume();
      }
    }
    return createEmptyResume();
  });

  const [showPreview, setShowPreview] = useState(true);
  const [skillInput, setSkillInput] = useState({ core: '', tools: '' });
  const [languageInput, setLanguageInput] = useState('');

  // Hydrate date fields from dateRange if they're missing (e.g., when editing a tailored resume)
  useEffect(() => {
    if (!initialData) return;
    // Force hydrate: replace resume state with fully hydrated version of initialData
    const hydrated = hydrateInitialData({ ...createEmptyResume(), ...initialData });
    setResume(hydrated);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialData]);

  // Auto-save to localStorage
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      localStorage.setItem(storageKey, JSON.stringify(resume));
    }, 500);
    return () => clearTimeout(timeoutId);
  }, [resume, storageKey]);

  // Update functions
  const updateContact = useCallback((field: keyof TailoredResumeData['contact'], value: string) => {
    setResume(prev => ({
      ...prev,
      contact: { ...prev.contact, [field]: value }
    }));
  }, []);

  const updateField = useCallback(<K extends keyof TailoredResumeData>(field: K, value: TailoredResumeData[K]) => {
    setResume(prev => ({ ...prev, [field]: value }));
  }, []);

  // Experience functions
  const addExperience = () => {
    const newExp: ResumeExperience = {
      company: '',
      role: '',
      location: '',
      dateRange: '',
      startMonth: '',
      startYear: '',
      endMonth: '',
      endYear: '',
      isCurrentRole: false,
      bullets: ['']
    };
    setResume(prev => ({ ...prev, experience: [...prev.experience, newExp] }));
  };

  const updateExperience = (index: number, field: keyof ResumeExperience, value: ResumeExperience[keyof ResumeExperience]) => {
    setResume(prev => ({
      ...prev,
      experience: prev.experience.map((exp, i) => {
        if (i !== index) return exp;
        const updated = { ...exp, [field]: value };
        // Auto-update dateRange when dates change
        if (['startMonth', 'startYear', 'endMonth', 'endYear', 'isCurrentRole'].includes(field)) {
          updated.dateRange = formatDateRange(
            updated.startMonth,
            updated.startYear,
            updated.endMonth,
            updated.endYear,
            updated.isCurrentRole
          );
        }
        return updated;
      })
    }));
  };

  const removeExperience = (index: number) => {
    if (confirm('Are you sure you want to remove this experience entry?')) {
      setResume(prev => ({
        ...prev,
        experience: prev.experience.filter((_, i) => i !== index)
      }));
    }
  };

  const moveExperience = (index: number, direction: 'up' | 'down') => {
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= resume.experience.length) return;
    setResume(prev => {
      const newExp = [...prev.experience];
      [newExp[index], newExp[newIndex]] = [newExp[newIndex], newExp[index]];
      return { ...prev, experience: newExp };
    });
  };

  const updateBullet = (expIndex: number, bulletIndex: number, value: string) => {
    setResume(prev => ({
      ...prev,
      experience: prev.experience.map((exp, i) =>
        i === expIndex
          ? { ...exp, bullets: exp.bullets.map((b, j) => (j === bulletIndex ? value : b)) }
          : exp
      )
    }));
  };

  const addBullet = (expIndex: number) => {
    setResume(prev => ({
      ...prev,
      experience: prev.experience.map((exp, i) =>
        i === expIndex ? { ...exp, bullets: [...exp.bullets, ''] } : exp
      )
    }));
  };

  const removeBullet = (expIndex: number, bulletIndex: number) => {
    setResume(prev => ({
      ...prev,
      experience: prev.experience.map((exp, i) =>
        i === expIndex
          ? { ...exp, bullets: exp.bullets.filter((_, j) => j !== bulletIndex) }
          : exp
      )
    }));
  };

  // Education functions
  const addEducation = () => {
    const newEdu: ResumeEducation = {
      school: '',
      degree: '',
      fieldOfStudy: '',
      dateRange: '',
      startMonth: '',
      startYear: '',
      endMonth: '',
      endYear: '',
      isInProgress: false,
      location: ''
    };
    setResume(prev => ({ ...prev, education: [...prev.education, newEdu] }));
  };

  const updateEducation = (index: number, field: keyof ResumeEducation, value: ResumeEducation[keyof ResumeEducation]) => {
    setResume(prev => ({
      ...prev,
      education: prev.education.map((edu, i) => {
        if (i !== index) return edu;
        const updated = { ...edu, [field]: value };
        if (['startMonth', 'startYear', 'endMonth', 'endYear', 'isInProgress'].includes(field)) {
          updated.dateRange = formatDateRange(
            updated.startMonth,
            updated.startYear,
            updated.endMonth,
            updated.endYear,
            updated.isInProgress
          );
        }
        return updated;
      })
    }));
  };

  const removeEducation = (index: number) => {
    if (confirm('Are you sure you want to remove this education entry?')) {
      setResume(prev => ({
        ...prev,
        education: prev.education.filter((_, i) => i !== index)
      }));
    }
  };

  // Skills functions
  const addSkill = (type: 'core' | 'tools', value: string) => {
    if (!value.trim()) return;
    setResume(prev => ({
      ...prev,
      skills: {
        ...prev.skills,
        [type]: [...prev.skills[type], value.trim()]
      }
    }));
    setSkillInput(prev => ({ ...prev, [type]: '' }));
  };

  const removeSkill = (type: 'core' | 'tools', index: number) => {
    setResume(prev => ({
      ...prev,
      skills: {
        ...prev.skills,
        [type]: prev.skills[type].filter((_, i) => i !== index)
      }
    }));
  };

  // Project functions
  const addProject = () => {
    const newProject: ResumeProject = {
      name: '',
      dateRange: '',
      description: '',
      technologies: ''
    };
    setResume(prev => ({
      ...prev,
      projects: [...(prev.projects || []), newProject],
      includeProjects: true
    }));
  };

  const updateProject = (index: number, field: keyof ResumeProject, value: string) => {
    setResume(prev => ({
      ...prev,
      projects: (prev.projects || []).map((p, i) =>
        i === index ? { ...p, [field]: value } : p
      )
    }));
  };

  const removeProject = (index: number) => {
    if (confirm('Are you sure you want to remove this project?')) {
      setResume(prev => ({
        ...prev,
        projects: (prev.projects || []).filter((_, i) => i !== index)
      }));
    }
  };

  // Certification functions
  const addCertification = () => {
    const newCert: ResumeCertification = {
      name: '',
      issuer: '',
      dateObtained: '',
      expirationDate: '',
      noExpiration: false
    };
    setResume(prev => ({
      ...prev,
      certifications: [...(prev.certifications || []), newCert],
      includeCertifications: true
    }));
  };

  const updateCertification = (index: number, field: keyof ResumeCertification, value: ResumeCertification[keyof ResumeCertification]) => {
    const nextValue = field === 'name' && typeof value === 'string'
      ? value.slice(0, MAX_CERT_NAME_LENGTH)
      : value;
    setResume(prev => ({
      ...prev,
      certifications: (prev.certifications || []).map((c, i) =>
        i === index ? { ...c, [field]: nextValue } : c
      )
    }));
  };

  const removeCertification = (index: number) => {
    if (confirm('Are you sure you want to remove this certification?')) {
      setResume(prev => ({
        ...prev,
        certifications: (prev.certifications || []).filter((_, i) => i !== index)
      }));
    }
  };

  // Clinical Hours functions
  const addClinicalHours = () => {
    const newEntry: ClinicalHoursEntry = {
      siteName: '',
      role: '',
      hoursCompleted: 0,
      startMonth: '',
      startYear: '',
      endMonth: '',
      endYear: '',
      description: ''
    };
    setResume(prev => ({
      ...prev,
      clinicalHours: [...(prev.clinicalHours || []), newEntry],
      includeClinicalHours: true
    }));
  };

  const updateClinicalHours = (index: number, field: keyof ClinicalHoursEntry, value: ClinicalHoursEntry[keyof ClinicalHoursEntry]) => {
    setResume(prev => ({
      ...prev,
      clinicalHours: (prev.clinicalHours || []).map((c, i) =>
        i === index ? { ...c, [field]: value } : c
      )
    }));
  };

  const removeClinicalHours = (index: number) => {
    if (confirm('Are you sure you want to remove this entry?')) {
      setResume(prev => ({
        ...prev,
        clinicalHours: (prev.clinicalHours || []).filter((_, i) => i !== index)
      }));
    }
  };

  // Volunteer functions
  const addVolunteer = () => {
    const newEntry: VolunteerEntry = {
      organization: '',
      role: '',
      dateRange: '',
      description: ''
    };
    setResume(prev => ({
      ...prev,
      volunteer: [...(prev.volunteer || []), newEntry],
      includeVolunteer: true
    }));
  };

  const updateVolunteer = (index: number, field: keyof VolunteerEntry, value: string) => {
    setResume(prev => ({
      ...prev,
      volunteer: (prev.volunteer || []).map((v, i) =>
        i === index ? { ...v, [field]: value } : v
      )
    }));
  };

  const removeVolunteer = (index: number) => {
    if (confirm('Are you sure you want to remove this entry?')) {
      setResume(prev => ({
        ...prev,
        volunteer: (prev.volunteer || []).filter((_, i) => i !== index)
      }));
    }
  };

  // Publication functions
  const addPublication = () => {
    const newEntry: PublicationEntry = {
      title: '',
      publication: '',
      date: '',
      url: ''
    };
    setResume(prev => ({
      ...prev,
      publications: [...(prev.publications || []), newEntry],
      includePublications: true
    }));
  };

  const updatePublication = (index: number, field: keyof PublicationEntry, value: string) => {
    setResume(prev => ({
      ...prev,
      publications: (prev.publications || []).map((p, i) =>
        i === index ? { ...p, [field]: value } : p
      )
    }));
  };

  const removePublication = (index: number) => {
    if (confirm('Are you sure you want to remove this publication?')) {
      setResume(prev => ({
        ...prev,
        publications: (prev.publications || []).filter((_, i) => i !== index)
      }));
    }
  };

  // Award functions
  const addAward = () => {
    const newEntry: AwardEntry = {
      title: '',
      issuer: '',
      date: '',
      description: ''
    };
    setResume(prev => ({
      ...prev,
      awards: [...(prev.awards || []), newEntry],
      includeAwards: true
    }));
  };

  const updateAward = (index: number, field: keyof AwardEntry, value: string) => {
    setResume(prev => ({
      ...prev,
      awards: (prev.awards || []).map((a, i) =>
        i === index ? { ...a, [field]: value } : a
      )
    }));
  };

  const removeAward = (index: number) => {
    if (confirm('Are you sure you want to remove this award?')) {
      setResume(prev => ({
        ...prev,
        awards: (prev.awards || []).filter((_, i) => i !== index)
      }));
    }
  };

  // Language functions
  const addLanguage = (value: string) => {
    if (!value.trim()) return;
    setResume(prev => ({
      ...prev,
      languages: [...(prev.languages || []), value.trim()],
      includeLanguages: true
    }));
    setLanguageInput('');
  };

  const removeLanguage = (index: number) => {
    setResume(prev => ({
      ...prev,
      languages: (prev.languages || []).filter((_, i) => i !== index)
    }));
  };

  // Clear and start over
  const handleClearAll = () => {
    if (confirm('Are you sure you want to clear all data and start over? This cannot be undone.')) {
      localStorage.removeItem(storageKey);
      setResume(createEmptyResume());
    }
  };

  // Validate before continuing
  const handleContinue = () => {
    if (!resume.contact.name.trim()) {
      alert('Please enter your name.');
      return;
    }
    if (!resume.contact.email.trim()) {
      alert('Please enter your email.');
      return;
    }
    onContinue(resume);
  };

  return (
    <div className="max-w-7xl w-full animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-text-primary">
            {isOnePageMode ? 'One-Page Resume Builder' : 'Resume Builder'}
          </h1>
          <p className="text-sm text-text-muted">
            {isOnePageMode
              ? 'Edit your one-page version. Auto-saved separately.'
              : 'Fill in your information. Your progress is auto-saved.'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowPreview(!showPreview)}
            className="flex items-center gap-2 px-3 py-2 text-sm border border-border rounded-lg hover:bg-border-light transition-colors"
          >
            {showPreview ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            {showPreview ? 'Hide Preview' : 'Show Preview'}
          </button>
          <button
            onClick={handleClearAll}
            className="flex items-center gap-2 px-3 py-2 text-sm text-error border border-error-border rounded-lg hover:bg-error-light transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
            Clear & Start Over
          </button>
        </div>
      </div>

      <div className={`grid gap-6 ${showPreview ? 'lg:grid-cols-2' : 'grid-cols-1 max-w-3xl mx-auto'}`}>
        {/* Left Column - Form */}
        <div className="space-y-6 max-h-[80vh] overflow-y-auto custom-scrollbar pr-2">
          {/* Contact Information */}
          <section className="bg-surface p-6 rounded-2xl shadow-sm border border-border">
            <h2 className="text-sm font-bold text-text-primary mb-4 flex items-center gap-2">
              <User className="w-4 h-4 text-accent" />
              Contact Information
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">
                  Full Name <span className="text-error">*</span>
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-text-muted absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={resume.contact.name}
                    onChange={(e) => updateContact('name', e.target.value)}
                    placeholder="John Doe"
                    className="w-full pl-10 pr-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-accent focus:border-transparent"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">
                  Email <span className="text-error">*</span>
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-text-muted absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    value={resume.contact.email}
                    onChange={(e) => updateContact('email', e.target.value)}
                    placeholder="john@email.com"
                    className="w-full pl-10 pr-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-accent focus:border-transparent"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">Phone</label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-text-muted absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="tel"
                    value={resume.contact.phone}
                    onChange={(e) => updateContact('phone', e.target.value)}
                    placeholder="(555) 123-4567"
                    className="w-full pl-10 pr-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-accent focus:border-transparent"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">Location (City, State)</label>
                <div className="relative">
                  <MapPin className="w-4 h-4 text-text-muted absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={resume.contact.location}
                    onChange={(e) => updateContact('location', e.target.value)}
                    placeholder="San Francisco, CA"
                    className="w-full pl-10 pr-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-accent focus:border-transparent"
                  />
                </div>
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-medium text-text-secondary mb-1">LinkedIn URL (Optional)</label>
                <div className="relative">
                  <Linkedin className="w-4 h-4 text-text-muted absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="url"
                    value={resume.contact.linkedin || ''}
                    onChange={(e) => updateContact('linkedin', e.target.value)}
                    placeholder="linkedin.com/in/johndoe"
                    className="w-full pl-10 pr-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-accent focus:border-transparent"
                  />
                </div>
              </div>
            </div>
          </section>

          {/* Objective (Optional) */}
          <section className="bg-surface p-6 rounded-2xl shadow-sm border border-border">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold text-text-primary flex items-center gap-2">
                <Target className="w-4 h-4 text-accent" />
                Objective
              </h2>
              <label className="flex items-center gap-2 text-xs text-text-secondary cursor-pointer">
                <input
                  type="checkbox"
                  checked={resume.includeObjective}
                  onChange={(e) => updateField('includeObjective', e.target.checked)}
                  className="rounded border-border text-accent focus:ring-accent"
                />
                Include in resume
              </label>
            </div>
            {resume.includeObjective && (
              <>
                <p className="text-xs text-text-muted mb-3">
                  A brief statement about your career goals and what you're seeking.
                </p>
                <textarea
                  value={resume.objective || ''}
                  onChange={(e) => updateField('objective', e.target.value)}
                  placeholder="Seeking a challenging position where I can leverage my skills in..."
                  rows={3}
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-accent focus:border-transparent resize-none"
                />
              </>
            )}
          </section>

          {/* Professional Summary */}
          <section className="bg-surface p-6 rounded-2xl shadow-sm border border-border">
            <h2 className="text-sm font-bold text-text-primary mb-4 flex items-center gap-2">
              <FileText className="w-4 h-4 text-accent" />
              Professional Summary
            </h2>
            <textarea
              value={resume.summary}
              onChange={(e) => updateField('summary', e.target.value)}
              placeholder="A dynamic professional with X years of experience in..."
              rows={4}
              className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-accent focus:border-transparent resize-none"
            />
          </section>

          {/* Work Experience */}
          <section className="bg-surface p-6 rounded-2xl shadow-sm border border-border">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold text-text-primary flex items-center gap-2">
                <Briefcase className="w-4 h-4 text-accent" />
                Work Experience
              </h2>
              <button
                onClick={addExperience}
                className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-accent text-white rounded-lg hover:bg-accent-hover transition-colors"
              >
                <Plus className="w-3 h-3" /> Add Experience
              </button>
            </div>

            {resume.experience.length === 0 ? (
              <p className="text-sm text-text-muted text-center py-4">
                No work experience added yet. Click "Add Experience" to get started.
              </p>
            ) : (
              <div className="space-y-6">
                {resume.experience.map((exp, index) => (
                  <div key={index} className="p-4 bg-border-light rounded-xl">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-medium text-text-secondary">Experience {index + 1}</span>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => moveExperience(index, 'up')}
                          disabled={index === 0}
                          className="p-1 text-text-muted hover:text-text-primary disabled:opacity-30 transition-colors"
                        >
                          <ChevronUp className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => moveExperience(index, 'down')}
                          disabled={index === resume.experience.length - 1}
                          className="p-1 text-text-muted hover:text-text-primary disabled:opacity-30 transition-colors"
                        >
                          <ChevronDown className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => removeExperience(index)}
                          className="p-1 text-error hover:text-error-hover transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                      <input
                        type="text"
                        value={exp.role}
                        onChange={(e) => updateExperience(index, 'role', e.target.value)}
                        placeholder="Job Title"
                        className="px-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-accent focus:border-transparent"
                      />
                      <input
                        type="text"
                        value={exp.company}
                        onChange={(e) => updateExperience(index, 'company', e.target.value)}
                        placeholder="Company Name"
                        className="px-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-accent focus:border-transparent"
                      />
                      <input
                        type="text"
                        value={exp.location}
                        onChange={(e) => updateExperience(index, 'location', e.target.value)}
                        placeholder="Location"
                        className="px-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-accent focus:border-transparent"
                      />
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
                      <select
                        value={exp.startMonth || ''}
                        onChange={(e) => updateExperience(index, 'startMonth', e.target.value)}
                        className="px-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-accent focus:border-transparent"
                      >
                        <option value="">Start Month</option>
                        {MONTHS.map(m => <option key={m} value={m}>{m}</option>)}
                      </select>
                      <select
                        value={exp.startYear || ''}
                        onChange={(e) => updateExperience(index, 'startYear', e.target.value)}
                        className="px-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-accent focus:border-transparent"
                      >
                        <option value="">Start Year</option>
                        {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                      </select>
                      <select
                        value={exp.endMonth || ''}
                        onChange={(e) => updateExperience(index, 'endMonth', e.target.value)}
                        disabled={exp.isCurrentRole}
                        className="px-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-accent focus:border-transparent disabled:opacity-50"
                      >
                        <option value="">End Month</option>
                        {MONTHS.map(m => <option key={m} value={m}>{m}</option>)}
                      </select>
                      <select
                        value={exp.endYear || ''}
                        onChange={(e) => updateExperience(index, 'endYear', e.target.value)}
                        disabled={exp.isCurrentRole}
                        className="px-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-accent focus:border-transparent disabled:opacity-50"
                      >
                        <option value="">End Year</option>
                        {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                      </select>
                    </div>

                    <label className="flex items-center gap-2 text-xs text-text-secondary mb-4 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={exp.isCurrentRole || false}
                        onChange={(e) => updateExperience(index, 'isCurrentRole', e.target.checked)}
                        className="rounded border-border text-accent focus:ring-accent"
                      />
                      I currently work here
                    </label>

                    <div className="space-y-2">
                      <label className="text-xs font-medium text-text-secondary">Bullet Points</label>
                      {exp.bullets.map((bullet, bIndex) => (
                        <div key={bIndex} className="flex gap-2">
                          <textarea
                            value={bullet}
                            onChange={(e) => updateBullet(index, bIndex, e.target.value)}
                            placeholder="Describe an achievement or responsibility..."
                            rows={2}
                            className="flex-1 px-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-accent focus:border-transparent resize-none"
                          />
                          <button
                            onClick={() => removeBullet(index, bIndex)}
                            disabled={exp.bullets.length === 1}
                            className="p-2 text-error hover:bg-error-light rounded-lg transition-colors disabled:opacity-30"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                      <button
                        onClick={() => addBullet(index)}
                        className="flex items-center gap-1 text-xs text-accent hover:text-accent-hover transition-colors"
                      >
                        <Plus className="w-3 h-3" /> Add Bullet Point
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Education */}
          <section className="bg-surface p-6 rounded-2xl shadow-sm border border-border">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold text-text-primary flex items-center gap-2">
                <GraduationCap className="w-4 h-4 text-accent" />
                Education
              </h2>
              <button
                onClick={addEducation}
                className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-accent text-white rounded-lg hover:bg-accent-hover transition-colors"
              >
                <Plus className="w-3 h-3" /> Add Education
              </button>
            </div>

            {resume.education.length === 0 ? (
              <p className="text-sm text-text-muted text-center py-4">
                No education added yet. Click "Add Education" to get started.
              </p>
            ) : (
              <div className="space-y-4">
                {resume.education.map((edu, index) => (
                  <div key={index} className="p-4 bg-border-light rounded-xl">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-medium text-text-secondary">Education {index + 1}</span>
                      <button
                        onClick={() => removeEducation(index)}
                        className="p-1 text-error hover:text-error-hover transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                      <input
                        type="text"
                        value={edu.school}
                        onChange={(e) => updateEducation(index, 'school', e.target.value)}
                        placeholder="School Name"
                        className="px-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-accent focus:border-transparent"
                      />
                      <input
                        type="text"
                        value={edu.degree}
                        onChange={(e) => updateEducation(index, 'degree', e.target.value)}
                        placeholder="Degree (e.g., Bachelor of Science)"
                        className="px-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-accent focus:border-transparent"
                      />
                      <input
                        type="text"
                        value={edu.fieldOfStudy || ''}
                        onChange={(e) => updateEducation(index, 'fieldOfStudy', e.target.value)}
                        placeholder="Field of Study"
                        className="px-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-accent focus:border-transparent"
                      />
                      <input
                        type="text"
                        value={edu.location}
                        onChange={(e) => updateEducation(index, 'location', e.target.value)}
                        placeholder="Location"
                        className="px-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-accent focus:border-transparent"
                      />
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
                      <select
                        value={edu.startMonth || ''}
                        onChange={(e) => updateEducation(index, 'startMonth', e.target.value)}
                        className="px-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-accent focus:border-transparent"
                      >
                        <option value="">Start Month</option>
                        {MONTHS.map(m => <option key={m} value={m}>{m}</option>)}
                      </select>
                      <select
                        value={edu.startYear || ''}
                        onChange={(e) => updateEducation(index, 'startYear', e.target.value)}
                        className="px-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-accent focus:border-transparent"
                      >
                        <option value="">Start Year</option>
                        {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                      </select>
                      <select
                        value={edu.endMonth || ''}
                        onChange={(e) => updateEducation(index, 'endMonth', e.target.value)}
                        disabled={edu.isInProgress}
                        className="px-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-accent focus:border-transparent disabled:opacity-50"
                      >
                        <option value="">End Month</option>
                        {MONTHS.map(m => <option key={m} value={m}>{m}</option>)}
                      </select>
                      <select
                        value={edu.endYear || ''}
                        onChange={(e) => updateEducation(index, 'endYear', e.target.value)}
                        disabled={edu.isInProgress}
                        className="px-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-accent focus:border-transparent disabled:opacity-50"
                      >
                        <option value="">End Year</option>
                        {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                      </select>
                    </div>

                    <label className="flex items-center gap-2 text-xs text-text-secondary cursor-pointer">
                      <input
                        type="checkbox"
                        checked={edu.isInProgress || false}
                        onChange={(e) => updateEducation(index, 'isInProgress', e.target.checked)}
                        className="rounded border-border text-accent focus:ring-accent"
                      />
                      Currently enrolled / In Progress
                    </label>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Skills */}
          <section className="bg-surface p-6 rounded-2xl shadow-sm border border-border">
            <h2 className="text-sm font-bold text-text-primary mb-4 flex items-center gap-2">
              <Wrench className="w-4 h-4 text-accent" />
              Skills
            </h2>

            <div className="space-y-4">
              {/* Core Competencies */}
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-2">Core Competencies</label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {resume.skills.core.map((skill, index) => (
                    <span
                      key={index}
                      className="inline-flex items-center gap-1 px-3 py-1 bg-accent-light text-accent text-xs rounded-full"
                    >
                      {skill}
                      <button
                        onClick={() => removeSkill('core', index)}
                        className="hover:text-error transition-colors"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={skillInput.core}
                    onChange={(e) => setSkillInput(prev => ({ ...prev, core: e.target.value }))}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addSkill('core', skillInput.core);
                      }
                    }}
                    placeholder="Type a skill and press Enter"
                    className="flex-1 px-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-accent focus:border-transparent"
                  />
                  <button
                    onClick={() => addSkill('core', skillInput.core)}
                    className="px-3 py-2 bg-accent text-white rounded-lg hover:bg-accent-hover transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Tools & Technologies */}
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-2">Tools & Technologies</label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {resume.skills.tools.map((skill, index) => (
                    <span
                      key={index}
                      className="inline-flex items-center gap-1 px-3 py-1 bg-border-light text-text-secondary text-xs rounded-full"
                    >
                      {skill}
                      <button
                        onClick={() => removeSkill('tools', index)}
                        className="hover:text-error transition-colors"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={skillInput.tools}
                    onChange={(e) => setSkillInput(prev => ({ ...prev, tools: e.target.value }))}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addSkill('tools', skillInput.tools);
                      }
                    }}
                    placeholder="Type a tool/technology and press Enter"
                    className="flex-1 px-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-accent focus:border-transparent"
                  />
                  <button
                    onClick={() => addSkill('tools', skillInput.tools)}
                    className="px-3 py-2 bg-accent text-white rounded-lg hover:bg-accent-hover transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </section>

          {/* Projects (Optional) */}
          <section className="bg-surface p-6 rounded-2xl shadow-sm border border-border">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold text-text-primary flex items-center gap-2">
                <FolderOpen className="w-4 h-4 text-accent" />
                Projects
              </h2>
              <label className="flex items-center gap-2 text-xs text-text-secondary cursor-pointer">
                <input
                  type="checkbox"
                  checked={resume.includeProjects}
                  onChange={(e) => updateField('includeProjects', e.target.checked)}
                  className="rounded border-border text-accent focus:ring-accent"
                />
                Include in resume
              </label>
            </div>

            {resume.includeProjects && (
              <>
                <button
                  onClick={addProject}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-accent text-white rounded-lg hover:bg-accent-hover transition-colors mb-4"
                >
                  <Plus className="w-3 h-3" /> Add Project
                </button>

                {(resume.projects || []).length === 0 ? (
                  <p className="text-sm text-text-muted text-center py-4">
                    No projects added yet.
                  </p>
                ) : (
                  <div className="space-y-4">
                    {(resume.projects || []).map((project, index) => (
                      <div key={index} className="p-4 bg-border-light rounded-xl">
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-xs font-medium text-text-secondary">Project {index + 1}</span>
                          <button
                            onClick={() => removeProject(index)}
                            className="p-1 text-error hover:text-error-hover transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                          <input
                            type="text"
                            value={project.name}
                            onChange={(e) => updateProject(index, 'name', e.target.value)}
                            placeholder="Project Name"
                            className="px-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-accent focus:border-transparent"
                          />
                          <input
                            type="text"
                            value={project.dateRange}
                            onChange={(e) => updateProject(index, 'dateRange', e.target.value)}
                            placeholder="Date/Timeframe (e.g., Fall 2024)"
                            className="px-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-accent focus:border-transparent"
                          />
                        </div>
                        <textarea
                          value={project.description}
                          onChange={(e) => updateProject(index, 'description', e.target.value)}
                          placeholder="Project description..."
                          rows={2}
                          className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-accent focus:border-transparent resize-none mb-3"
                        />
                        <input
                          type="text"
                          value={project.technologies}
                          onChange={(e) => updateProject(index, 'technologies', e.target.value)}
                          placeholder="Technologies Used (e.g., React, Node.js, PostgreSQL)"
                          className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-accent focus:border-transparent"
                        />
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </section>

          {/* Certifications (Optional) */}
          <section className="bg-surface p-6 rounded-2xl shadow-sm border border-border">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold text-text-primary flex items-center gap-2">
                <Award className="w-4 h-4 text-accent" />
                Certifications
              </h2>
              <label className="flex items-center gap-2 text-xs text-text-secondary cursor-pointer">
                <input
                  type="checkbox"
                  checked={resume.includeCertifications}
                  onChange={(e) => updateField('includeCertifications', e.target.checked)}
                  className="rounded border-border text-accent focus:ring-accent"
                />
                Include in resume
              </label>
            </div>

            {resume.includeCertifications && (
              <>
                <button
                  onClick={addCertification}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-accent text-white rounded-lg hover:bg-accent-hover transition-colors mb-4"
                >
                  <Plus className="w-3 h-3" /> Add Certification
                </button>

                {(resume.certifications || []).length === 0 ? (
                  <p className="text-sm text-text-muted text-center py-4">
                    No certifications added yet.
                  </p>
                ) : (
                  <div className="space-y-4">
                    {(resume.certifications || []).map((cert, index) => (
                      <div key={index} className="p-4 bg-border-light rounded-xl">
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-xs font-medium text-text-secondary">Certification {index + 1}</span>
                          <button
                            onClick={() => removeCertification(index)}
                            className="p-1 text-error hover:text-error-hover transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <input
                            type="text"
                            value={cert.name}
                            onChange={(e) => updateCertification(index, 'name', e.target.value)}
                            placeholder="Certification Name"
                            maxLength={MAX_CERT_NAME_LENGTH}
                            className="px-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-accent focus:border-transparent"
                          />
                          <p className={`text-[10px] mt-1 ${cert.name.length >= MAX_CERT_NAME_LENGTH ? 'text-warning' : 'text-text-muted'}`}>
                            {MAX_CERT_NAME_LENGTH - cert.name.length} characters remaining
                          </p>
                          <input
                            type="text"
                            value={cert.issuer}
                            onChange={(e) => updateCertification(index, 'issuer', e.target.value)}
                            placeholder="Issuing Organization"
                            className="px-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-accent focus:border-transparent"
                          />
                          <input
                            type="text"
                            value={cert.dateObtained}
                            onChange={(e) => updateCertification(index, 'dateObtained', e.target.value)}
                            placeholder="Date Obtained (e.g., March 2024)"
                            className="px-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-accent focus:border-transparent"
                          />
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              value={cert.expirationDate || ''}
                              onChange={(e) => updateCertification(index, 'expirationDate', e.target.value)}
                              placeholder="Expiration Date"
                              disabled={cert.noExpiration}
                              className="flex-1 px-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-accent focus:border-transparent disabled:opacity-50"
                            />
                            <label className="flex items-center gap-1 text-xs text-text-secondary whitespace-nowrap cursor-pointer">
                              <input
                                type="checkbox"
                                checked={cert.noExpiration || false}
                                onChange={(e) => {
                                  const checked = e.target.checked;
                                  updateCertification(index, 'noExpiration', checked);
                                  if (checked) {
                                    updateCertification(index, 'expirationDate', '');
                                  }
                                }}
                                className="rounded border-border text-accent focus:ring-accent"
                              />
                              No Expiration
                            </label>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </section>

          {/* Clinical Hours / Practicum / Fieldwork (Optional) */}
          <section className="bg-surface p-6 rounded-2xl shadow-sm border border-border">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold text-text-primary flex items-center gap-2">
                <Clock className="w-4 h-4 text-accent" />
                Clinical Hours / Practicum / Fieldwork
              </h2>
              <label className="flex items-center gap-2 text-xs text-text-secondary cursor-pointer">
                <input
                  type="checkbox"
                  checked={resume.includeClinicalHours}
                  onChange={(e) => updateField('includeClinicalHours', e.target.checked)}
                  className="rounded border-border text-accent focus:ring-accent"
                />
                Include in resume
              </label>
            </div>
            <p className="text-xs text-text-muted mb-4">
              For healthcare, social work, counseling, and similar fields.
            </p>

            {resume.includeClinicalHours && (
              <>
                <button
                  onClick={addClinicalHours}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-accent text-white rounded-lg hover:bg-accent-hover transition-colors mb-4"
                >
                  <Plus className="w-3 h-3" /> Add Entry
                </button>

                {(resume.clinicalHours || []).length === 0 ? (
                  <p className="text-sm text-text-muted text-center py-4">
                    No entries added yet.
                  </p>
                ) : (
                  <div className="space-y-4">
                    {(resume.clinicalHours || []).map((entry, index) => (
                      <div key={index} className="p-4 bg-border-light rounded-xl">
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-xs font-medium text-text-secondary">Entry {index + 1}</span>
                          <button
                            onClick={() => removeClinicalHours(index)}
                            className="p-1 text-error hover:text-error-hover transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                          <input
                            type="text"
                            value={entry.siteName}
                            onChange={(e) => updateClinicalHours(index, 'siteName', e.target.value)}
                            placeholder="Site/Organization Name"
                            className="px-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-accent focus:border-transparent"
                          />
                          <input
                            type="text"
                            value={entry.role}
                            onChange={(e) => updateClinicalHours(index, 'role', e.target.value)}
                            placeholder="Role/Position"
                            className="px-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-accent focus:border-transparent"
                          />
                          <input
                            type="number"
                            value={entry.hoursCompleted || ''}
                            onChange={(e) => updateClinicalHours(index, 'hoursCompleted', parseInt(e.target.value) || 0)}
                            placeholder="Hours Completed"
                            className="px-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-accent focus:border-transparent"
                          />
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
                          <select
                            value={entry.startMonth || ''}
                            onChange={(e) => updateClinicalHours(index, 'startMonth', e.target.value)}
                            className="px-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-accent focus:border-transparent"
                          >
                            <option value="">Start Month</option>
                            {MONTHS.map(m => <option key={m} value={m}>{m}</option>)}
                          </select>
                          <select
                            value={entry.startYear || ''}
                            onChange={(e) => updateClinicalHours(index, 'startYear', e.target.value)}
                            className="px-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-accent focus:border-transparent"
                          >
                            <option value="">Start Year</option>
                            {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                          </select>
                          <select
                            value={entry.endMonth || ''}
                            onChange={(e) => updateClinicalHours(index, 'endMonth', e.target.value)}
                            className="px-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-accent focus:border-transparent"
                          >
                            <option value="">End Month</option>
                            {MONTHS.map(m => <option key={m} value={m}>{m}</option>)}
                          </select>
                          <select
                            value={entry.endYear || ''}
                            onChange={(e) => updateClinicalHours(index, 'endYear', e.target.value)}
                            className="px-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-accent focus:border-transparent"
                          >
                            <option value="">End Year</option>
                            {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                          </select>
                        </div>
                        <textarea
                          value={entry.description || ''}
                          onChange={(e) => updateClinicalHours(index, 'description', e.target.value)}
                          placeholder="Description (optional)"
                          rows={2}
                          className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-accent focus:border-transparent resize-none"
                        />
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </section>

          {/* Volunteer Work (Optional) */}
          <section className="bg-surface p-6 rounded-2xl shadow-sm border border-border">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold text-text-primary flex items-center gap-2">
                <Heart className="w-4 h-4 text-accent" />
                Volunteer Work
              </h2>
              <label className="flex items-center gap-2 text-xs text-text-secondary cursor-pointer">
                <input
                  type="checkbox"
                  checked={resume.includeVolunteer}
                  onChange={(e) => updateField('includeVolunteer', e.target.checked)}
                  className="rounded border-border text-accent focus:ring-accent"
                />
                Include in resume
              </label>
            </div>

            {resume.includeVolunteer && (
              <>
                <button
                  onClick={addVolunteer}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-accent text-white rounded-lg hover:bg-accent-hover transition-colors mb-4"
                >
                  <Plus className="w-3 h-3" /> Add Volunteer Work
                </button>

                {(resume.volunteer || []).length === 0 ? (
                  <p className="text-sm text-text-muted text-center py-4">
                    No volunteer work added yet.
                  </p>
                ) : (
                  <div className="space-y-4">
                    {(resume.volunteer || []).map((entry, index) => (
                      <div key={index} className="p-4 bg-border-light rounded-xl">
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-xs font-medium text-text-secondary">Entry {index + 1}</span>
                          <button
                            onClick={() => removeVolunteer(index)}
                            className="p-1 text-error hover:text-error-hover transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                          <input
                            type="text"
                            value={entry.organization}
                            onChange={(e) => updateVolunteer(index, 'organization', e.target.value)}
                            placeholder="Organization"
                            className="px-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-accent focus:border-transparent"
                          />
                          <input
                            type="text"
                            value={entry.role}
                            onChange={(e) => updateVolunteer(index, 'role', e.target.value)}
                            placeholder="Role"
                            className="px-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-accent focus:border-transparent"
                          />
                          <input
                            type="text"
                            value={entry.dateRange}
                            onChange={(e) => updateVolunteer(index, 'dateRange', e.target.value)}
                            placeholder="Date Range (e.g., Jan 2023 – Present)"
                            className="px-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-accent focus:border-transparent"
                          />
                        </div>
                        <textarea
                          value={entry.description}
                          onChange={(e) => updateVolunteer(index, 'description', e.target.value)}
                          placeholder="Description of your volunteer work..."
                          rows={2}
                          className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-accent focus:border-transparent resize-none"
                        />
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </section>

          {/* Publications (Optional) */}
          <section className="bg-surface p-6 rounded-2xl shadow-sm border border-border">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold text-text-primary flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-accent" />
                Publications
              </h2>
              <label className="flex items-center gap-2 text-xs text-text-secondary cursor-pointer">
                <input
                  type="checkbox"
                  checked={resume.includePublications}
                  onChange={(e) => updateField('includePublications', e.target.checked)}
                  className="rounded border-border text-accent focus:ring-accent"
                />
                Include in resume
              </label>
            </div>

            {resume.includePublications && (
              <>
                <button
                  onClick={addPublication}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-accent text-white rounded-lg hover:bg-accent-hover transition-colors mb-4"
                >
                  <Plus className="w-3 h-3" /> Add Publication
                </button>

                {(resume.publications || []).length === 0 ? (
                  <p className="text-sm text-text-muted text-center py-4">
                    No publications added yet.
                  </p>
                ) : (
                  <div className="space-y-4">
                    {(resume.publications || []).map((pub, index) => (
                      <div key={index} className="p-4 bg-border-light rounded-xl">
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-xs font-medium text-text-secondary">Publication {index + 1}</span>
                          <button
                            onClick={() => removePublication(index)}
                            className="p-1 text-error hover:text-error-hover transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <input
                            type="text"
                            value={pub.title}
                            onChange={(e) => updatePublication(index, 'title', e.target.value)}
                            placeholder="Publication Title"
                            className="px-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-accent focus:border-transparent"
                          />
                          <input
                            type="text"
                            value={pub.publication}
                            onChange={(e) => updatePublication(index, 'publication', e.target.value)}
                            placeholder="Journal/Publisher"
                            className="px-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-accent focus:border-transparent"
                          />
                          <input
                            type="text"
                            value={pub.date}
                            onChange={(e) => updatePublication(index, 'date', e.target.value)}
                            placeholder="Date (e.g., March 2024)"
                            className="px-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-accent focus:border-transparent"
                          />
                          <input
                            type="url"
                            value={pub.url || ''}
                            onChange={(e) => updatePublication(index, 'url', e.target.value)}
                            placeholder="URL (optional)"
                            className="px-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-accent focus:border-transparent"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </section>

          {/* Languages (Optional) */}
          <section className="bg-surface p-6 rounded-2xl shadow-sm border border-border">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold text-text-primary flex items-center gap-2">
                <Globe className="w-4 h-4 text-accent" />
                Languages
              </h2>
              <label className="flex items-center gap-2 text-xs text-text-secondary cursor-pointer">
                <input
                  type="checkbox"
                  checked={resume.includeLanguages}
                  onChange={(e) => updateField('includeLanguages', e.target.checked)}
                  className="rounded border-border text-accent focus:ring-accent"
                />
                Include in resume
              </label>
            </div>

            {resume.includeLanguages && (
              <>
                <div className="flex flex-wrap gap-2 mb-3">
                  {(resume.languages || []).map((lang, index) => (
                    <span
                      key={index}
                      className="inline-flex items-center gap-1 px-3 py-1 bg-accent-light text-accent text-xs rounded-full"
                    >
                      {lang}
                      <button
                        onClick={() => removeLanguage(index)}
                        className="hover:text-error transition-colors"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={languageInput}
                    onChange={(e) => setLanguageInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addLanguage(languageInput);
                      }
                    }}
                    placeholder="e.g., English (Native), Spanish (Fluent)"
                    className="flex-1 px-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-accent focus:border-transparent"
                  />
                  <button
                    onClick={() => addLanguage(languageInput)}
                    className="px-3 py-2 bg-accent text-white rounded-lg hover:bg-accent-hover transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </>
            )}
          </section>

          {/* Awards/Honors (Optional) */}
          <section className="bg-surface p-6 rounded-2xl shadow-sm border border-border">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold text-text-primary flex items-center gap-2">
                <Trophy className="w-4 h-4 text-accent" />
                Awards & Honors
              </h2>
              <label className="flex items-center gap-2 text-xs text-text-secondary cursor-pointer">
                <input
                  type="checkbox"
                  checked={resume.includeAwards}
                  onChange={(e) => updateField('includeAwards', e.target.checked)}
                  className="rounded border-border text-accent focus:ring-accent"
                />
                Include in resume
              </label>
            </div>

            {resume.includeAwards && (
              <>
                <button
                  onClick={addAward}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-accent text-white rounded-lg hover:bg-accent-hover transition-colors mb-4"
                >
                  <Plus className="w-3 h-3" /> Add Award
                </button>

                {(resume.awards || []).length === 0 ? (
                  <p className="text-sm text-text-muted text-center py-4">
                    No awards added yet.
                  </p>
                ) : (
                  <div className="space-y-4">
                    {(resume.awards || []).map((award, index) => (
                      <div key={index} className="p-4 bg-border-light rounded-xl">
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-xs font-medium text-text-secondary">Award {index + 1}</span>
                          <button
                            onClick={() => removeAward(index)}
                            className="p-1 text-error hover:text-error-hover transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                          <input
                            type="text"
                            value={award.title}
                            onChange={(e) => updateAward(index, 'title', e.target.value)}
                            placeholder="Award Title"
                            className="px-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-accent focus:border-transparent"
                          />
                          <input
                            type="text"
                            value={award.issuer}
                            onChange={(e) => updateAward(index, 'issuer', e.target.value)}
                            placeholder="Issuing Organization"
                            className="px-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-accent focus:border-transparent"
                          />
                          <input
                            type="text"
                            value={award.date}
                            onChange={(e) => updateAward(index, 'date', e.target.value)}
                            placeholder="Date Received"
                            className="px-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-accent focus:border-transparent"
                          />
                        </div>
                        <textarea
                          value={award.description || ''}
                          onChange={(e) => updateAward(index, 'description', e.target.value)}
                          placeholder="Description (optional)"
                          rows={2}
                          className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-accent focus:border-transparent resize-none"
                        />
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </section>

          {/* Resume Style Selection */}
          <section className="bg-surface p-6 rounded-2xl shadow-sm border border-border">
            <h2 className="text-sm font-bold text-text-primary mb-4 flex items-center gap-2">
              <FileText className="w-4 h-4 text-accent" />
              Resume Style
            </h2>
            <p className="text-xs text-text-muted mb-4">
              Select a template that best fits your background. This affects section ordering in the final PDF.
            </p>

            <div className="space-y-3">
              {RESUME_STYLES.map((style) => (
                <button
                  key={style.id}
                  onClick={() => setResumeStyle(style.id)}
                  className={`w-full p-4 rounded-xl border-2 text-left transition-all ${
                    resumeStyle === style.id
                      ? 'border-accent bg-accent-light'
                      : 'border-border hover:border-accent-muted'
                  }`}
                >
                  <h3 className="text-sm font-semibold text-text-primary">{style.name}</h3>
                  <p className="text-xs text-text-muted mt-1">Best for: {style.bestFor}</p>
                </button>
              ))}
            </div>
          </section>

        </div>

        {/* Right Column - Preview */}
        {showPreview && (
          <div className="lg:sticky lg:top-4 h-fit">
            <div className="bg-surface rounded-2xl shadow-sm border border-border overflow-hidden">
              <div className="bg-border-light px-6 py-4 border-b border-border">
                <div className="flex items-center gap-2 text-accent font-bold text-sm">
                  <AlertCircle className="w-4 h-4" /> Live Preview
                </div>
                <p className="text-xs text-text-muted mt-1">Changes update in real-time</p>
              </div>

              <div className="p-6 bg-surface max-h-[70vh] overflow-y-auto custom-scrollbar">
                <div className="w-full shadow-sm border border-border p-8 bg-surface text-text-primary text-[10px] leading-relaxed">
                  {/* Header */}
                  <div className="text-center mb-6">
                    <h1 className="text-xl font-bold uppercase mb-1 tracking-tight">
                      {resume.contact.name || 'Your Name'}
                    </h1>
                    <p className="text-text-muted text-[9px]">
                      {[resume.contact.email, resume.contact.phone, resume.contact.location]
                        .filter(Boolean)
                        .join(' • ') || 'your@email.com • (555) 123-4567 • City, State'}
                      {resume.contact.linkedin && ` • ${resume.contact.linkedin}`}
                    </p>
                  </div>

                  {/* Objective */}
                  {resume.includeObjective && resume.objective && (
                    <div className="mb-4">
                      <h3 className="text-[9px] font-bold uppercase border-b border-text-primary pb-0.5 mb-2">
                        Objective
                      </h3>
                      <p>{resume.objective}</p>
                    </div>
                  )}

                  {/* Summary */}
                  {resume.summary && (
                    <div className="mb-4">
                      <h3 className="text-[9px] font-bold uppercase border-b border-text-primary pb-0.5 mb-2">
                        Professional Summary
                      </h3>
                      <p>{resume.summary}</p>
                    </div>
                  )}

                  {/* Skills */}
                  {(resume.skills.core.length > 0 || resume.skills.tools.length > 0) && (
                    <div className="mb-4">
                      <h3 className="text-[9px] font-bold uppercase border-b border-text-primary pb-0.5 mb-2">
                        Skills
                      </h3>
                      {resume.skills.core.length > 0 && (
                        <p className="mb-1">
                          <span className="font-bold">Core Competencies:</span> {resume.skills.core.join(' • ')}
                        </p>
                      )}
                      {resume.skills.tools.length > 0 && (
                        <p>
                          <span className="font-bold">Tools & Technologies:</span> {resume.skills.tools.join(' • ')}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Experience */}
                  {resume.experience.length > 0 && (
                    <div className="mb-4">
                      <h3 className="text-[9px] font-bold uppercase border-b border-text-primary pb-0.5 mb-2">
                        Experience
                      </h3>
                      <div className="space-y-3">
                        {resume.experience.map((exp, i) => (
                          <div key={i}>
                            <div className="flex justify-between items-baseline mb-0.5">
                              <h4 className="font-bold text-[10px] uppercase">{exp.company || 'Company Name'}</h4>
                              <span className="font-bold italic text-[9px]">
                                {getDisplayDateRange(
                                  exp.dateRange,
                                  exp.startMonth,
                                  exp.startYear,
                                  exp.endMonth,
                                  exp.endYear,
                                  exp.isCurrentRole
                                )}
                              </span>
                            </div>
                            <div className="flex justify-between items-baseline mb-1 italic text-text-secondary">
                              <span>{exp.role || 'Job Title'}</span>
                              <span>{exp.location}</span>
                            </div>
                            {exp.bullets.filter(b => b.trim()).length > 0 && (
                              <ul className="list-disc ml-4 space-y-0.5 text-text-secondary">
                                {exp.bullets.filter(b => b.trim()).map((b, j) => (
                                  <li key={j}>{b}</li>
                                ))}
                              </ul>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Education */}
                  {resume.education.length > 0 && (
                    <div className="mb-4">
                      <h3 className="text-[9px] font-bold uppercase border-b border-text-primary pb-0.5 mb-2">
                        Education
                      </h3>
                      <div className="space-y-2">
                        {resume.education.map((edu, i) => (
                          <div key={i} className="flex justify-between items-start">
                            <div>
                              <p className="font-bold uppercase text-[10px]">{edu.school || 'School Name'}</p>
                              <p>{edu.degree}{edu.fieldOfStudy ? ` in ${edu.fieldOfStudy}` : ''}</p>
                            </div>
                            <div className="text-right">
                              <p className="font-bold italic">
                                {getDisplayDateRange(
                                  edu.dateRange,
                                  edu.startMonth,
                                  edu.startYear,
                                  edu.endMonth,
                                  edu.endYear,
                                  edu.isInProgress
                                )}
                              </p>
                              <p className="italic text-text-muted">{edu.location}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Projects */}
                  {resume.includeProjects && (resume.projects || []).length > 0 && (
                    <div className="mb-4">
                      <h3 className="text-[9px] font-bold uppercase border-b border-text-primary pb-0.5 mb-2">
                        Projects
                      </h3>
                      <div className="space-y-2">
                        {(resume.projects || []).map((proj, i) => (
                          <div key={i}>
                            <div className="flex justify-between items-baseline">
                              <span className="font-bold">{proj.name}</span>
                              <span className="italic">{proj.dateRange}</span>
                            </div>
                            {proj.description && <p className="text-text-secondary">{proj.description}</p>}
                            {proj.technologies && (
                              <p className="text-text-muted italic">Technologies: {proj.technologies}</p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Certifications */}
                  {resume.includeCertifications && (resume.certifications || []).length > 0 && (
                    <div className="mb-4">
                      <h3 className="text-[9px] font-bold uppercase border-b border-text-primary pb-0.5 mb-2">
                        Certifications
                      </h3>
                      <div className="space-y-1">
                        {(resume.certifications || []).map((cert, i) => (
                          <p key={i}>
                            <span className="font-bold">{cert.name}</span>
                            {cert.issuer && `, ${cert.issuer}`}
                            {(() => {
                              const issued = cert.dateObtained ? `Issued: ${cert.dateObtained}` : '';
                              const exp = cert.noExpiration
                                ? 'No Expiration'
                                : cert.expirationDate ? `Exp: ${cert.expirationDate}` : '';
                              const dateText = issued && exp ? `${issued} (${exp})` : issued || exp;
                              return dateText ? ` — ${dateText}` : '';
                            })()}
                          </p>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Clinical Hours */}
                  {resume.includeClinicalHours && (resume.clinicalHours || []).length > 0 && (
                    <div className="mb-4">
                      <h3 className="text-[9px] font-bold uppercase border-b border-text-primary pb-0.5 mb-2">
                        Clinical Hours / Practicum
                      </h3>
                      <div className="space-y-2">
                        {(resume.clinicalHours || []).map((entry, i) => (
                          <div key={i}>
                            <div className="flex justify-between items-baseline">
                              <span className="font-bold">{entry.siteName}</span>
                              <span className="italic">{entry.hoursCompleted} hours</span>
                            </div>
                            <p className="text-text-secondary">{entry.role}</p>
                            {entry.description && <p className="text-text-muted">{entry.description}</p>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Volunteer */}
                  {resume.includeVolunteer && (resume.volunteer || []).length > 0 && (
                    <div className="mb-4">
                      <h3 className="text-[9px] font-bold uppercase border-b border-text-primary pb-0.5 mb-2">
                        Volunteer Work
                      </h3>
                      <div className="space-y-2">
                        {(resume.volunteer || []).map((vol, i) => (
                          <div key={i}>
                            <div className="flex justify-between items-baseline">
                              <span className="font-bold">{vol.organization}</span>
                              <span className="italic">{vol.dateRange}</span>
                            </div>
                            <p className="text-text-secondary">{vol.role}</p>
                            {vol.description && <p className="text-text-muted">{vol.description}</p>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Publications */}
                  {resume.includePublications && (resume.publications || []).length > 0 && (
                    <div className="mb-4">
                      <h3 className="text-[9px] font-bold uppercase border-b border-text-primary pb-0.5 mb-2">
                        Publications
                      </h3>
                      <div className="space-y-1">
                        {(resume.publications || []).map((pub, i) => (
                          <p key={i}>
                            "{pub.title}" - {pub.publication}, {pub.date}
                          </p>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Languages */}
                  {resume.includeLanguages && (resume.languages || []).length > 0 && (
                    <div className="mb-4">
                      <h3 className="text-[9px] font-bold uppercase border-b border-text-primary pb-0.5 mb-2">
                        Languages
                      </h3>
                      <p>{(resume.languages || []).join(' • ')}</p>
                    </div>
                  )}

                  {/* Awards */}
                  {resume.includeAwards && (resume.awards || []).length > 0 && (
                    <div className="mb-4">
                      <h3 className="text-[9px] font-bold uppercase border-b border-text-primary pb-0.5 mb-2">
                        Awards & Honors
                      </h3>
                      <div className="space-y-1">
                        {(resume.awards || []).map((award, i) => (
                          <p key={i}>
                            <span className="font-bold">{award.title}</span>
                            {award.issuer && `, ${award.issuer}`}
                            {award.date && ` (${award.date})`}
                          </p>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Action Buttons */}
      <div className="flex items-center justify-between mt-8 pt-6 border-t border-border">
        <button
          onClick={onBack}
          className="flex items-center gap-2 px-6 py-3 text-text-secondary hover:text-text-primary transition-colors"
        >
          <ChevronDown className="w-4 h-4 rotate-90" />
          Back
        </button>
        <button
          onClick={handleContinue}
          className="flex items-center gap-2 px-8 py-3 bg-accent hover:bg-accent-hover text-white rounded-xl font-bold shadow-lg shadow-accent-muted/30 transition-all"
        >
          Continue to Optimize
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
};

export default ResumeBuilder;
