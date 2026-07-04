import Anthropic from '@anthropic-ai/sdk';
import { applyCors, enforceRateLimit, requireSupabaseAuth } from './_utils.js';
import { runTailor } from './_tailorCore.js';

// =============================================================================
// INPUT VALIDATION & SANITIZATION
// =============================================================================
const MAX_RESUME_LENGTH = 50000;
const MAX_JOB_DESC_LENGTH = 30000;
const MAX_COMPANY_NAME_LENGTH = 200;

function sanitizeString(str) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/\0/g, '')
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    .trim();
}

function validateRequest(body) {
  const { resumeText, jobDescription, companyName, mode, resumeStyle, objective } = body;

  if (!resumeText || !jobDescription || !companyName) {
    return { error: 'Missing required fields: resumeText, jobDescription, and companyName are required.' };
  }

  if (typeof resumeText !== 'string' || typeof jobDescription !== 'string' || typeof companyName !== 'string') {
    return { error: 'Invalid field types. All text fields must be strings.' };
  }

  if (resumeText.length > MAX_RESUME_LENGTH) {
    return { error: `Resume text exceeds maximum length of ${MAX_RESUME_LENGTH} characters.` };
  }

  if (jobDescription.length > MAX_JOB_DESC_LENGTH) {
    return { error: `Job description exceeds maximum length of ${MAX_JOB_DESC_LENGTH} characters.` };
  }

  if (companyName.length > MAX_COMPANY_NAME_LENGTH) {
    return { error: `Company name exceeds maximum length of ${MAX_COMPANY_NAME_LENGTH} characters.` };
  }

  const validModes = ['conservative', 'aggressive'];
  if (mode && !validModes.includes(mode)) {
    return { error: 'Invalid mode. Must be "conservative" or "aggressive".' };
  }

  const validStyles = ['classic', 'hybrid', 'technical'];
  if (resumeStyle && !validStyles.includes(resumeStyle)) {
    return { error: 'Invalid resumeStyle. Must be "classic", "hybrid", or "technical".' };
  }

  // Objective is optional, but if provided must be string
  if (objective && typeof objective !== 'string') {
    return { error: 'Invalid objective. Must be a string.' };
  }

  return null;
}

// =============================================================================
// VERCEL SERVERLESS HANDLER
// =============================================================================
export default async function handler(req, res) {
  if (!applyCors(req, res, 'POST, OPTIONS')) return;

  // Handle preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!enforceRateLimit(req, res)) return;

  if (!(await requireSupabaseAuth(req, res)).ok) return;

  // Check API key
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('ANTHROPIC_API_KEY not configured');
    return res.status(500).json({ error: 'Service configuration error. Please contact support.' });
  }

  // Initialize Anthropic client inside the handler
  const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  });

  // Validate request
  const validationError = validateRequest(req.body);
  if (validationError) {
    return res.status(400).json(validationError);
  }

  try {
    const { resumeText, jobDescription, companyName, mode = 'conservative', resumeStyle = 'classic', objective } = req.body;

    const result = await runTailor(anthropic, {
      resumeText: sanitizeString(resumeText),
      jobDescription: sanitizeString(jobDescription),
      companyName: sanitizeString(companyName),
      mode,
      resumeStyle,
      objective: objective ? sanitizeString(objective) : null,
    });

    return res.status(200).json(result);
  } catch (error) {
    console.error('Tailor API error:', error.message);

    if (error.status === 401) {
      return res.status(500).json({ error: 'Service configuration error. Please contact support.' });
    } else if (error.status === 429) {
      return res.status(429).json({ error: 'Service is temporarily busy. Please try again in a moment.' });
    } else {
      return res.status(500).json({ error: 'An error occurred while processing your request. Please try again.' });
    }
  }
}
