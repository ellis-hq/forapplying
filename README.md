# ATS Tailor - Professional Resume Optimizer

A professional tool to optimize resumes and cover letters for ATS (Applicant Tracking System) using Claude AI for intelligent keyword matching and semantic optimization.

## Features

- **PDF Resume Upload**: Upload your existing resume in PDF format
- **Keyword Extraction**: Automatically identifies key terms from job descriptions
- **Semantic Mapping**: Intelligently matches your experience to job requirements
- **Two Optimization Modes**:
  - **Conservative**: Minimal changes, focuses on skills/summary keyword injection
  - **Aggressive**: Rephrases experience bullets using JD vocabulary while maintaining factual accuracy
- **ATS Match Score**: Visual indicator of keyword coverage
- **Cover Letter Generation**: Creates a tailored cover letter for the target company
- **PDF Export**: Download ATS-friendly resume and cover letter PDFs

## Prerequisites

- Node.js 18+ 
- An Anthropic API key ([Get one here](https://console.anthropic.com/))

## Setup

1. **Clone or download this project**

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Configure your API key**:
   
   Edit `.env.local` and add your Anthropic API key:
   ```
   ANTHROPIC_API_KEY=sk-ant-api03-xxxxxxxxxxxxx
   ```

4. **Run the development server**:
   ```bash
   npm run dev
   ```

5. **Open in browser**:
   Navigate to `http://localhost:3000`

## Usage

1. **Upload Resume**: Click the upload area and select your PDF resume
2. **Enter Company Name**: Type the target company name
3. **Paste Job Description**: Copy and paste the full job posting text
4. **Select Mode**: Choose Conservative or Aggressive optimization
5. **Generate**: Click "Generate Optimized Package"
6. **Download**: Review the optimized resume and cover letter, then download as PDFs

## Tech Stack

- **Frontend**: React 18 + TypeScript
- **Styling**: Tailwind CSS
- **Build Tool**: Vite
- **AI**: Claude API (Anthropic)
- **PDF Processing**: pdf.js (extraction) + jsPDF (generation)

## Important Notes

- **No Hallucination**: The AI is instructed to never add skills, tools, or jobs not in your original resume
- **Date Preservation**: All dates from your original resume are preserved exactly
- **Privacy**: Your resume data is sent to Claude API for processing but is not stored

## Building for Production

```bash
npm run build
```

The built files will be in the `dist/` directory.

## Security Note

This app uses `dangerouslyAllowBrowser: true` for the Anthropic SDK, which exposes your API key in the browser. For production use, you should:

1. Create a backend API endpoint that proxies requests to Claude
2. Keep your API key server-side only
3. Add rate limiting and authentication

## License

MIT
# ats-resume-tailor
