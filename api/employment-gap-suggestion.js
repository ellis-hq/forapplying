import Anthropic from '@anthropic-ai/sdk';

// =============================================================================
// INPUT VALIDATION & SANITIZATION
// =============================================================================
const MAX_RESUME_LENGTH = 50000;
const MAX_JOB_DESC_LENGTH = 30000;

function sanitizeString(str) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/\0/g, '')
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    .trim();
}

function validateRequest(body) {
  const { gap, resume, jobDescription } = body;

  if (!gap || !resume) {
    return { error: 'Missing required fields: gap and resume are required.' };
  }

  if (!gap.previousJob || !gap.nextJob || !gap.durationMonths) {
    return { error: 'Invalid gap object. Must include previousJob, nextJob, and durationMonths.' };
  }

  return null;
}

// =============================================================================
// PROMPT BUILDER
// =============================================================================
function buildEmploymentGapSuggestionPrompts(gap, resume, jobDescription) {
  // Build resume context
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

/**
 * Infer industry from resume content
 */
function inferIndustry(resume) {
  const text = [
    ...(resume.skills?.tools || []),
    ...(resume.skills?.core || []),
    ...(resume.experience || []).map(e => `${e.role} ${e.company}`),
    resume.summary || ''
  ].join(' ').toLowerCase();

  // Simple keyword-based industry detection
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
    const { gap, resume, jobDescription = '' } = req.body;

    const sanitizedJobDesc = sanitizeString(jobDescription);

    const { systemPrompt, userPrompt } = buildEmploymentGapSuggestionPrompts(
      gap,
      resume,
      sanitizedJobDesc
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
      return res.status(200).json(result);
    } catch (parseError) {
      console.error('JSON parse error:', parseError.message);
      return res.status(500).json({ error: 'Failed to process the response. Please try again.' });
    }
  } catch (error) {
    console.error('Employment gap suggestion API error:', error.message);

    if (error.status === 401) {
      return res.status(500).json({ error: 'Service configuration error. Please contact support.' });
    } else if (error.status === 429) {
      return res.status(429).json({ error: 'Service is temporarily busy. Please try again in a moment.' });
    } else {
      return res.status(500).json({ error: 'An error occurred while processing your request. Please try again.' });
    }
  }
}
