import express from 'express';
import cors from 'cors';
import Anthropic from '@anthropic-ai/sdk';
import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Validate required environment variables
if (!process.env.ANTHROPIC_API_KEY) {
  console.error('ERROR: ANTHROPIC_API_KEY environment variable is required');
  process.exit(1);
}

// Initialize Anthropic client (server-side only - key never exposed to frontend)
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// =============================================================================
// RATE LIMITING (10 requests per minute per IP)
// =============================================================================
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 10;

function rateLimit(req, res, next) {
  const ip = req.ip || req.connection.remoteAddress || 'unknown';
  const now = Date.now();

  if (!rateLimitMap.has(ip)) {
    rateLimitMap.set(ip, { count: 1, windowStart: now });
    return next();
  }

  const record = rateLimitMap.get(ip);

  // Reset window if expired
  if (now - record.windowStart > RATE_LIMIT_WINDOW_MS) {
    rateLimitMap.set(ip, { count: 1, windowStart: now });
    return next();
  }

  // Check if over limit
  if (record.count >= RATE_LIMIT_MAX_REQUESTS) {
    return res.status(429).json({
      error: 'Too many requests. Please wait a minute before trying again.',
    });
  }

  // Increment count
  record.count++;
  next();
}

// Clean up old rate limit entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [ip, record] of rateLimitMap.entries()) {
    if (now - record.windowStart > RATE_LIMIT_WINDOW_MS * 2) {
      rateLimitMap.delete(ip);
    }
  }
}, 5 * 60 * 1000);

// =============================================================================
// INPUT VALIDATION & SANITIZATION
// =============================================================================
const MAX_RESUME_LENGTH = 50000; // ~50KB of text
const MAX_JOB_DESC_LENGTH = 30000; // ~30KB of text
const MAX_COMPANY_NAME_LENGTH = 200;

function sanitizeString(str) {
  if (typeof str !== 'string') return '';
  // Remove null bytes and control characters (except newlines and tabs)
  return str
    .replace(/\0/g, '')
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    .trim();
}

function validateTailorRequest(req, res, next) {
  const { resumeText, jobDescription, companyName, mode, resumeStyle, objective } = req.body;

  // Check required fields
  if (!resumeText || !jobDescription || !companyName) {
    return res.status(400).json({
      error: 'Missing required fields: resumeText, jobDescription, and companyName are required.',
    });
  }

  // Validate types
  if (typeof resumeText !== 'string' || typeof jobDescription !== 'string' || typeof companyName !== 'string') {
    return res.status(400).json({
      error: 'Invalid field types. All text fields must be strings.',
    });
  }

  // Check lengths
  if (resumeText.length > MAX_RESUME_LENGTH) {
    return res.status(400).json({
      error: `Resume text exceeds maximum length of ${MAX_RESUME_LENGTH} characters.`,
    });
  }

  if (jobDescription.length > MAX_JOB_DESC_LENGTH) {
    return res.status(400).json({
      error: `Job description exceeds maximum length of ${MAX_JOB_DESC_LENGTH} characters.`,
    });
  }

  if (companyName.length > MAX_COMPANY_NAME_LENGTH) {
    return res.status(400).json({
      error: `Company name exceeds maximum length of ${MAX_COMPANY_NAME_LENGTH} characters.`,
    });
  }

  // Validate mode
  const validModes = ['conservative', 'aggressive'];
  if (mode && !validModes.includes(mode)) {
    return res.status(400).json({
      error: 'Invalid mode. Must be "conservative" or "aggressive".',
    });
  }

  // Validate resumeStyle
  const validStyles = ['classic', 'hybrid', 'technical'];
  if (resumeStyle && !validStyles.includes(resumeStyle)) {
    return res.status(400).json({
      error: 'Invalid resumeStyle. Must be "classic", "hybrid", or "technical".',
    });
  }

  // Objective is optional, but if provided must be string
  if (objective && typeof objective !== 'string') {
    return res.status(400).json({
      error: 'Invalid objective. Must be a string.',
    });
  }

  // Sanitize inputs
  req.body.resumeText = sanitizeString(resumeText);
  req.body.jobDescription = sanitizeString(jobDescription);
  req.body.companyName = sanitizeString(companyName);
  req.body.mode = mode || 'conservative';
  req.body.resumeStyle = resumeStyle || 'classic';
  req.body.objective = objective ? sanitizeString(objective) : null;

  next();
}

function validateGapSuggestionRequest(req, res, next) {
  const { skill, resume, targetSection, jobDescription } = req.body;

  if (!skill || !resume || !targetSection || !jobDescription) {
    return res.status(400).json({
      error: 'Missing required fields: skill, resume, targetSection, and jobDescription are required.',
    });
  }

  if (typeof skill !== 'string') {
    return res.status(400).json({
      error: 'Invalid field type. skill must be a string.',
    });
  }

  const validSections = ['skills', 'experience', 'summary'];
  if (!validSections.includes(targetSection)) {
    return res.status(400).json({
      error: 'Invalid targetSection. Must be "skills", "experience", or "summary".',
    });
  }

  // Sanitize
  req.body.skill = sanitizeString(skill);
  req.body.jobDescription = sanitizeString(jobDescription);

  next();
}

// =============================================================================
// MIDDLEWARE
// =============================================================================
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  methods: ['POST'],
  allowedHeaders: ['Content-Type'],
}));

app.use(express.json({ limit: '1mb' }));
app.use(rateLimit);

// =============================================================================
// PROMPT BUILDERS (moved from frontend)
// =============================================================================
const RESUME_STYLES = [
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

function buildTailorPrompts(resumeText, jobDescription, companyName, mode, resumeStyle, objective = null) {
  const styleInfo = RESUME_STYLES.find(s => s.id === resumeStyle) || RESUME_STYLES[0];

  const systemPrompt = `You are a professional resume writer and ATS (Applicant Tracking System) optimization expert. Your job is to take the candidate's existing experience and reframe it using the exact vocabulary, action verbs, and terminology from the job description. Think of it as translation - same meaning, different words that resonate with this specific employer. Be aggressive with synonym replacement and phrasing updates, but never invent new responsibilities or skills.

You must respond ONLY with valid JSON - no markdown, no code blocks, no explanation text.

CRITICAL DATE PRESERVATION:
- Extract and preserve ALL date information with extreme precision
- PRESERVE THE EXACT DATE FORMAT from the original resume - DO NOT convert formats
  Examples of format preservation:
  - "02/2010" stays as "02/2010" (NOT "Feb 2010" or "February 2010")
  - "March 2020" stays as "March 2020" (NOT "03/2020" or "Mar 2020")
  - "2019-05" stays as "2019-05" (NOT "May 2019")
  - "Q1 2022" stays as "Q1 2022" (NOT "January 2022")
- If an entry says "May 2024 – December 2025", return the FULL range, not just "May 2024"
- If months are present in the source, they MUST appear in the output
- Check for "Present" or current employment indicators

CERTIFICATION & LICENSE DATE EXTRACTION - CRITICAL:
- For certifications and licenses, extract ALL dates with extreme care:
  - dateObtained: When the certification was earned/issued
  - expirationDate: When the certification expires (CRITICAL for healthcare, legal, financial licenses)
  - noExpiration: Set to true ONLY if explicitly stated "No Expiration", "Does Not Expire", "Lifetime", or similar
- Common certification date patterns to look for:
  - "Issued: 03/2020, Expires: 03/2025"
  - "Valid through 12/2026"
  - "Obtained January 2019 (Expires January 2024)"
  - "RN License #12345, Exp: 08/2025"
- PRESERVE the exact format of certification dates from the original
- If only one date is shown for a certification, it is typically the dateObtained
- Look for expiration indicators: "Exp:", "Expires:", "Valid through", "Valid until", "Renewal date"

═══════════════════════════════════════════════════════════════
SECTION PRESERVATION RULES - ABSOLUTELY CRITICAL
═══════════════════════════════════════════════════════════════

You MUST preserve EVERY section from the original resume, even if it doesn't match standard categories:
- Sections to ALWAYS look for and include: Certifications, Licenses, Clinical Hours, Practicum, Fieldwork, Internships, Volunteer Work, Publications, Languages, Awards, Honors, Professional Memberships, Conferences, Research, Teaching Experience
- If a section exists in the original resume, it MUST appear in the output - NEVER drop or merge sections
- If you're unsure what category something belongs to, include it in an appropriate section or create an 'Additional Information' section
- Before finalizing your response, CROSS-CHECK that every section header from the original appears in your output
- The "additionalSections" field in your JSON output should capture any non-standard sections from the original resume

═══════════════════════════════════════════════════════════════
FIELD-SPECIFIC SECTIONS - NEVER DROP
═══════════════════════════════════════════════════════════════

• Healthcare: Clinical Hours, Rotations, Licenses, CME Credits, Certifications (RN, CNA, etc.)
• Legal: Bar Admissions, Case Experience, Pro Bono, Court Appearances
• Academic: Publications, Research, Teaching Experience, Grants, Conference Presentations
• Technical: Projects, GitHub/Portfolio, Patents, Open Source Contributions
• Creative: Portfolio, Exhibitions, Published Work, Shows/Performances
• Finance: Series Licenses (7, 63, 65), CPA, CFA designations

If original has ANY section you don't recognize, include it verbatim in the appropriate output field.

═══════════════════════════════════════════════════════════════
GRAMMAR AND FORMATTING RULES - MANDATORY
═══════════════════════════════════════════════════════════════

- Every bullet point MUST be a complete, grammatically correct sentence or phrase
- Check for and FIX: run-on sentences, sentence fragments, subject-verb agreement, tense consistency
- Use CONSISTENT TENSE: past tense for previous roles, present tense for current role
- Every bullet point should end with proper punctuation (period for complete sentences)
- NO overlapping or repeated text - each bullet must be UNIQUE
- NO orphaned words or cut-off sentences
- PROOFREAD the summary/objective for complete sentences and proper punctuation
- Ensure PROPER CAPITALIZATION of company names, job titles, technologies, and certifications
- DOUBLE-CHECK all output for typos and grammatical errors before returning
- Each bullet should START with a strong action verb

═══════════════════════════════════════════════════════════════
FINAL QUALITY CHECK - MANDATORY BEFORE RESPONDING
═══════════════════════════════════════════════════════════════

Before returning your response, verify:
• Every bullet starts with a STRONG ACTION VERB (Developed, Led, Implemented, not "Was responsible for")
• PARALLEL STRUCTURE within each job's bullets (all start same way grammatically)
• CONSISTENT PUNCTUATION (all periods or no periods - pick one and stick with it)
• NO RUN-ON SENTENCES or sentence fragments
• COMPLETE SENTENCES in summary/objective section
• PROPER BUSINESS LETTER FORMAT for cover letter (greeting, body paragraphs, closing)
• NO TYPOS, grammar errors, or cut-off text
• ALL DATES preserved exactly as in original (including months if present)

ABSOLUTE GUARDRAILS - NEVER VIOLATE:
1. NEVER fabricate responsibilities, achievements, or experiences not implied by the original
2. NEVER add tools, technologies, or skills not reasonably connected to what's already on the resume
3. NEVER change job titles, company names, dates, or quantified metrics (keep ALL numbers exact)
4. NEVER invent specific metrics, percentages, or dollar amounts
5. The rewrite must be a MORE FAVORABLE telling of the SAME TRUTH, not a different story

Your rewrites should make the candidate sound polished and aligned with the JD, while remaining 100% defensible in an interview.`;

  const userPrompt = `Parse the following resume and job description for ${companyName}, then:

1. ANALYZE the job description for specific vocabulary, action verbs, and phrasing patterns
2. IDENTIFY top keywords and terminology unique to this JD
3. REWRITE the resume using JD language while preserving all facts
4. GENERATE a high-impact cover letter to ${companyName}

═══════════════════════════════════════════════════════════════
INTELLIGENT BULLET POINT REWRITING
═══════════════════════════════════════════════════════════════

For EACH work history bullet point:
1. Scan the JD for action verbs, technical terms, and industry vocabulary
2. Replace generic verbs with stronger equivalents that appear in the JD:
   - If JD says "spearheaded" → replace "led" or "managed" with "spearheaded"
   - If JD says "drove" → replace "worked on" or "handled" with "drove"
   - If JD says "orchestrated" → replace "organized" or "coordinated" with "orchestrated"
3. Swap synonyms to match JD terminology:
   - "customers" → "clients" if JD uses "client-facing"
   - "helped" → "supported" or "enabled" if JD uses those terms
   - "team" → "cross-functional stakeholders" if JD uses that phrase
   - "improved" → "optimized" or "enhanced" if those appear in JD
4. Mirror JD's specific phrasing patterns where natural

═══════════════════════════════════════════════════════════════
KEYWORD INJECTION RULES
═══════════════════════════════════════════════════════════════

- Naturally WEAVE missing keywords into existing bullet points where contextually appropriate
- DO NOT just append keywords - integrate them into the sentence structure
- If a bullet mentions a general concept, make it SPECIFIC using JD terms:
  - "used software tools" → "leveraged Salesforce and HubSpot" (if those appear in JD and relate to their work)
  - "analyzed data" → "conducted data analysis using SQL and Tableau" (if JD mentions these and resume implies data work)
  - "worked with teams" → "collaborated with cross-functional teams including Engineering, Product, and Design" (if JD mentions these functions)
- Only inject tools/technologies that are PLAUSIBLY connected to the original experience

═══════════════════════════════════════════════════════════════
TONE AND VOICE MATCHING
═══════════════════════════════════════════════════════════════

Analyze the JD's tone and match it:
- FORMAL/CORPORATE JD (uses "facilitate", "leverage", "stakeholders"): Use polished, corporate language
- STARTUP/CASUAL JD (uses "crush it", "move fast", "own"): Use dynamic, energetic phrasing
- TECHNICAL JD (heavy on specs and tools): Emphasize technical precision and tool proficiency
- PEOPLE-FOCUSED JD (emphasizes collaboration, culture): Highlight teamwork and interpersonal impact

Mirror the energy level and formality of the JD throughout the resume.

═══════════════════════════════════════════════════════════════
REWRITE MODE: ${mode.toUpperCase()}
═══════════════════════════════════════════════════════════════

${mode === 'conservative' ? `CONSERVATIVE MODE INSTRUCTIONS:
- Preserve original sentence structure as much as possible
- Focus primarily on verb swaps and synonym replacements
- Inject keywords into skills and summary sections liberally
- For experience bullets: swap verbs and terminology but keep the same basic sentence flow
- Make 1-2 word changes per bullet rather than full rewrites
- Prioritize accuracy over optimization when in doubt` : `AGGRESSIVE MODE INSTRUCTIONS:
- Fully rephrase bullets to maximize JD language alignment
- Restructure sentences to front-load JD keywords and action verbs
- Combine or split bullets if it creates better keyword density
- Transform passive voice to active voice using JD verbs
- Add contextual details that make bullets more specific (using JD terminology)
- Push the boundaries of favorable interpretation while staying truthful
- Every bullet should feel like it was written specifically for this JD`}

BOTH MODES MUST:
- Apply intelligent synonym replacement
- Match JD tone and vocabulary
- Never violate the guardrails (no fabrication, no fake metrics, no invented tools)
${objective ? `
═══════════════════════════════════════════════════════════════
OBJECTIVE-DRIVEN OPTIMIZATION
═══════════════════════════════════════════════════════════════

The candidate's stated career objective: "${objective}"

RESUME OPTIMIZATION:
- Prioritize experiences that align with this objective
- Emphasize transferable skills relevant to their stated goal
- Use language that bridges past experience to future direction
- Frame accomplishments in terms of the career path they're pursuing

COVER LETTER CUSTOMIZATION:
- Weave the objective narrative into the opening paragraph
- Explicitly address any career transition positively
- Connect past experiences to future goals with specific examples
- Frame the transition confidently - focus on what they BRING, not what they lack
- Show genuine enthusiasm for the new direction
` : ''}
═══════════════════════════════════════════════════════════════
RESUME STYLE: ${styleInfo.name}
═══════════════════════════════════════════════════════════════
- Best for: ${styleInfo.bestFor}
- Section order: ${styleInfo.sectionOrder.join(' → ')}
- ${styleInfo.description}
- Tailor content emphasis accordingly

ORIGINAL RESUME:
${resumeText}

JOB DESCRIPTION:
${jobDescription}

Respond with ONLY a valid JSON object matching this exact structure (no markdown formatting, no code blocks):
{
  "resume": {
    "contact": {
      "name": "string",
      "email": "string",
      "phone": "string",
      "location": "string",
      "linkedin": "string or empty"
    },
    "summary": "string - professional summary optimized with keywords",
    "objective": "string or empty - if present in original, preserve it",
    "includeObjective": "boolean - true if objective was in original",
    "skills": {
      "tools": ["array of technical tools/technologies"],
      "core": ["array of core competencies/soft skills"]
    },
    "experience": [
      {
        "company": "string",
        "role": "string",
        "location": "string",
        "dateRange": "string - FULL date range with months",
        "bullets": ["array of achievement bullets - grammatically correct, unique, properly punctuated"]
      }
    ],
    "education": [
      {
        "school": "string",
        "degree": "string",
        "fieldOfStudy": "string or empty",
        "dateRange": "string",
        "location": "string"
      }
    ],
    "projects": [
      {
        "name": "string",
        "dateRange": "string",
        "description": "string",
        "technologies": "string"
      }
    ],
    "includeProjects": "boolean - true if projects section exists",
    "certifications": [
      {
        "name": "string - certification or license name (e.g., 'RN License', 'CPA', 'AWS Solutions Architect')",
        "issuer": "string - issuing organization (e.g., 'State Board of Nursing', 'Amazon Web Services')",
        "dateObtained": "string - PRESERVE EXACT FORMAT from original (e.g., '03/2020' or 'March 2020')",
        "expirationDate": "string or empty - PRESERVE EXACT FORMAT, extract from 'Exp:', 'Valid through', etc.",
        "noExpiration": "boolean - true ONLY if explicitly stated as lifetime/no expiration"
      }
    ],
    "includeCertifications": "boolean - true if certifications or licenses exist",
    "clinicalHours": [
      {
        "siteName": "string",
        "role": "string",
        "hoursCompleted": "number",
        "description": "string or empty"
      }
    ],
    "includeClinicalHours": "boolean - true if clinical/practicum/fieldwork exists",
    "volunteer": [
      {
        "organization": "string",
        "role": "string",
        "dateRange": "string",
        "description": "string"
      }
    ],
    "includeVolunteer": "boolean - true if volunteer section exists",
    "publications": [
      {
        "title": "string",
        "publication": "string",
        "date": "string"
      }
    ],
    "includePublications": "boolean - true if publications exist",
    "languages": ["array of languages with proficiency levels"],
    "includeLanguages": "boolean - true if languages section exists",
    "awards": [
      {
        "title": "string",
        "issuer": "string",
        "date": "string",
        "description": "string or empty"
      }
    ],
    "includeAwards": "boolean - true if awards/honors section exists"
  },
  "coverLetter": "string - full professional cover letter",
  "report": {
    "keywords": [
      {
        "term": "keyword string",
        "type": "must-have or nice-to-have",
        "category": "string category",
        "foundIn": ["Summary", "Skills", "Experience"]
      }
    ],
    "gaps": ["array of keywords from JD not found in resume"]
  }
}`;

  return { systemPrompt, userPrompt };
}

function buildGapSuggestionPrompts(skill, resume, targetSection, jobDescription) {
  const resumeContext = `
Name: ${resume.contact?.name || 'Unknown'}
Summary: ${resume.summary || ''}
Skills: ${[...(resume.skills?.tools || []), ...(resume.skills?.core || [])].join(', ')}
Experience:
${(resume.experience || []).map(exp => `- ${exp.role} at ${exp.company}: ${(exp.bullets || []).join('; ')}`).join('\n')}
`;

  const sectionGuidance = {
    skills: 'Generate a single skill phrase (2-5 words) that could be added to the skills section. Just the skill name/phrase, no explanation.',
    experience: 'Generate a single achievement bullet point (one sentence) that demonstrates this skill. Start with a strong action verb. Be specific and quantify if possible. The bullet should sound natural alongside the existing experience.',
    summary: 'Generate a brief phrase (5-15 words) that could be naturally inserted into the professional summary to mention this skill. Just the phrase, no full sentences needed.'
  };

  const systemPrompt = `You are helping improve a resume by adding a missing skill that was mentioned in a job description.
Based on the candidate's existing experience and background, generate realistic, truthful content that shows relevant experience.

CRITICAL RULES:
- Only suggest content that could plausibly be true based on their existing experience
- Do not invent specific metrics or achievements that aren't supported by their background
- Keep suggestions professional and concise
- Match the tone and style of their existing resume`;

  const userPrompt = `The candidate's resume is missing this skill from the job description: "${skill}"

Current resume context:
${resumeContext}

Job description excerpt (for context):
${jobDescription.substring(0, 500)}...

Target section: ${targetSection}
${sectionGuidance[targetSection]}

Respond with ONLY the suggested text, no quotes, no explanation.`;

  return { systemPrompt, userPrompt };
}

function inferIndustry(resume) {
  const text = [
    ...(resume.skills?.tools || []),
    ...(resume.skills?.core || []),
    ...(resume.experience || []).map(e => `${e.role} ${e.company}`),
    resume.summary || ''
  ].join(' ').toLowerCase();

  const industries = {
    'Technology/Software': ['software', 'developer', 'engineer', 'programming', 'javascript', 'python', 'react', 'aws', 'cloud', 'devops', 'data'],
    'Healthcare': ['nurse', 'medical', 'clinical', 'patient', 'healthcare', 'hospital', 'physician', 'therapy'],
    'Finance': ['finance', 'accounting', 'banking', 'investment', 'financial', 'analyst', 'cpa', 'audit'],
    'Marketing': ['marketing', 'digital', 'seo', 'content', 'brand', 'advertising', 'social media', 'campaign'],
    'Sales': ['sales', 'account', 'business development', 'client', 'revenue', 'quota'],
    'Education': ['teacher', 'education', 'curriculum', 'student', 'teaching', 'school', 'professor'],
    'Legal': ['attorney', 'legal', 'law', 'paralegal', 'litigation', 'contract'],
    'Design': ['designer', 'ux', 'ui', 'graphic', 'creative', 'figma', 'adobe', 'visual'],
    'HR/People': ['human resources', 'recruiting', 'talent', 'hr', 'hiring', 'employee']
  };

  for (const [industry, keywords] of Object.entries(industries)) {
    const matches = keywords.filter(kw => text.includes(kw));
    if (matches.length >= 2) {
      return industry;
    }
  }

  return 'General Professional';
}

function buildEmploymentGapSuggestionPrompts(gap, resume, jobDescription) {
  const resumeContext = `
Industry/Field: ${inferIndustry(resume)}
Skills: ${[...(resume.skills?.tools || []), ...(resume.skills?.core || [])].join(', ')}
Recent Experience:
${(resume.experience || []).slice(0, 3).map(exp => `- ${exp.role} at ${exp.company}`).join('\n')}
Education:
${(resume.education || []).map(edu => `- ${edu.degree} from ${edu.school}`).join('\n')}
`;

  const gapContext = `
Gap Period: ${gap.durationMonths} months
Previous Role: ${gap.previousJob.role} at ${gap.previousJob.company} (ended ${gap.previousJob.endDate})
Next Role: ${gap.nextJob.role} at ${gap.nextJob.company} (started ${gap.nextJob.startDate})
`;

  const systemPrompt = `You are a career advisor helping a job seeker address an employment gap on their resume. Your goal is to suggest realistic, truthful activities that could explain and add value during this gap period.

CRITICAL RULES:
1. Suggestions must be REALISTIC and BELIEVABLE based on the person's background
2. Never suggest anything that would be obvious fabrication
3. Consider the industry, skill level, and context
4. Suggestions should be things that could be easily verified or discussed in an interview
5. Focus on activities that build relevant skills or demonstrate initiative

You must respond with ONLY valid JSON - no markdown, no code blocks, no explanation.`;

  const userPrompt = `Based on this candidate's background, suggest 3-4 realistic activities they could have done during their employment gap.

CANDIDATE CONTEXT:
${resumeContext}

GAP DETAILS:
${gapContext}

${jobDescription ? `TARGET JOB (they're applying to):
${jobDescription.substring(0, 800)}...` : ''}

Consider suggesting activities from these categories:
- Personal project (open source, app, portfolio piece)
- Freelance/consulting work
- Additional education (courses, certifications, bootcamp)
- Volunteer work (relevant to their field or showing leadership)

For each suggestion:
- Make it SPECIFIC to their field/skills
- Keep it realistic for the gap duration
- Include details that make it believable
- Ensure it adds value to their resume

Respond with ONLY this JSON structure:
{
  "suggestions": [
    {
      "type": "project" | "freelance" | "education" | "volunteer",
      "title": "Brief title for the activity",
      "description": "2-3 sentences describing what they did and what they gained/achieved"
    }
  ]
}`;

  return { systemPrompt, userPrompt };
}

// =============================================================================
// API ENDPOINTS
// =============================================================================

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Main resume tailoring endpoint
app.post('/api/tailor', validateTailorRequest, async (req, res) => {
  try {
    const { resumeText, jobDescription, companyName, mode, resumeStyle, objective } = req.body;

    const { systemPrompt, userPrompt } = buildTailorPrompts(
      resumeText,
      jobDescription,
      companyName,
      mode,
      resumeStyle,
      objective
    );

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 8192,
      messages: [{ role: 'user', content: userPrompt }],
      system: systemPrompt,
    });

    const textContent = response.content.find(block => block.type === 'text');
    if (!textContent || textContent.type !== 'text') {
      return res.status(500).json({ error: 'Failed to process your request. Please try again.' });
    }

    // Parse JSON response
    let jsonText = textContent.text.trim();

    // Remove markdown code blocks if present
    if (jsonText.startsWith('```json')) {
      jsonText = jsonText.slice(7);
    } else if (jsonText.startsWith('```')) {
      jsonText = jsonText.slice(3);
    }
    if (jsonText.endsWith('```')) {
      jsonText = jsonText.slice(0, -3);
    }
    jsonText = jsonText.trim();

    try {
      const result = JSON.parse(jsonText);
      res.json(result);
    } catch (parseError) {
      console.error('JSON parse error:', parseError.message);
      res.status(500).json({ error: 'Failed to process the response. Please try again.' });
    }
  } catch (error) {
    console.error('Tailor API error:', error.message);

    // Don't expose internal error details to client
    if (error.status === 401) {
      res.status(500).json({ error: 'Service configuration error. Please contact support.' });
    } else if (error.status === 429) {
      res.status(429).json({ error: 'Service is temporarily busy. Please try again in a moment.' });
    } else {
      res.status(500).json({ error: 'An error occurred while processing your request. Please try again.' });
    }
  }
});

// Gap suggestion endpoint
app.post('/api/gap-suggestion', validateGapSuggestionRequest, async (req, res) => {
  try {
    const { skill, resume, targetSection, jobDescription } = req.body;

    const { systemPrompt, userPrompt } = buildGapSuggestionPrompts(
      skill,
      resume,
      targetSection,
      jobDescription
    );

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 200,
      messages: [{ role: 'user', content: userPrompt }],
      system: systemPrompt,
    });

    const textContent = response.content.find(block => block.type === 'text');
    if (!textContent || textContent.type !== 'text') {
      return res.status(500).json({ error: 'Failed to generate suggestion. Please try again.' });
    }

    res.json({ suggestion: textContent.text.trim() });
  } catch (error) {
    console.error('Gap suggestion API error:', error.message);
    res.status(500).json({ error: 'Failed to generate suggestion. Please try again.' });
  }
});

// Employment gap suggestion endpoint
app.post('/api/employment-gap-suggestion', async (req, res) => {
  try {
    const { gap, resume, jobDescription = '' } = req.body;

    if (!gap || !resume) {
      return res.status(400).json({ error: 'Missing required fields: gap and resume are required.' });
    }

    if (!gap.previousJob || !gap.nextJob || !gap.durationMonths) {
      return res.status(400).json({ error: 'Invalid gap object. Must include previousJob, nextJob, and durationMonths.' });
    }

    const { systemPrompt, userPrompt } = buildEmploymentGapSuggestionPrompts(
      gap,
      resume,
      sanitizeString(jobDescription)
    );

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      messages: [{ role: 'user', content: userPrompt }],
      system: systemPrompt,
    });

    const textContent = response.content.find(block => block.type === 'text');
    if (!textContent || textContent.type !== 'text') {
      return res.status(500).json({ error: 'Failed to generate suggestions. Please try again.' });
    }

    // Parse JSON response
    let jsonText = textContent.text.trim();

    // Remove markdown code blocks if present
    if (jsonText.startsWith('```json')) {
      jsonText = jsonText.slice(7);
    } else if (jsonText.startsWith('```')) {
      jsonText = jsonText.slice(3);
    }
    if (jsonText.endsWith('```')) {
      jsonText = jsonText.slice(0, -3);
    }
    jsonText = jsonText.trim();

    try {
      const result = JSON.parse(jsonText);
      res.json(result);
    } catch (parseError) {
      console.error('JSON parse error:', parseError.message);
      res.status(500).json({ error: 'Failed to process the response. Please try again.' });
    }
  } catch (error) {
    console.error('Employment gap suggestion API error:', error.message);
    res.status(500).json({ error: 'Failed to generate suggestions. Please try again.' });
  }
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err.message);
  res.status(500).json({ error: 'An unexpected error occurred. Please try again.' });
});

// =============================================================================
// START SERVER
// =============================================================================
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log('Available endpoints:');
  console.log('  GET  /api/health');
  console.log('  POST /api/tailor');
  console.log('  POST /api/gap-suggestion');
  console.log('  POST /api/employment-gap-suggestion');
});
