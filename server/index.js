import express from 'express';
import cors from 'cors';
import Anthropic from '@anthropic-ai/sdk';
import dotenv from 'dotenv';
import { requireSupabaseAuth } from '../api/_utils.js';
import { runTailor, runOnePage, buildGapSuggestionPrompts, TAILOR_MODEL } from '../api/_tailorCore.js';



// Load environment variables from .env file

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;
app.set('trust proxy', 1);

const derivedOrigin = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '';
const defaultOrigins =
  process.env.NODE_ENV === 'production' ? derivedOrigin : 'http://localhost:5173';
const allowedOrigins = (process.env.ALLOWED_ORIGINS || process.env.CORS_ORIGIN || defaultOrigins)
  .split(',')
  .map(origin => origin.trim())
  .filter(Boolean);

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

async function requireAuth(req, res, next) {
  const result = await requireSupabaseAuth(req, res);
  if (!result.ok) return;
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
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    return callback(null, false);
  },
  methods: ['POST'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json({ limit: '1mb' }));
app.use(rateLimit);

// =============================================================================
// PROMPT BUILDERS (moved from frontend)
// =============================================================================
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
app.post('/api/tailor', requireAuth, validateTailorRequest, async (req, res) => {
  try {
    const { resumeText, jobDescription, companyName, mode = 'conservative', resumeStyle = 'classic', objective } = req.body;

    const result = await runTailor(anthropic, {
      resumeText,
      jobDescription,
      companyName,
      mode,
      resumeStyle,
      objective: objective || null,
    });

    res.json(result);
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
app.post('/api/gap-suggestion', requireAuth, validateGapSuggestionRequest, async (req, res) => {
  try {
    const { skill, resume, targetSection, jobDescription } = req.body;

    const { systemPrompt, userPrompt } = buildGapSuggestionPrompts(
      skill,
      resume,
      targetSection,
      jobDescription
    );

    const response = await anthropic.messages.create({
      model: TAILOR_MODEL,
      max_tokens: 200,
      thinking: { type: 'disabled' },
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
app.post('/api/employment-gap-suggestion', requireAuth, async (req, res) => {
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
      model: TAILOR_MODEL,
      max_tokens: 1024,
      thinking: { type: 'disabled' },
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

// Convert to one-page endpoint
app.post('/api/convert-one-page', requireAuth, async (req, res) => {
  try {
    const { resumeData, jobDescription } = req.body;

    if (!resumeData || !jobDescription) {
      return res.status(400).json({ error: 'Missing required fields: resumeData and jobDescription are required.' });
    }

    if (typeof resumeData !== 'object') {
      return res.status(400).json({ error: 'Invalid resumeData. Must be an object.' });
    }

    if (typeof jobDescription !== 'string') {
      return res.status(400).json({ error: 'Invalid jobDescription. Must be a string.' });
    }

    const result = await runOnePage(anthropic, {
      resumeData,
      jobDescription: sanitizeString(jobDescription),
      jobProfile: req.body.jobProfile || null,
    });

    res.json(result);
  } catch (error) {
    console.error('Convert one-page API error:', error.message);
    if (error.status === 429) {
      res.status(429).json({ error: 'Service is temporarily busy. Please try again in a moment.' });
    } else {
      res.status(500).json({ error: 'An error occurred while processing your request. Please try again.' });
    }
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

const server = app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log('Available endpoints:');
  console.log('  GET  /api/health');
  console.log('  POST /api/tailor');
  console.log('  POST /api/gap-suggestion');
  console.log('  POST /api/employment-gap-suggestion');
  console.log('  POST /api/convert-one-page');
});

// Graceful shutdown
function shutdown() {
  console.log('Received kill signal, shutting down gracefully');
  server.close(() => {
    console.log('Closed out remaining connections');
    process.exit(0);
  });

  setTimeout(() => {
    console.error('Could not close connections in time, forcefully shutting down');
    process.exit(1);
  }, 10000);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
