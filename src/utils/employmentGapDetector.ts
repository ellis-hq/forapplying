import {
  ResumeExperience,
  ResumeEducation,
  EmploymentGap,
  EmploymentGapResolutionState
} from '../types';

// Month name to number mapping
const MONTH_MAP: Record<string, number> = {
  january: 1, jan: 1,
  february: 2, feb: 2,
  march: 3, mar: 3,
  april: 4, apr: 4,
  may: 5,
  june: 6, jun: 6,
  july: 7, jul: 7,
  august: 8, aug: 8,
  september: 9, sep: 9, sept: 9,
  october: 10, oct: 10,
  november: 11, nov: 11,
  december: 12, dec: 12
};

interface ParsedDate {
  month: number;
  year: number;
}

function parseYear(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (/^\d{4}$/.test(trimmed)) return parseInt(trimmed, 10);
  if (/^\d{2}$/.test(trimmed)) {
    const yy = parseInt(trimmed, 10);
    const currentYear = new Date().getFullYear() % 100;
    const century = yy <= currentYear + 1 ? 2000 : 1900;
    return century + yy;
  }
  return null;
}

function parseMonth(value: string): number | null {
  const trimmed = value.trim().toLowerCase().replace(/\.$/, '');
  if (!trimmed) return null;
  if (/^\d{1,2}$/.test(trimmed)) {
    const num = parseInt(trimmed, 10);
    return num >= 1 && num <= 12 ? num : null;
  }
  return MONTH_MAP[trimmed] || null;
}

/**
 * Parse a date string into month/year components
 * Handles formats like "May 2024", "05/2024", "2024-05", etc.
 */
export function parseEmploymentDate(dateStr: string): ParsedDate | null {
  if (!dateStr) return null;

  const str = dateStr.toLowerCase().trim();

  // Handle "Present" or "Current"
  if (str === 'present' || str === 'current' || str.includes('present') || str.includes('current')) {
    const now = new Date();
    return { month: now.getMonth() + 1, year: now.getFullYear() };
  }

  // Try "Month Year" format (e.g., "May 2024", "January 2023", "May 24")
  for (const [name, num] of Object.entries(MONTH_MAP)) {
    if (str.includes(name)) {
      const yearMatch = str.match(/\b(\d{2}|\d{4})\b/);
      if (yearMatch) {
        const year = parseYear(yearMatch[0]);
        if (year) {
          return { month: num, year };
        }
      }
    }
  }

  // Try "MM/YYYY" or "MM-YYYY" format (also supports MM/YY)
  const slashMatch = str.match(/(\d{1,2})[\/\-](\d{2,4})/);
  if (slashMatch) {
    const month = parseMonth(slashMatch[1]);
    const year = parseYear(slashMatch[2]);
    if (month && year) return { month, year };
  }

  // Try "YYYY-MM" format (also supports YY-MM)
  const isoMatch = str.match(/(\d{2,4})[\/\-](\d{1,2})/);
  if (isoMatch) {
    const year = parseYear(isoMatch[1]);
    const month = parseMonth(isoMatch[2]);
    if (month && year) return { month, year };
  }

  // Try just year (assume January)
  const yearOnly = str.match(/\b(\d{2}|\d{4})\b/);
  if (yearOnly) {
    const year = parseYear(yearOnly[0]);
    if (year) return { month: 1, year };
  }

  return null;
}

/**
 * Convert parsed date to a comparable number (year * 12 + month)
 */
function dateToComparable(date: ParsedDate): number {
  return date.year * 12 + date.month;
}

/**
 * Calculate months between two dates
 */
function monthsBetween(start: ParsedDate, end: ParsedDate): number {
  return dateToComparable(end) - dateToComparable(start);
}

/**
 * Extract start and end dates from a date range string
 * Handles: "May 2024 - Present", "Jan 2020 – Dec 2022", etc.
 */
function parseDateRange(dateRange: string): { start: ParsedDate | null; end: ParsedDate | null } {
  if (!dateRange) return { start: null, end: null };

  // Split on common separators
  const parts = dateRange.split(/\s*(?:[-–—]|\bto\b|\bthrough\b|\bthru\b|\buntil\b)\s*/i);

  if (parts.length >= 2) {
    return {
      start: parseEmploymentDate(parts[0]),
      end: parseEmploymentDate(parts[parts.length - 1])
    };
  }

  // Single date - treat as both start and end
  const single = parseEmploymentDate(dateRange);
  return { start: single, end: single };
}

/**
 * Get start/end dates from experience entry, preferring structured fields
 */
function getExperienceDates(exp: ResumeExperience): { start: ParsedDate | null; end: ParsedDate | null } {
  // First try structured fields
  if (exp.startMonth && exp.startYear) {
    const startMonth = parseMonth(exp.startMonth);
    const startYear = parseYear(exp.startYear);
    if (!startMonth || !startYear) {
      return parseDateRange(exp.dateRange);
    }
    const start: ParsedDate = {
      month: startMonth,
      year: startYear
    };

    let end: ParsedDate;
    if (exp.isCurrentRole) {
      const now = new Date();
      end = { month: now.getMonth() + 1, year: now.getFullYear() };
    } else if (exp.endMonth && exp.endYear) {
      const endMonth = parseMonth(exp.endMonth);
      const endYear = parseYear(exp.endYear);
      if (!endMonth || !endYear) {
        const parsed = parseDateRange(exp.dateRange);
        end = parsed.end || start;
      } else {
      end = {
        month: endMonth,
        year: endYear
      };
      }
    } else {
      // Use dateRange as fallback for end
      const parsed = parseDateRange(exp.dateRange);
      end = parsed.end || start;
    }

    return { start, end };
  }

  // Fall back to parsing dateRange
  return parseDateRange(exp.dateRange);
}

/**
 * Get start/end dates from education entry
 */
function getEducationDates(edu: ResumeEducation): { start: ParsedDate | null; end: ParsedDate | null } {
  // First try structured fields
  if (edu.startMonth && edu.startYear) {
    const startMonth = parseMonth(edu.startMonth);
    const startYear = parseYear(edu.startYear);
    if (!startMonth || !startYear) {
      return parseDateRange(edu.dateRange);
    }
    const start: ParsedDate = {
      month: startMonth,
      year: startYear
    };

    let end: ParsedDate;
    if (edu.isInProgress) {
      const now = new Date();
      end = { month: now.getMonth() + 1, year: now.getFullYear() };
    } else if (edu.endMonth && edu.endYear) {
      const endMonth = parseMonth(edu.endMonth);
      const endYear = parseYear(edu.endYear);
      if (!endMonth || !endYear) {
        const parsed = parseDateRange(edu.dateRange);
        end = parsed.end || start;
      } else {
      end = {
        month: endMonth,
        year: endYear
      };
      }
    } else {
      const parsed = parseDateRange(edu.dateRange);
      end = parsed.end || start;
    }

    return { start, end };
  }

  return parseDateRange(edu.dateRange);
}

/**
 * Check if a gap period is covered by education
 */
function checkEducationCoverage(
  gapStart: ParsedDate,
  gapEnd: ParsedDate,
  education: ResumeEducation[]
): { covered: boolean; coveringEducation?: { school: string; degree: string } } {
  for (const edu of education) {
    const dates = getEducationDates(edu);
    if (!dates.start || !dates.end) continue;

    const eduStart = dateToComparable(dates.start);
    const eduEnd = dateToComparable(dates.end);
    const gapStartComp = dateToComparable(gapStart);
    const gapEndComp = dateToComparable(gapEnd);

    // Check if education overlaps with gap period (at least 50% coverage)
    const overlapStart = Math.max(eduStart, gapStartComp);
    const overlapEnd = Math.min(eduEnd, gapEndComp);
    const overlapMonths = Math.max(0, overlapEnd - overlapStart);
    const gapMonths = gapEndComp - gapStartComp;

    if (overlapMonths >= gapMonths * 0.5) {
      return {
        covered: true,
        coveringEducation: { school: edu.school, degree: edu.degree }
      };
    }
  }

  return { covered: false };
}

/**
 * Check if a gap is considered "old" (10+ years ago)
 */
function isOldGap(gapEnd: ParsedDate): boolean {
  const now = new Date();
  const yearsAgo = now.getFullYear() - gapEnd.year;
  return yearsAgo >= 10;
}

/**
 * Format a parsed date as a display string
 */
function formatDate(date: ParsedDate): string {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[date.month - 1]} ${date.year}`;
}

/**
 * Main function to detect employment gaps
 * Returns gaps of 3+ months between jobs
 */
export function detectEmploymentGaps(
  experiences: ResumeExperience[],
  education: ResumeEducation[]
): EmploymentGap[] {
  if (!experiences || experiences.length < 2) return [];

  // Parse dates and filter out entries without valid dates
  const experiencesWithDates = experiences
    .map(exp => ({
      exp,
      dates: getExperienceDates(exp)
    }))
    .filter(item => item.dates.start && item.dates.end)
    .sort((a, b) => {
      // Sort by start date, oldest first
      const aStart = dateToComparable(a.dates.start!);
      const bStart = dateToComparable(b.dates.start!);
      return aStart - bStart;
    });

  if (experiencesWithDates.length < 2) return [];

  const gaps: EmploymentGap[] = [];

  // Compare each consecutive pair of jobs
  for (let i = 0; i < experiencesWithDates.length - 1; i++) {
    const current = experiencesWithDates[i];
    const next = experiencesWithDates[i + 1];

    const currentEnd = current.dates.end!;
    const nextStart = next.dates.start!;

    // Calculate gap duration
    const gapMonths = monthsBetween(currentEnd, nextStart);

    // Only flag gaps of 3+ months
    if (gapMonths >= 3) {
      // Check if covered by education
      const educationCheck = checkEducationCoverage(currentEnd, nextStart, education);

      gaps.push({
        id: `gap-${i}-${currentEnd.year}${currentEnd.month}`,
        startDate: currentEnd,
        endDate: nextStart,
        durationMonths: gapMonths,
        previousJob: {
          company: current.exp.company,
          role: current.exp.role,
          endDate: formatDate(currentEnd)
        },
        nextJob: {
          company: next.exp.company,
          role: next.exp.role,
          startDate: formatDate(nextStart)
        },
        isOldGap: isOldGap(nextStart),
        isCoveredByEducation: educationCheck.covered,
        educationCoverage: educationCheck.coveringEducation
      });
    }
  }

  return gaps;
}

/**
 * Generate a date range string that covers the gap period
 * For pre-filling forms when user wants to add an entry to fill the gap
 */
export function generateGapCoveringDateRange(gap: EmploymentGap): {
  startMonth: string;
  startYear: string;
  endMonth: string;
  endYear: string;
  dateRange: string;
} {
  return {
    startMonth: String(gap.startDate.month),
    startYear: String(gap.startDate.year),
    endMonth: String(gap.endDate.month),
    endYear: String(gap.endDate.year),
    dateRange: `${formatDate(gap.startDate)} - ${formatDate(gap.endDate)}`
  };
}

/**
 * Generate a summary of employment gaps for the final review
 */
export function generateGapSummary(
  gaps: EmploymentGap[],
  resolutions: EmploymentGapResolutionState[]
): {
  totalGaps: number;
  addressedGaps: number;
  remainingGaps: EmploymentGap[];
  allAddressed: boolean;
  summaryText: string;
} {
  const resolvedIds = new Set(
    resolutions
      .filter(r => r.status === 'resolved' || r.status === 'dismissed')
      .map(r => r.gapId)
  );

  const remainingGaps = gaps.filter(g => !resolvedIds.has(g.id));
  const addressedGaps = gaps.length - remainingGaps.length;

  let summaryText: string;
  if (gaps.length === 0) {
    summaryText = 'No employment gaps detected';
  } else if (remainingGaps.length === 0) {
    summaryText = `${addressedGaps} gap${addressedGaps > 1 ? 's' : ''} addressed`;
  } else {
    const gapDescriptions = remainingGaps
      .slice(0, 2)
      .map(g => `${formatDate(g.startDate)} - ${formatDate(g.endDate)}`)
      .join(', ');
    summaryText = `${remainingGaps.length} gap${remainingGaps.length > 1 ? 's' : ''} remaining (${gapDescriptions})`;
  }

  return {
    totalGaps: gaps.length,
    addressedGaps,
    remainingGaps,
    allAddressed: remainingGaps.length === 0,
    summaryText
  };
}
