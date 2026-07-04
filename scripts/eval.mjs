// Eval harness for the tailoring pipeline. Runs diverse resume/JD pairs
// through runTailor and scores each on keyword coverage, fabrication warnings,
// and section preservation. Run after any prompt change:
//
//   node scripts/eval.mjs            # all cases
//   node scripts/eval.mjs tech-mid   # one case
//
// Requires ANTHROPIC_API_KEY in .env. Each case costs a few cents.
import dotenv from 'dotenv';
dotenv.config({ override: true });
import Anthropic from '@anthropic-ai/sdk';
import { runTailor } from '../api/_tailorCore.js';

const CASES = [
  {
    name: 'tech-mid',
    mode: 'aggressive',
    resumeStyle: 'classic',
    companyName: 'CloudScale',
    resumeText: `Alex Rivera
alex.rivera@email.com | (555) 201-3344 | Denver, CO | linkedin.com/in/alexrivera

SUMMARY
Software engineer with 5 years of experience building web applications.

EXPERIENCE
Software Engineer II, DataCore Systems, Denver CO, 08/2022 - Present
- Built REST APIs in Python serving 2M requests per day
- Moved several services from a monolith into containers with Docker
- Reviewed code and mentored 2 junior engineers
- Cut database query times by 60% by adding indexes and caching with Redis

Software Engineer, WebWorks LLC, Boulder CO, 06/2020 - 07/2022
- Developed features for a React dashboard used by 500+ business customers
- Wrote unit and integration tests, raising coverage from 40% to 85%
- Participated in on-call rotation and fixed production incidents

EDUCATION
BS Computer Science, Colorado State University, 2016 - 2020`,
    jobDescription: `Senior Backend Engineer — CloudScale (Remote)

CloudScale builds infrastructure monitoring used by thousands of engineering teams.

What you'll do: design and scale distributed systems processing billions of events daily.

Requirements:
- 5+ years building backend services in Python or Go
- Strong experience with Kubernetes and containerized microservices
- Experience with PostgreSQL and Redis at scale
- Track record of mentoring engineers and leading technical projects
- Experience with observability tooling (Prometheus, Grafana)

Nice to have: Kafka or event streaming, Terraform, AWS`,
  },
  {
    name: 'healthcare-rn',
    mode: 'conservative',
    resumeStyle: 'classic',
    companyName: 'St. Mary Medical Center',
    resumeText: `Maria Gonzalez, RN
maria.gonzalez@email.com | (555) 887-2210 | Phoenix, AZ

PROFESSIONAL SUMMARY
Registered Nurse with 4 years of med-surg experience.

LICENSES & CERTIFICATIONS
RN License #AZ-448821, Arizona State Board of Nursing, Issued: 05/2021, Expires: 05/2027
BLS Certification, American Heart Association, Issued: 03/2024, Expires: 03/2026
ACLS Certification, American Heart Association, Issued: 07/2024, Expires: 07/2026

EXPERIENCE
Medical-Surgical Nurse, Desert Valley Hospital, Phoenix AZ, 06/2021 - Present
- Care for 5-6 patients per shift on a 32-bed med-surg unit
- Give medications and document in Epic EHR
- Train new nurses during orientation

CLINICAL ROTATIONS
Banner Health ICU, Student Nurse, 180 hours
Phoenix Children's Hospital, Student Nurse, 120 hours

EDUCATION
BSN, Arizona State University, 2017 - 2021, Phoenix AZ`,
    jobDescription: `ICU Registered Nurse — St. Mary Medical Center (Phoenix, AZ)

Requirements:
- Current Arizona RN license
- BLS and ACLS certifications required
- 3+ years of acute care nursing experience
- Experience with Epic EHR documentation
- Strong patient assessment and critical thinking skills
- Ability to precept and mentor new staff

Preferred: CCRN, ICU or step-down experience, ventilator management`,
  },
  {
    name: 'career-switcher',
    mode: 'aggressive',
    resumeStyle: 'hybrid',
    companyName: 'Luma Software',
    resumeText: `Jordan Blake
jordan.blake@email.com | (555) 443-9087 | Portland, OR

SUMMARY
High school teacher with 6 years of experience, looking to move into customer success.

EXPERIENCE
Science Teacher, Lincoln High School, Portland OR, August 2019 - Present
- Teach 5 classes of 30 students each and adapt lessons to different learning needs
- Run parent-teacher conferences and resolve conflicts between students, parents, and administration
- Organized a school-wide science fair with 400 attendees for 3 years running
- Use Google Classroom and PowerSchool to track student progress and communicate

Substitute Teacher, Portland Public Schools, Portland OR, September 2018 - June 2019
- Covered classes across 12 schools on short notice

EDUCATION
BA Biology, University of Oregon, 2014 - 2018, Eugene OR`,
    jobDescription: `Customer Success Manager — Luma Software (Portland, OR)

Luma makes scheduling software for K-12 school districts.

Requirements:
- 2+ years in customer success, account management, or client-facing roles
- Excellent communication and conflict resolution skills
- Experience onboarding and training users on software platforms
- Comfortable managing a portfolio of 30+ accounts
- Data-driven approach to tracking customer health and adoption

Nice to have: EdTech experience, familiarity with K-12 school operations`,
  },
  {
    name: 'early-career',
    mode: 'aggressive',
    resumeStyle: 'technical',
    companyName: 'FinPulse',
    resumeText: `Sam Chen
sam.chen@email.com | (555) 662-1148 | Austin, TX | github.com/samchen

EDUCATION
BS Computer Science, University of Texas at Austin, 2021 - 2025 (expected May 2025), GPA 3.7

PROJECTS
Budget Tracker App, 01/2024 - 04/2024
Built a personal finance web app with React and Node.js. Used PostgreSQL for storage and Chart.js for spending visualizations. 200+ users.

Course Scheduler, 09/2023 - 12/2023
Python tool that scrapes course listings and finds conflict-free schedules. Won 2nd place at university hackathon out of 40 teams.

EXPERIENCE
IT Help Desk Assistant, UT Austin, 08/2023 - Present
- Resolve 15-20 student tech support tickets per week
- Wrote documentation that cut repeat tickets by 25%

SKILLS
Python, JavaScript, React, Node.js, PostgreSQL, Git`,
    jobDescription: `Junior Software Engineer — FinPulse (Austin, TX)

FinPulse is a fintech startup building budgeting tools for young professionals.

Requirements:
- BS in Computer Science or equivalent (new grads welcome)
- Proficiency in JavaScript/TypeScript and React
- Familiarity with SQL databases
- Strong problem-solving and communication skills
- Passion for personal finance or fintech products

Nice to have: Node.js, Python, experience shipping a real product to users`,
  },
  {
    name: 'marketing',
    mode: 'aggressive',
    resumeStyle: 'classic',
    companyName: 'BrightWave',
    resumeText: `Jane Smith
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
Google Analytics Certification, Issued: 06/2023, Expires: 06/2026`,
    jobDescription: `Digital Marketing Specialist — BrightWave (Austin, TX)

We're a fast-growing startup looking for someone to own our digital marketing engine.

Requirements:
- 2+ years of digital marketing experience
- Hands-on experience with HubSpot and marketing automation
- Proven social media strategy and content creation skills
- Data-driven mindset: comfortable in Google Analytics
- Strong cross-functional collaboration with sales and product

Nice to have: SEO and SEM experience, email marketing and drip campaigns, paid acquisition (Google Ads, Meta)`,
  },
];

// --- run ---
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const filter = process.argv[2];
const cases = filter ? CASES.filter(c => c.name === filter) : CASES;
if (cases.length === 0) {
  console.error(`No case named "${filter}". Available: ${CASES.map(c => c.name).join(', ')}`);
  process.exit(1);
}

const rows = [];
for (const c of cases) {
  process.stdout.write(`Running ${c.name}... `);
  const t0 = Date.now();
  try {
    const result = await runTailor(anthropic, { ...c, objective: null });
    const secs = ((Date.now() - t0) / 1000).toFixed(1);

    const mustHaves = result.report.keywords.filter(k => k.type === 'must-have');
    const mustFound = mustHaves.filter(k => k.foundIn.length > 0).length;

    // Section preservation: sections marked present in the original text should survive
    const lostSections = [];
    if (/certification|license/i.test(c.resumeText) && !result.resume.includeCertifications) lostSections.push('certifications');
    if (/clinical|practicum/i.test(c.resumeText) && !result.resume.includeClinicalHours) lostSections.push('clinicalHours');
    if (/^projects$/im.test(c.resumeText) && !result.resume.includeProjects) lostSections.push('projects');

    rows.push({
      case: c.name,
      time: `${secs}s`,
      score: `${result.matchScore.before} -> ${result.matchScore.after}`,
      mustHave: `${mustFound}/${mustHaves.length}`,
      gaps: result.report.gaps.length,
      warnings: result.warnings.length,
      lostSections: lostSections.join(',') || '-',
    });
    console.log(`done in ${secs}s`);
    if (result.warnings.length) result.warnings.forEach(w => console.log(`    ⚠ ${w}`));
    if (result.report.gaps.length) console.log(`    gaps: ${result.report.gaps.join(', ')}`);
  } catch (error) {
    console.log('FAILED:', error.message);
    rows.push({ case: c.name, time: '-', score: 'ERROR', mustHave: '-', gaps: '-', warnings: '-', lostSections: '-' });
  }
}

console.log('');
console.table(rows);
