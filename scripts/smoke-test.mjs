// Temporary live smoke test of the full tailoring pipeline. Deleted after run.
import dotenv from 'dotenv';
dotenv.config({ override: true });
import Anthropic from '@anthropic-ai/sdk';
import { runTailor } from './api/_tailorCore.js';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const resumeText = `Jane Smith
jane@example.com | 555-1234 | Austin, TX

SUMMARY
Marketing coordinator with 3 years of experience in social media and campaigns.

EXPERIENCE
Marketing Coordinator, Acme Corp, Austin TX, 03/2022 - Present
- Managed social media accounts and grew followers by 40%
- Worked with the sales team on campaigns using HubSpot
- Wrote blog posts and email newsletters for product launches

Marketing Intern, BrightPath Agency, Austin TX, 06/2021 - 02/2022
- Helped run Google Ads campaigns with a $5,000 monthly budget
- Made weekly reports on campaign performance in Google Analytics

EDUCATION
BA Communications, University of Texas, 2018 - 2022, Austin TX

CERTIFICATIONS
Google Analytics Certification, Issued: 06/2023, Expires: 06/2026`;

const jobDescription = `Digital Marketing Specialist — BrightWave (Austin, TX)

We're a fast-growing startup looking for someone to own our digital marketing engine.

Requirements:
- 2+ years of digital marketing experience
- Hands-on experience with HubSpot and marketing automation
- Proven social media strategy and content creation skills
- Data-driven mindset: comfortable in Google Analytics
- Strong cross-functional collaboration with sales and product

Nice to have:
- SEO and SEM experience
- Email marketing and drip campaigns
- Paid acquisition (Google Ads, Meta)`;

const t0 = Date.now();
const result = await runTailor(anthropic, {
  resumeText,
  jobDescription,
  companyName: 'BrightWave',
  mode: 'aggressive',
  resumeStyle: 'classic',
  objective: null,
});
const elapsed = ((Date.now() - t0) / 1000).toFixed(1);

console.log(`\n=== PIPELINE COMPLETED in ${elapsed}s ===\n`);
console.log('MATCH SCORE:', JSON.stringify(result.matchScore));
console.log('\nJOB PROFILE — role:', result.jobProfile.roleTitle, '| seniority:', result.jobProfile.seniority, '| tone:', result.jobProfile.tone);
console.log('topPriorities:', JSON.stringify(result.jobProfile.topPriorities));
console.log('hardRequirements:', JSON.stringify(result.jobProfile.hardRequirements));
console.log('\nKEYWORD REPORT:');
for (const k of result.report.keywords) {
  console.log(`  ${k.foundIn.length ? '✓' : '✗'} ${k.term} [${k.type}] -> ${k.foundIn.join(', ') || 'NOT FOUND'}`);
}
console.log('gaps:', JSON.stringify(result.report.gaps));
console.log('\nFACT-GUARD WARNINGS:', result.warnings.length ? '' : 'none');
result.warnings.forEach(w => console.log('  ⚠', w));
console.log('\nDATES CHECK:');
console.log('  experience:', result.resume.experience.map(e => `${e.company}: ${e.dateRange}`).join(' | '));
console.log('  certs:', JSON.stringify(result.resume.certifications));
console.log('\nSUMMARY:', result.resume.summary);
console.log('\nFIRST ROLE BULLETS:');
result.resume.experience[0]?.bullets.forEach(b => console.log('  •', b));
console.log('\nCOVER LETTER (first 300 chars):\n', result.coverLetter.slice(0, 300));
