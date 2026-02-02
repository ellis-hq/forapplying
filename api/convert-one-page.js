import Anthropic from '@anthropic-ai/sdk';
import { applyCors, enforceRateLimit, requireSupabaseAuth } from './_utils.js';

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

  return null;
}

// =============================================================================
// PROMPT BUILDER
// =============================================================================
function buildOnePagePrompts(resumeData, jobDescription) {
  const systemPrompt = `You are converting a multi-page resume into a concise 1-page version while maintaining ATS optimization.

You must respond ONLY with valid JSON - no markdown, no code blocks, no explanation text.

CRITICAL REQUIREMENTS:
- The output must be SHORT ENOUGH to fit on ONE PAGE when rendered as a PDF with 0.75" margins, 10pt body font, and standard spacing
- This means: max 3-4 bullet points per role, max 3-4 most relevant roles, concise summary (2-3 lines)
- Preserve all critical keywords from the job description
- Keep all quantified achievements (numbers, %, $, metrics)
- Remove generic/soft skill statements
- Combine similar experiences where appropriate
- Prioritize most recent and most relevant experience
- Maintain professional formatting

CONTENT PRIORITIZATION (what to keep vs cut):
1. KEEP: Quantified achievements with measurable impact
2. KEEP: Technical skills and tools directly matching job requirements
3. KEEP: Recent experience (last 5-7 years prioritized)
4. KEEP: Leadership and cross-functional work relevant to the role
5. CUT: Objective statements and references
6. CUT: Excessive education details (keep degree, school, dates only)
7. CUT: Older roles (10+ years) unless highly relevant
8. CUT: Generic bullets that don't differentiate the candidate
9. CUT: Redundant skills already demonstrated in experience
10. CUT: Volunteer, publications, awards unless directly relevant to the job

SECTION LENGTH TARGETS (to fit one page):
- Summary: 2-3 sentences max
- Skills: Keep only the most relevant tools and core skills (max 8-10 each)
- Experience: 3-4 roles max, 3-4 bullets each
- Education: 1-2 entries, one line each
- Certifications: Only if directly relevant, max 2-3
- Other optional sections: Include ONLY if highly relevant and space permits

CRITICAL DATE PRESERVATION:
- PRESERVE THE EXACT DATE FORMAT from the original resume
- "02/2010" stays as "02/2010", "March 2020" stays as "March 2020"
- Preserve full date ranges including months

ABSOLUTE GUARDRAILS:
1. NEVER fabricate responsibilities, achievements, or experiences
2. NEVER add tools, technologies, or skills not in the original
3. NEVER change job titles, company names, dates, or metrics
4. NEVER invent specific metrics, percentages, or dollar amounts
5. The output must be a CONDENSED version of the SAME TRUTH`;

  const userPrompt = `Convert the following resume to a 1-page version optimized for the given job description.

Select the most impactful and relevant content. Prioritize roles and bullets that align with the job requirements.

RESUME DATA:
${JSON.stringify(resumeData, null, 2)}

JOB DESCRIPTION:
${jobDescription}

Respond with ONLY a valid JSON object matching this exact structure (no markdown, no code blocks):
{
  "contact": {
    "name": "string",
    "email": "string",
    "phone": "string",
    "location": "string",
    "linkedin": "string or empty"
  },
  "summary": "string - concise 2-3 sentence summary",
  "skills": {
    "tools": ["max 8-10 most relevant tools"],
    "core": ["max 8-10 most relevant core skills"]
  },
  "experience": [
    {
      "company": "string",
      "role": "string",
      "location": "string",
      "dateRange": "string - EXACT format from original",
      "bullets": ["3-4 highest impact bullets only"]
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
  "certifications": [
    {
      "name": "string",
      "issuer": "string",
      "dateObtained": "string",
      "expirationDate": "string or empty",
      "noExpiration": "boolean"
    }
  ],
  "includeCertifications": "boolean - true only if certifications are relevant to the job",
  "includeObjective": false,
  "includeProjects": false,
  "includeVolunteer": false,
  "includePublications": false,
  "includeClinicalHours": false,
  "includeLanguages": false,
  "includeAwards": false
}

IMPORTANT: Keep the output CONCISE. It must fit on a single page. When in doubt, CUT content rather than keep it.`;

  return { systemPrompt, userPrompt };
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
    const { resumeData, jobDescription } = req.body;
    const sanitizedJobDesc = sanitizeString(jobDescription);

    const { systemPrompt, userPrompt } = buildOnePagePrompts(resumeData, sanitizedJobDesc);

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
      return res.status(200).json(result);
    } catch (parseError) {
      console.error('JSON parse error:', parseError.message);
      return res.status(500).json({ error: 'Failed to process the response. Please try again.' });
    }
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
