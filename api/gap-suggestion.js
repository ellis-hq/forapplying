import Anthropic from '@anthropic-ai/sdk';
import { applyCors, enforceRateLimit, requireSupabaseAuth } from './_utils.js';
import { TAILOR_MODEL, buildGapSuggestionPrompts } from './_tailorCore.js';

function sanitizeString(str) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/\0/g, '')
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    .trim();
}

function validateRequest(body) {
  const { skill, resume, targetSection, jobDescription } = body;

  if (!skill || !resume || !targetSection || !jobDescription) {
    return { error: 'Missing required fields: skill, resume, targetSection, and jobDescription are required.' };
  }

  if (typeof skill !== 'string') {
    return { error: 'Invalid field type. skill must be a string.' };
  }

  const validSections = ['skills', 'experience', 'summary'];
  if (!validSections.includes(targetSection)) {
    return { error: 'Invalid targetSection. Must be "skills", "experience", or "summary".' };
  }

  return null;
}

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
    const { skill, resume, targetSection, jobDescription } = req.body;

    const { systemPrompt, userPrompt } = buildGapSuggestionPrompts(
      sanitizeString(skill),
      resume,
      targetSection,
      sanitizeString(jobDescription)
    );

    const response = await anthropic.messages.create({
      model: TAILOR_MODEL,
      max_tokens: 200,
      // Keep thinking off — this model thinks by default, which would eat the
      // small output budget on this short suggestion call.
      thinking: { type: 'disabled' },
      messages: [{ role: 'user', content: userPrompt }],
      system: systemPrompt,
    });

    const textContent = response.content.find(block => block.type === 'text');
    if (!textContent || textContent.type !== 'text') {
      return res.status(500).json({ error: 'Failed to generate suggestion. Please try again.' });
    }

    return res.status(200).json({ suggestion: textContent.text.trim() });
  } catch (error) {
    console.error('Gap suggestion API error:', error.message);
    return res.status(500).json({ error: 'Failed to generate suggestion. Please try again.' });
  }
}
