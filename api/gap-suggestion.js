import Anthropic from '@anthropic-ai/sdk';
import { applyCors, enforceRateLimit, requireSupabaseAuth } from './_utils.js';

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
      model: 'claude-sonnet-4-20250514',
      max_tokens: 200,
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
