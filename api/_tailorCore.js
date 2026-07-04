// Shared tailoring core used by both the Vercel serverless handlers (api/*)
// and the local Express server (server/index.js). Keeping prompts, schemas,
// and Claude calls here prevents the two entry points from drifting apart.

export const TAILOR_MODEL = 'claude-sonnet-5';

export const RESUME_STYLES = [
  {
    id: 'classic',
    name: 'Classic (Reverse-Chronological)',
    bestFor: 'Steady work history, corporate roles',
    sectionOrder: ['header', 'summary', 'experience', 'education', 'skills'],
    description: 'Traditional format emphasizing career progression. Best for most candidates.'
  },
  {
    id: 'hybrid',
    name: 'Hybrid (Skills-Forward)',
    bestFor: 'Career switchers, mixed experience',
    sectionOrder: ['header', 'summary', 'skills', 'experience', 'education'],
    description: 'Leads with your strengths and transferable skills. Great for career changers.'
  },
  {
    id: 'technical',
    name: 'Technical/Early-Career (Education-Forward)',
    bestFor: 'Students, recent grads, technical roles',
    sectionOrder: ['header', 'summary', 'education', 'skills', 'experience'],
    description: 'Highlights education and projects first. Ideal for students or those with limited work history.'
  }
];

// =============================================================================
// OUTPUT SCHEMAS (structured outputs — the API guarantees responses match)
// =============================================================================

const contactSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    name: { type: 'string' },
    email: { type: 'string' },
    phone: { type: 'string' },
    location: { type: 'string' },
    linkedin: { type: 'string', description: 'Empty string if not present in the original' }
  },
  required: ['name', 'email', 'phone', 'location', 'linkedin']
};

const skillsSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    tools: { type: 'array', items: { type: 'string' }, description: 'Technical tools and technologies' },
    core: { type: 'array', items: { type: 'string' }, description: 'Core competencies and soft skills' }
  },
  required: ['tools', 'core']
};

const experienceSchema = {
  type: 'array',
  items: {
    type: 'object',
    additionalProperties: false,
    properties: {
      company: { type: 'string' },
      role: { type: 'string' },
      location: { type: 'string' },
      dateRange: { type: 'string', description: 'FULL date range in the EXACT format used in the original resume, including months if present' },
      bullets: { type: 'array', items: { type: 'string' } }
    },
    required: ['company', 'role', 'location', 'dateRange', 'bullets']
  }
};

const educationSchema = {
  type: 'array',
  items: {
    type: 'object',
    additionalProperties: false,
    properties: {
      school: { type: 'string' },
      degree: { type: 'string' },
      fieldOfStudy: { type: 'string' },
      dateRange: { type: 'string' },
      location: { type: 'string' }
    },
    required: ['school', 'degree', 'fieldOfStudy', 'dateRange', 'location']
  }
};

const certificationsSchema = {
  type: 'array',
  items: {
    type: 'object',
    additionalProperties: false,
    properties: {
      name: { type: 'string' },
      issuer: { type: 'string' },
      dateObtained: { type: 'string', description: 'EXACT format from the original resume' },
      expirationDate: { type: 'string', description: 'EXACT format from the original; empty string if none stated' },
      noExpiration: { type: 'boolean', description: 'true ONLY if explicitly stated as lifetime / no expiration' }
    },
    required: ['name', 'issuer', 'dateObtained', 'expirationDate', 'noExpiration']
  }
};


// Stage A of the tailoring pipeline: a structured hiring profile extracted
// from the job description. The rewrite (Stage B) targets this list instead
// of inferring keywords on the fly, and the keyword report is scored against it.
export const JOB_PROFILE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    roleTitle: { type: 'string', description: 'The job title as stated in the JD' },
    seniority: { type: 'string', enum: ['entry', 'mid', 'senior', 'lead', 'executive'] },
    tone: {
      type: 'string',
      enum: ['corporate', 'startup', 'technical', 'people-focused'],
      description: 'The dominant register of the JD'
    },
    topPriorities: {
      type: 'array',
      items: { type: 'string' },
      description: 'The 3-5 things this employer most wants in a hire, in priority order'
    },
    hardRequirements: {
      type: 'array',
      items: { type: 'string' },
      description: 'Non-negotiable requirements: specific certifications, licenses, degrees, years of experience, clearances'
    },
    keywords: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          term: { type: 'string', description: 'The keyword exactly as it appears in the JD' },
          type: { type: 'string', enum: ['must-have', 'nice-to-have'] },
          category: { type: 'string', description: 'e.g. tool, technical skill, soft skill, domain knowledge, certification, methodology' },
          variants: {
            type: 'array',
            items: { type: 'string' },
            description: 'Alternate forms an ATS or recruiter would also accept: abbreviations, expansions, close synonyms'
          }
        },
        required: ['term', 'type', 'category', 'variants']
      }
    },
    actionVerbs: {
      type: 'array',
      items: { type: 'string' },
      description: 'Distinctive action verbs the JD itself uses (e.g. spearheaded, drove, orchestrated)'
    }
  },
  required: ['roleTitle', 'seniority', 'tone', 'topPriorities', 'hardRequirements', 'keywords', 'actionVerbs']
};

export const ONE_PAGE_OUTPUT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    contact: contactSchema,
    summary: { type: 'string', description: 'Concise 2-3 sentence summary' },
    skills: skillsSchema,
    experience: experienceSchema,
    education: educationSchema,
    certifications: certificationsSchema,
    includeCertifications: { type: 'boolean', description: 'true only if certifications are relevant to the job' },
    includeObjective: { type: 'boolean' },
    includeProjects: { type: 'boolean' },
    includeVolunteer: { type: 'boolean' },
    includePublications: { type: 'boolean' },
    includeClinicalHours: { type: 'boolean' },
    includeLanguages: { type: 'boolean' },
    includeAwards: { type: 'boolean' }
  },
  required: [
    'contact', 'summary', 'skills', 'experience', 'education',
    'certifications', 'includeCertifications', 'includeObjective', 'includeProjects',
    'includeVolunteer', 'includePublications', 'includeClinicalHours',
    'includeLanguages', 'includeAwards'
  ]
};

// The full resume shape is too structurally complex for structured outputs
// ("compiled grammar is too large" — verified against the live API), so
// Stage B and the revision pass are prompt-guided instead: this template plus
// parse-and-retry, with the deterministic verification layer downstream.
const RESUME_JSON_TEMPLATE = `Respond with ONLY a valid JSON object — no markdown, no code fences, no commentary — matching exactly this structure:
{
  "contact": {"name": "", "email": "", "phone": "", "location": "", "linkedin": ""},
  "summary": "",
  "objective": "", "includeObjective": false,
  "skills": {"tools": [], "core": []},
  "experience": [{"company": "", "role": "", "location": "", "dateRange": "", "bullets": [""]}],
  "education": [{"school": "", "degree": "", "fieldOfStudy": "", "dateRange": "", "location": ""}],
  "projects": [{"name": "", "dateRange": "", "description": "", "technologies": ""}], "includeProjects": false,
  "certifications": [{"name": "", "issuer": "", "dateObtained": "", "expirationDate": "", "noExpiration": false}], "includeCertifications": false,
  "clinicalHours": [{"siteName": "", "role": "", "hoursCompleted": 0, "description": ""}], "includeClinicalHours": false,
  "volunteer": [{"organization": "", "role": "", "dateRange": "", "description": ""}], "includeVolunteer": false,
  "publications": [{"title": "", "publication": "", "date": ""}], "includePublications": false,
  "languages": [], "includeLanguages": false,
  "awards": [{"title": "", "issuer": "", "date": "", "description": ""}], "includeAwards": false
}
Each include* boolean is true only if that section exists in the original resume; sections that don't exist get an empty array. Use real booleans and numbers, never strings like "true".`;

// =============================================================================
// PROMPT BUILDERS
// =============================================================================

const JD_ANALYSIS_SYSTEM_PROMPT = `You are an expert technical recruiter and ATS analyst. You extract a structured hiring profile from a job description so a resume can be precisely tailored to it.

Rules:
- must-have: explicitly required ("required", "must", "minimum") or clearly central to the day-to-day role. nice-to-have: "preferred", "plus", "bonus", or peripheral.
- For each keyword, list variants an ATS or skimming recruiter would also accept: abbreviations and expansions ("CRM" / "customer relationship management"), common alternate spellings, and close synonyms the JD itself would recognize.
- Variants must be alternate NAMES for the SAME thing — never a related or adjacent skill. "K8s" is a variant of Kubernetes; "Docker" or "containers" is NOT. "GA" is a variant of Google Analytics; "analytics" is NOT.
- Skip generic filler ("team player", "fast-paced environment") unless the JD genuinely emphasizes it.
- Aim for 12-25 keywords: comprehensive enough to drive a rewrite, focused enough that every keyword matters.
- hardRequirements is only for non-negotiables a resume must show verbatim: named certifications, licenses, degrees, years of experience, clearances.
- topPriorities: read between the lines — what 3-5 things will get this resume past the first screen?`;

function buildJdAnalysisPrompts(jobDescription, companyName) {
  const userPrompt = `Extract the hiring profile from this job description for a role at ${companyName}.

JOB DESCRIPTION:
${jobDescription}`;

  return { systemPrompt: JD_ANALYSIS_SYSTEM_PROMPT, userPrompt };
}

const TAILOR_SYSTEM_PROMPT = `You are a professional resume writer and ATS (Applicant Tracking System) optimization expert. You reframe the candidate's existing experience using the vocabulary, action verbs, and terminology of a specific job description — same facts, better-aligned language. The result must read naturally to a recruiter and remain 100% defensible in an interview.

TRUTH GUARDRAILS (highest priority — never violate):
1. Never fabricate responsibilities, achievements, or experiences not stated or directly implied by the original resume.
2. Never change job titles, company names, dates, or quantified metrics. Keep all numbers exact; never invent new metrics, percentages, or dollar amounts.
3. Keyword boundary: you may only claim a tool, technology, or skill if the original resume states it or unambiguously implies it (e.g. "built React components" implies JavaScript). If a JD keyword cannot be truthfully claimed, leave it out of the resume and list it under report.gaps instead.
4. The rewrite is a more favorable telling of the SAME truth, not a different story.

DATE PRESERVATION:
- Reproduce every date in the EXACT format used in the original — "02/2010" stays "02/2010", "March 2020" stays "March 2020", "Q1 2022" stays "Q1 2022".
- Keep full ranges including months and "Present" markers. Never drop the end of a range.
- Certifications/licenses: capture dateObtained and any expiration ("Exp:", "Expires:", "Valid through", "Valid until"). A single date on a certification is the dateObtained. Set noExpiration true only if explicitly stated.

SECTION PRESERVATION:
- Every section in the original must appear in the output. Watch for field-specific sections: Clinical Hours, Rotations, Licenses, Bar Admissions, Publications, Research, Teaching, Portfolios, Series Licenses, Volunteer Work, Languages, Awards, Memberships.
- Before finishing, cross-check that no original section was dropped or merged away.

WRITING QUALITY:
- Every bullet starts with a strong action verb (never "Was responsible for"), is unique, grammatically complete, and consistently punctuated.
- Past tense for previous roles, present tense for the current role. Parallel structure within each role's bullets.
- Proper capitalization of companies, titles, technologies, and certifications. No typos, fragments, or cut-off text.

TONE MATCHING:
Mirror the JD's register — polished corporate language for formal JDs, dynamic energetic phrasing for startup JDs, technical precision for spec-heavy JDs, collaboration-forward language for people-focused JDs.`;

function buildTailorPrompts(resumeText, jobDescription, companyName, mode, resumeStyle, jobProfile, objective = null) {
  const styleInfo = RESUME_STYLES.find(s => s.id === resumeStyle) || RESUME_STYLES[0];

  const modeInstructions = mode === 'conservative'
    ? `REWRITE MODE: CONSERVATIVE
- Preserve the original sentence structure; make targeted verb swaps and synonym replacements (roughly 1-2 word changes per bullet).
- Inject profile keywords freely into the skills and summary sections; keep experience bullets close to the original flow.
- Keep each role's bullets in their original order.
- When in doubt, prioritize fidelity to the original wording over optimization.`
    : `REWRITE MODE: AGGRESSIVE
- Fully rephrase bullets to maximize alignment with the profile; front-load keywords and the JD's action verbs.
- Combine or split bullets where it improves keyword density; convert passive voice to active using the JD's verbs.
- Reorder each role's bullets so the most job-relevant achievements come first — recruiters read the top 2-3 bullets of each role.
- Push favorable interpretation as far as it can go while staying within the truth guardrails. Every bullet should feel written for this JD.`;

  const userPrompt = `Tailor the following resume for a role at ${companyName}.

A recruiter's analysis of this job description has already been done. This JOB PROFILE is your target — the rewrite succeeds or fails on how many of these keywords you truthfully work in:

JOB PROFILE:
${JSON.stringify(jobProfile, null, 2)}

Instructions:
1. Work through the profile's must-have keywords first, then nice-to-haves. For each one the original resume supports, weave the term (or one of its listed variants) into the summary, skills, or a specific experience bullet — into the sentence structure, never appended as a list.
2. Use the profile's actionVerbs to replace weaker verbs where the candidate genuinely did that kind of work.
3. Address the profile's topPriorities in the summary — open it with the candidate's 2-3 strongest matches to those priorities, so a recruiter skimming for six seconds sees the fit immediately.
4. If a hardRequirement (certification, license, degree, years) exists in the original resume, make sure it is stated prominently and verbatim.
5. Match the profile's tone: ${jobProfile.tone}.

Your output will be automatically scanned for the profile's keywords, so use the exact terms (or their listed variants) — paraphrases won't register with an ATS either.

${modeInstructions}
${objective ? `
CANDIDATE'S STATED CAREER OBJECTIVE: "${objective}"
Prioritize experiences aligned with this objective and use language that bridges past experience to that direction.
` : ''}
RESUME STYLE: ${styleInfo.name} (best for: ${styleInfo.bestFor})
Section order: ${styleInfo.sectionOrder.join(' → ')}. Tailor content emphasis accordingly.

ORIGINAL RESUME:
${resumeText}

JOB DESCRIPTION:
${jobDescription}

${RESUME_JSON_TEMPLATE}`;

  return { systemPrompt: TAILOR_SYSTEM_PROMPT, userPrompt };
}

const COVER_LETTER_SYSTEM_PROMPT = `You are a professional cover letter writer. You write high-impact, one-page cover letters in proper business-letter format (greeting, 3-4 body paragraphs, closing) that connect a candidate's real experience to a specific job description.

Rules:
- Use only facts from the candidate's resume — never invent experience, metrics, or skills.
- Mirror the job description's key terminology naturally.
- Open with a strong hook specific to this company and role; close with a confident call to action.
- No placeholders like "[Company Address]" — write a letter that is ready to send as-is.
- Respond with ONLY the letter text, no preamble or commentary.`;

function buildCoverLetterPrompts(resumeText, jobDescription, companyName, objective = null) {
  const userPrompt = `Write a cover letter to ${companyName} for the role described below.
${objective ? `
The candidate's stated career objective: "${objective}"
Weave this narrative into the opening, address any career transition positively, and frame the move confidently — focus on what they bring.
` : ''}
CANDIDATE'S RESUME:
${resumeText}

JOB DESCRIPTION:
${jobDescription}`;

  return { systemPrompt: COVER_LETTER_SYSTEM_PROMPT, userPrompt };
}

const ONE_PAGE_SYSTEM_PROMPT = `You are condensing a multi-page resume into a one-page version while preserving ATS optimization. The output must fit on ONE PAGE when rendered as a PDF with 0.75" margins, 10pt body font, and standard spacing.

HARD LIMITS: max 3-4 roles, 3-4 bullets per role, 2-3 sentence summary, max 8-10 items per skills list, 1-2 education entries (one line each), max 2-3 certifications (only if relevant).

KEEP: quantified achievements; tools and skills matching the job requirements; recent experience (last 5-7 years); relevant leadership and cross-functional work.
CUT: objectives and references; older roles (10+ years) unless highly relevant; generic undifferentiating bullets; skills already demonstrated in experience; volunteer/publications/awards unless directly relevant.

DATE PRESERVATION: reproduce dates in the EXACT original format, including months and full ranges.

TRUTH GUARDRAILS: never fabricate; never add tools or skills not in the original; never change titles, companies, dates, or metrics. This is a CONDENSED version of the SAME truth. When in doubt, cut rather than keep.`;

function buildOnePagePrompts(resumeData, jobDescription, jobProfile = null) {
  const mustKeep = jobProfile?.keywords
    ?.filter(kw => kw.type === 'must-have')
    .map(kw => kw.term);

  const userPrompt = `Convert this resume to a one-page version optimized for the job description. Select the most impactful, most relevant content.
${mustKeep?.length ? `
MUST-HAVE KEYWORDS — wherever these appear in the resume, the condensed version must retain at least one mention of each (condensing must never cost the candidate a must-have keyword):
${mustKeep.map(t => `- ${t}`).join('\n')}
` : ''}
RESUME DATA:
${JSON.stringify(resumeData, null, 2)}

JOB DESCRIPTION:
${jobDescription}`;

  return { systemPrompt: ONE_PAGE_SYSTEM_PROMPT, userPrompt };
}

const GAP_SUGGESTION_SYSTEM_PROMPT = `You are helping a candidate address a skill from a job description that their resume doesn't mention. The candidate will review your suggestion and must confirm it is true before it is added — so write something they can honestly say yes to, not something impressive.

CRITICAL RULES:
- Ground the suggestion in their actual experience: only claim what their existing resume makes plausible.
- Never invent metrics, numbers, tools, or specific accomplishments not supported by their background.
- Calibrate the strength of the claim to the strength of the evidence: if their background only loosely supports the skill, use honest framing like "supported", "contributed to", "exposure to", or "familiarity with" rather than "led" or "expert in".
- If their background gives you nothing to connect the skill to, produce the most modest truthful phrasing possible — the candidate can strengthen it themselves if they have unlisted experience.
- Match the tone and style of their existing resume. Keep it professional and concise.`;

export function buildGapSuggestionPrompts(skill, resume, targetSection, jobDescription) {
  const resumeContext = `
Name: ${resume.contact?.name || 'Unknown'}
Summary: ${resume.summary || ''}
Skills: ${[...(resume.skills?.tools || []), ...(resume.skills?.core || [])].join(', ')}
Experience:
${(resume.experience || []).map(exp => `- ${exp.role} at ${exp.company}: ${(exp.bullets || []).join('; ')}`).join('\n')}
`;

  const sectionGuidance = {
    skills: 'Generate a single skill phrase (2-5 words) that could be added to the skills section. Just the skill name/phrase, no explanation.',
    experience: 'Generate a single bullet point (one sentence) that demonstrates this skill, starting with an action verb whose strength matches the evidence in their background. The bullet should sound natural alongside the existing experience.',
    summary: 'Generate a brief phrase (5-15 words) that could be naturally inserted into the professional summary to mention this skill. Just the phrase, no full sentences needed.'
  };

  const userPrompt = `The candidate's resume is missing this skill from the job description: "${skill}"

Current resume context:
${resumeContext}

Job description excerpt (for context):
${jobDescription.substring(0, 500)}...

Target section: ${targetSection}
${sectionGuidance[targetSection]}

Respond with ONLY the suggested text, no quotes, no explanation.`;

  return { systemPrompt: GAP_SUGGESTION_SYSTEM_PROMPT, userPrompt };
}

// =============================================================================
// DETERMINISTIC VERIFICATION (no model involved)
// =============================================================================

/**
 * Flatten a tailored resume object into named text sections for keyword scanning.
 */
function resumeSections(resume) {
  const sections = {
    Summary: [resume.summary, resume.includeObjective ? resume.objective : ''].filter(Boolean).join('\n'),
    Skills: [...(resume.skills?.tools || []), ...(resume.skills?.core || [])].join('\n'),
    Experience: (resume.experience || [])
      .map(e => [e.role, e.company, ...(e.bullets || [])].join('\n'))
      .join('\n'),
    Education: (resume.education || [])
      .map(e => [e.school, e.degree, e.fieldOfStudy].filter(Boolean).join('\n'))
      .join('\n'),
  };
  if (resume.includeCertifications && resume.certifications?.length) {
    sections.Certifications = resume.certifications.map(c => `${c.name} ${c.issuer}`).join('\n');
  }
  if (resume.includeProjects && resume.projects?.length) {
    sections.Projects = resume.projects.map(p => [p.name, p.description, p.technologies].join('\n')).join('\n');
  }
  const other = [
    resume.includeVolunteer && (resume.volunteer || []).map(v => `${v.role} ${v.organization} ${v.description}`).join('\n'),
    resume.includePublications && (resume.publications || []).map(p => `${p.title} ${p.publication}`).join('\n'),
    resume.includeClinicalHours && (resume.clinicalHours || []).map(c => `${c.role} ${c.siteName} ${c.description}`).join('\n'),
    resume.includeLanguages && (resume.languages || []).join('\n'),
    resume.includeAwards && (resume.awards || []).map(a => `${a.title} ${a.issuer} ${a.description}`).join('\n'),
  ].filter(Boolean).join('\n');
  if (other) sections.Other = other;
  return sections;
}

function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Word-boundary keyword match, tolerant of case and simple plurals.
 * Uses non-alphanumeric lookarounds instead of \b so terms like "C++",
 * ".NET", or "CI/CD" match correctly.
 */
function termMatches(text, term) {
  if (!term) return false;
  const pattern = new RegExp(`(?<![A-Za-z0-9])${escapeRegExp(term)}(?:s|es)?(?![A-Za-z0-9])`, 'i');
  return pattern.test(text);
}

function keywordVariants(keyword) {
  return [keyword.term, ...(keyword.variants || [])].filter(Boolean);
}

/**
 * Score the tailored resume against the job profile's keyword list.
 * Returns the report in the shape the frontend already consumes.
 */
export function buildKeywordReport(jobProfile, resume) {
  const sections = resumeSections(resume);
  const keywords = (jobProfile.keywords || []).map(kw => {
    const foundIn = Object.entries(sections)
      .filter(([, text]) => keywordVariants(kw).some(v => termMatches(text, v)))
      .map(([name]) => name);
    return { term: kw.term, type: kw.type, category: kw.category, foundIn };
  });
  return {
    keywords,
    gaps: keywords.filter(k => k.foundIn.length === 0).map(k => k.term),
  };
}

/**
 * Weighted keyword coverage (must-have ×3, nice-to-have ×1) of arbitrary text,
 * as a 0-100 score. Used to compare the original resume vs the tailored one.
 */
export function scoreCoverage(jobProfile, text) {
  let total = 0;
  let matched = 0;
  for (const kw of jobProfile.keywords || []) {
    const weight = kw.type === 'must-have' ? 3 : 1;
    total += weight;
    if (keywordVariants(kw).some(v => termMatches(text, v))) matched += weight;
  }
  return total === 0 ? 0 : Math.round((matched / total) * 100);
}

function normalizeForFactCheck(text) {
  return text
    .toLowerCase()
    .replace(/[‐-―]/g, '-') // fancy dashes → hyphen
    .replace(/\s+/g, ' ');
}

/**
 * Guard against fabrication: every number, company, title, and date range in
 * the tailored resume must be traceable to the original resume text.
 * Returns human-readable warnings (empty array = clean).
 */
export function checkFacts(originalResumeText, resume) {
  const warnings = [];
  const original = normalizeForFactCheck(originalResumeText);
  const originalNumbers = new Set((original.match(/\d[\d,.]*/g) || []).map(n => n.replace(/[,.]+$/, '').replace(/,/g, '')));

  const generatedText = [
    resume.summary,
    ...(resume.experience || []).flatMap(e => e.bullets || []),
  ].filter(Boolean).join('\n');

  for (const num of new Set(normalizeForFactCheck(generatedText).match(/\d[\d,.]*/g) || [])) {
    const cleaned = num.replace(/[,.]+$/, '').replace(/,/g, '');
    if (!originalNumbers.has(cleaned)) {
      warnings.push(`Metric "${num}" does not appear in the original resume — verify before sending.`);
    }
  }

  // Tools are concrete, named technologies — if one shows up in the tailored
  // skills list without appearing anywhere in the original, the candidate
  // should confirm it before sending. (Core/soft skills are rephrased freely,
  // so they aren't checked.)
  for (const tool of resume.skills?.tools || []) {
    if (!termMatches(originalResumeText, tool) && !original.includes(normalizeForFactCheck(tool))) {
      warnings.push(`Skill "${tool}" was added to the skills section but isn't stated in the original resume — confirm you have this experience.`);
    }
  }

  for (const exp of resume.experience || []) {
    if (exp.company && !original.includes(normalizeForFactCheck(exp.company))) {
      warnings.push(`Company "${exp.company}" not found verbatim in the original resume.`);
    }
    if (exp.role && !original.includes(normalizeForFactCheck(exp.role))) {
      warnings.push(`Job title "${exp.role}" differs from the original resume.`);
    }
    if (exp.dateRange && !original.includes(normalizeForFactCheck(exp.dateRange))) {
      warnings.push(`Date range "${exp.dateRange}" for ${exp.company} differs from the original resume.`);
    }
  }

  return warnings;
}

/**
 * Must-have keywords the tailored resume is missing even though the ORIGINAL
 * resume contains them — clear misses that are safe to fix in a revision pass.
 */
function missedTruthfulMustHaves(jobProfile, originalResumeText, report) {
  const missing = new Set(report.gaps);
  return (jobProfile.keywords || []).filter(kw =>
    kw.type === 'must-have' &&
    missing.has(kw.term) &&
    keywordVariants(kw).some(v => termMatches(originalResumeText, v))
  );
}

// =============================================================================
// CLAUDE CALLS
// =============================================================================

function extractText(response) {
  if (response.stop_reason === 'refusal') {
    throw new Error('Model declined the request');
  }
  if (response.stop_reason === 'max_tokens') {
    throw new Error('Response truncated at max_tokens');
  }
  const textContent = response.content.find(block => block.type === 'text');
  if (!textContent) {
    throw new Error('No text content in model response');
  }
  return textContent.text.trim();
}

function parseJson(text) {
  // Structured outputs guarantee valid JSON, but strip fences defensively
  let jsonText = text;
  if (jsonText.startsWith('```json')) jsonText = jsonText.slice(7);
  else if (jsonText.startsWith('```')) jsonText = jsonText.slice(3);
  if (jsonText.endsWith('```')) jsonText = jsonText.slice(0, -3);
  return JSON.parse(jsonText.trim());
}

async function withOneRetry(fn) {
  try {
    return await fn();
  } catch (error) {
    // Don't retry auth/config failures — they won't succeed the second time
    if (error.status === 401 || error.status === 403) throw error;
    console.warn('Claude call failed, retrying once:', error.message);
    return await fn();
  }
}

function createJsonCall(anthropic, { systemPrompt, userPrompt, schema, maxTokens }) {
  return withOneRetry(async () => {
    const response = await anthropic.messages.create({
      model: TAILOR_MODEL,
      max_tokens: maxTokens,
      // Adaptive thinking is on by default on this model; keep it off so cost
      // and latency stay comparable to the previous setup.
      thinking: { type: 'disabled' },
      output_config: { format: { type: 'json_schema', schema } },
      system: [{ type: 'text', text: systemPrompt, cache_control: { type: 'ephemeral' } }],
      messages: [{ role: 'user', content: userPrompt }],
    });
    return parseJson(extractText(response));
  });
}

// JSON via prompt template instead of structured outputs — for shapes too
// complex to grammar-compile. JSON.parse failures reject and trigger the retry.
function createFreeJsonCall(anthropic, { systemPrompt, userPrompt, maxTokens }) {
  return withOneRetry(async () => {
    const response = await anthropic.messages.create({
      model: TAILOR_MODEL,
      max_tokens: maxTokens,
      thinking: { type: 'disabled' },
      system: [{ type: 'text', text: systemPrompt, cache_control: { type: 'ephemeral' } }],
      messages: [{ role: 'user', content: userPrompt }],
    });
    return parseJson(extractText(response));
  });
}

function createTextCall(anthropic, { systemPrompt, userPrompt, maxTokens }) {
  return withOneRetry(async () => {
    const response = await anthropic.messages.create({
      model: TAILOR_MODEL,
      max_tokens: maxTokens,
      thinking: { type: 'disabled' },
      system: [{ type: 'text', text: systemPrompt, cache_control: { type: 'ephemeral' } }],
      messages: [{ role: 'user', content: userPrompt }],
    });
    return extractText(response);
  });
}

function buildRevisionPrompts(resume, missedKeywords, jobProfile) {
  const missedList = missedKeywords
    .map(kw => `- "${kw.term}" (${kw.category}${kw.variants?.length ? `; also acceptable: ${kw.variants.join(', ')}` : ''})`)
    .join('\n');

  const userPrompt = `This tailored resume is missing must-have keywords from the job profile even though the candidate's ORIGINAL resume shows they can truthfully claim them:

${missedList}

Revise the resume to weave each of these terms (exact term or a listed acceptable variant) naturally into the summary, skills, or a relevant experience bullet. Change ONLY what is needed to include these keywords — leave everything else exactly as it is, including all dates, companies, titles, and metrics.

CURRENT TAILORED RESUME:
${JSON.stringify(resume, null, 2)}

JOB PROFILE TONE: ${jobProfile.tone}

Respond with ONLY a valid JSON object in exactly the same structure as CURRENT TAILORED RESUME — no markdown, no code fences, no commentary.`;

  return { systemPrompt: TAILOR_SYSTEM_PROMPT, userPrompt };
}

/**
 * Extract a structured hiring profile from a job description (Stage A).
 */
export function analyzeJobDescription(anthropic, { jobDescription, companyName }) {
  const prompts = buildJdAnalysisPrompts(jobDescription, companyName);
  return createJsonCall(anthropic, { ...prompts, schema: JOB_PROFILE_SCHEMA, maxTokens: 3000 });
}

/**
 * Run the full tailoring pipeline:
 *   Stage A — analyze the JD into a structured keyword/priority profile.
 *   Stage B — rewrite the resume against that explicit profile.
 *   Verify  — keyword report, match score, and fact-guard computed in code;
 *             one targeted revision pass if must-have keywords the original
 *             resume supports didn't make it into the output.
 * The cover letter only needs the raw resume + JD, so it runs in parallel
 * with both stages.
 * Returns { resume, coverLetter, report, jobProfile, matchScore, warnings }.
 */
export async function runTailor(anthropic, { resumeText, jobDescription, companyName, mode, resumeStyle, objective }) {
  const coverPrompts = buildCoverLetterPrompts(resumeText, jobDescription, companyName, objective);
  const coverLetterPromise = createTextCall(anthropic, { ...coverPrompts, maxTokens: 2048 });
  // If Stage A throws before Promise.all observes this promise, don't let its
  // rejection go unhandled; Promise.all below still receives the real result.
  coverLetterPromise.catch(() => {});

  const jobProfile = await analyzeJobDescription(anthropic, { jobDescription, companyName });

  const tailorPrompts = buildTailorPrompts(resumeText, jobDescription, companyName, mode, resumeStyle, jobProfile, objective);
  let [resume, coverLetter] = await Promise.all([
    createFreeJsonCall(anthropic, { ...tailorPrompts, maxTokens: 16000 }),
    coverLetterPromise,
  ]);

  let report = buildKeywordReport(jobProfile, resume);

  // One revision pass, only for clear misses: must-have keywords present in
  // the ORIGINAL resume that didn't survive into the tailored output.
  const missed = missedTruthfulMustHaves(jobProfile, resumeText, report);
  if (missed.length > 0) {
    try {
      const revisionPrompts = buildRevisionPrompts(resume, missed, jobProfile);
      resume = await createFreeJsonCall(anthropic, { ...revisionPrompts, maxTokens: 16000 });
      report = buildKeywordReport(jobProfile, resume);
    } catch (error) {
      // The unrevised resume is still valid — don't fail the request over polish
      console.warn('Revision pass failed, returning unrevised resume:', error.message);
    }
  }

  const matchScore = {
    before: scoreCoverage(jobProfile, resumeText),
    after: scoreCoverage(jobProfile, Object.values(resumeSections(resume)).join('\n')),
  };

  const warnings = checkFacts(resumeText, resume);
  if (warnings.length > 0) {
    console.warn(`Fact-guard flagged ${warnings.length} item(s):`, warnings.join(' | '));
  }

  return { resume, coverLetter, report, jobProfile, matchScore, warnings };
}

/**
 * Condense a tailored resume to a one-page version. When the tailor pipeline's
 * jobProfile is provided, must-have keywords are protected from being cut.
 * Returns the resume data object.
 */
export function runOnePage(anthropic, { resumeData, jobDescription, jobProfile = null }) {
  const prompts = buildOnePagePrompts(resumeData, jobDescription, jobProfile);
  return createJsonCall(anthropic, { ...prompts, schema: ONE_PAGE_OUTPUT_SCHEMA, maxTokens: 8192 });
}
