# Forapply - Professional Resume Optimizer

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
- **User Authentication**: Supabase-powered auth with email/password
- **Download Limits**: 5 free downloads per day per user (resets every 24 hours)

## Prerequisites

- Node.js 18+
- An Anthropic API key ([Get one here](https://console.anthropic.com/))
- A Supabase project ([Create one here](https://supabase.com/))

## Setup

### 1. Clone or download this project

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

Copy the example environment file:

```bash
cp .env.example .env
```

Edit `.env` and fill in your values:

```env
# Backend (server-side only - keep secret!)
ANTHROPIC_API_KEY=sk-ant-api03-your-key-here

# Frontend (client-side)
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

### 4. Set up Supabase

In your Supabase project, create the `user_profiles` table:

```sql
CREATE TABLE user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id),
  email TEXT NOT NULL,
  resume_downloads INTEGER DEFAULT 0,
  downloads_reset_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only access their own profile
CREATE POLICY "Users can view own profile" ON user_profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON user_profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON user_profiles
  FOR INSERT WITH CHECK (auth.uid() = id);
```

### 5. Run the development server

```bash
npm run dev
```

This starts both:
- **Backend server** on `http://localhost:3001` (handles Claude API calls)
- **Frontend** on `http://localhost:3000` (Vite dev server)

### 6. Open in browser

Navigate to `http://localhost:3000`

## Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Frontend      │────▶│   Backend       │────▶│   Claude API    │
│   (React/Vite)  │     │   (Express)     │     │   (Anthropic)   │
│   Port 3000     │     │   Port 3001     │     │                 │
└─────────────────┘     └─────────────────┘     └─────────────────┘
        │                       │
        │                       │
        ▼                       ▼
┌─────────────────┐     ┌─────────────────┐
│   Supabase      │     │   Rate Limiting │
│   (Auth + DB)   │     │   (10 req/min)  │
└─────────────────┘     └─────────────────┘
```

**Security**: The Anthropic API key is kept server-side only. The frontend never has access to it.

## Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start both frontend and backend in development mode |
| `npm run dev:client` | Start only the frontend (Vite) |
| `npm run dev:server` | Start only the backend (Express) |
| `npm run build` | Build the frontend for production |
| `npm run preview` | Preview the production build |
| `npm start` | Start the backend server (for production) |

## Usage

1. **Sign Up/Sign In**: Create an account or sign in with your email
2. **Upload Resume**: Click the upload area and select your PDF resume
3. **Enter Company Name**: Type the target company name
4. **Paste Job Description**: Copy and paste the full job posting text
5. **Select Mode**: Choose Conservative or Aggressive optimization
6. **Generate**: Click "Generate Optimized Package"
7. **Review & Edit**: Review the AI suggestions and make any edits
8. **Download**: Download your optimized resume and cover letter as PDFs

## Tech Stack

- **Frontend**: React 18 + TypeScript + Tailwind CSS
- **Build Tool**: Vite
- **Backend**: Express.js
- **AI**: Claude API (Anthropic)
- **Auth**: Supabase
- **PDF Processing**: pdf.js (extraction) + jsPDF (generation)

## Security Features

- **API Key Protection**: Anthropic API key is server-side only
- **Rate Limiting**: 10 requests per minute per IP address
- **Input Validation**: All inputs are validated and sanitized
- **Error Handling**: Sensitive error details are never exposed to clients
- **Authentication**: Supabase handles user authentication securely
- **Download Limits**: 5 downloads per day prevents abuse

## Important Notes

- **No Hallucination**: The AI is instructed to never add skills, tools, or jobs not in your original resume
- **Date Preservation**: All dates from your original resume are preserved exactly
- **Privacy**: Your resume data is sent to Claude API for processing but is not stored permanently

## Production Deployment

For production, you'll need to:

1. Deploy the backend separately (e.g., on Railway, Render, or AWS)
2. Set `VITE_API_URL` to point to your production backend URL
3. Set `CORS_ORIGIN` to your production frontend URL
4. Build and deploy the frontend (e.g., on Vercel, Netlify)

## License

MIT
