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
  const { resumeText, jobDescription, companyName, mode, resumeStyle } = req.body;

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

  // Sanitize inputs
  req.body.resumeText = sanitizeString(resumeText);
  req.body.jobDescription = sanitizeString(jobDescription);
  req.body.companyName = sanitizeString(companyName);
  req.body.mode = mode || 'conservative';
  req.body.resumeStyle = resumeStyle || 'classic';

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

function buildTailorPrompts(resumeText, jobDescription, companyName, mode, resumeStyle) {
  const styleInfo = RESUME_STYLES.find(s => s.id === resumeStyle) || RESUME_STYLES[0];

  const systemPrompt = `You are a professional resume writer and ATS (Applicant Tracking System) optimization expert. Your job is to take the candidate's existing experience and reframe it using the exact vocabulary, action verbs, and terminology from the job description. Think of it as translation - same meaning, different words that resonate with this specific employer. Be aggressive with synonym replacement and phrasing updates, but never invent new responsibilities or skills.

You must respond ONLY with valid JSON - no markdown, no code blocks, no explanation text.

CRITICAL DATE PRESERVATION:
- Extract and preserve ALL date information with extreme precision
- If an entry says "May 2024 – December 2025", return the FULL range, not just "May 2024"
- If months are present in the source, they MUST appear in the output
- Check for "Present" or current employment indicators

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
        "bullets": ["array of achievement bullets"]
      }
    ],
    "education": [
      {
        "school": "string",
        "degree": "string",
        "dateRange": "string",
        "location": "string"
      }
    ]
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
    const { resumeText, jobDescription, companyName, mode, resumeStyle } = req.body;

    const { systemPrompt, userPrompt } = buildTailorPrompts(
      resumeText,
      jobDescription,
      companyName,
      mode,
      resumeStyle
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
});
