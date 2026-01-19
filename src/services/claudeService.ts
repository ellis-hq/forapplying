import Anthropic from "@anthropic-ai/sdk";
import { TailorResponse, RewriteMode, TailoredResumeData, GapTargetSection, ResumeStyle, RESUME_STYLES } from "../types";

const client = new Anthropic({
  apiKey: import.meta.env.VITE_ANTHROPIC_API_KEY,
  dangerouslyAllowBrowser: true // Required for client-side usage
});

export async function tailorResume(
  originalResumeText: string,
  jobDescription: string,
  companyName: string,
  mode: RewriteMode,
  resumeStyle: ResumeStyle = ResumeStyle.CLASSIC
): Promise<TailorResponse> {
  // Get style info for the prompt
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
${originalResumeText}

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

  const response = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 8192,
    messages: [
      {
        role: "user",
        content: userPrompt
      }
    ],
    system: systemPrompt
  });

  // Extract text content from the response
  const textContent = response.content.find(block => block.type === 'text');
  if (!textContent || textContent.type !== 'text') {
    throw new Error('No text response received from Claude');
  }

  // Parse the JSON response
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
    const result = JSON.parse(jsonText) as TailorResponse;
    return result;
  } catch (parseError) {
    console.error('Failed to parse response:', jsonText);
    throw new Error('Failed to parse AI response. Please try again.');
  }
}

/**
 * Generate a suggestion for a missing skill based on the user's resume context
 */
export async function generateGapSuggestion(
  skill: string,
  resume: TailoredResumeData,
  targetSection: GapTargetSection,
  jobDescription: string
): Promise<string> {
  const resumeContext = `
Name: ${resume.contact.name}
Summary: ${resume.summary}
Skills: ${[...resume.skills.tools, ...resume.skills.core].join(', ')}
Experience:
${resume.experience.map(exp => `- ${exp.role} at ${exp.company}: ${exp.bullets.join('; ')}`).join('\n')}
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

  const response = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 200,
    messages: [
      {
        role: "user",
        content: userPrompt
      }
    ],
    system: systemPrompt
  });

  const textContent = response.content.find(block => block.type === 'text');
  if (!textContent || textContent.type !== 'text') {
    throw new Error('No text response received from Claude');
  }

  return textContent.text.trim();
}
