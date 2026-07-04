import Anthropic from '@anthropic-ai/sdk';
import { applyCors, enforceRateLimit, requireSupabaseAuth } from './_utils.js';
import { runOnePage } from './_tailorCore.js';

// =============================================================================
// INPUT VALIDATION & SANITIZATION
// =============================================================================
const MAX_RESUME_DATA_LENGTH = 100000;
const MAX_JOB_DESC_LENGTH = 30000;

function sanitizeString(str) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/\0/g, '')
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    .trim();
}

function validateRequest(body) {
  const { resumeData, jobDescription } = body;

  if (!resumeData || !jobDescription) {
    return { error: 'Missing required fields: resumeData and jobDescription are required.' };
  }

  if (typeof resumeData !== 'object') {
    return { error: 'Invalid resumeData. Must be an object.' };
  }

  if (typeof jobDescription !== 'string') {
    return { error: 'Invalid jobDescription. Must be a string.' };
  }

  if (jobDescription.length > MAX_JOB_DESC_LENGTH) {
    return { error: `Job description exceeds maximum length of ${MAX_JOB_DESC_LENGTH} characters.` };
  }

  const resumeDataStr = JSON.stringify(resumeData);
  if (resumeDataStr.length > MAX_RESUME_DATA_LENGTH) {
    return { error: `Resume data exceeds maximum length of ${MAX_RESUME_DATA_LENGTH} characters.` };
  }

  if (body.jobProfile && typeof body.jobProfile !== 'object') {
    return { error: 'Invalid jobProfile. Must be an object.' };
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

  const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  });

  // Validate request
  const validationError = validateRequest(req.body);
  if (validationError) {
    return res.status(400).json(validationError);
  }

  try {
    const { resumeData, jobDescription, jobProfile } = req.body;

    const result = await runOnePage(anthropic, {
      resumeData,
      jobDescription: sanitizeString(jobDescription),
      jobProfile: jobProfile || null,
    });

    return res.status(200).json(result);
  } catch (error) {
    console.error('Convert one-page API error:', error.message);

    if (error.status === 401) {
      return res.status(500).json({ error: 'Service configuration error. Please contact support.' });
    } else if (error.status === 429) {
      return res.status(429).json({ error: 'Service is temporarily busy. Please try again in a moment.' });
    } else {
      return res.status(500).json({ error: 'An error occurred while processing your request. Please try again.' });
    }
  }
}
