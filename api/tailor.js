import Anthropic from '@anthropic-ai/sdk';

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
  const { resumeText, jobDescription, companyName, mode, resumeStyle } = body;

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

  return null;
}

// =============================================================================
// PROMPT BUILDERS
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

// =============================================================================
// VERCEL SERVERLESS HANDLER
// =============================================================================
export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

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
    const { resumeText, jobDescription, companyName, mode = 'conservative', resumeStyle = 'classic' } = req.body;

    const sanitizedResume = sanitizeString(resumeText);
    const sanitizedJobDesc = sanitizeString(jobDescription);
    const sanitizedCompany = sanitizeString(companyName);

    const { systemPrompt, userPrompt } = buildTailorPrompts(
      sanitizedResume,
      sanitizedJobDesc,
      sanitizedCompany,
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
      return res.status(200).json(result);
    } catch (parseError) {
      console.error('JSON parse error:', parseError.message);
      return res.status(500).json({ error: 'Failed to process the response. Please try again.' });
    }
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
