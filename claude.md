# Claude Context for ATS Tailor / Forapplying

This document provides context for Claude Code sessions working on this project.

## Project Overview

**Forapplying** (formerly ATS Tailor) - A resume tailoring application that helps users optimize their resumes for Applicant Tracking Systems (ATS).

## Recent Features

### Confirmation Dialog Before Download
**Commit:** `8d78d2e`

Prevents accidental double-clicks from consuming download credits.

**Implementation:**
- `src/components/ConfirmationModal.tsx` - Reusable modal component with warning icon, "Cancel" and "Yes, proceed" buttons
- `src/components/ResultView.tsx` - Download buttons now show confirmation before proceeding

### Other Recent Features
- About page and updated welcome screen text (`d21d769`)
- Date format preservation and certification editing enhancements (`29faffa`)
- Missing resume sections in preview + PDF text overlap fixes (`8e4be1b`)
- Employment gap detection with edit/undo functionality (`0011f7a`)

## Critical: Node.js Version Issue

### ⚠️ IMPORTANT: Node.js v24 Performance Problem

**Problem:** Node.js v24 causes severe Vite performance degradation.

| Metric | Node v24 | Node v22 |
|--------|----------|----------|
| Dev server startup | 13 minutes | 756ms |
| Vite build | 27 minutes | ~30 seconds |

**Root Cause:** Node v24 is "current" (bleeding edge), not LTS. Has known performance regressions with Vite.

**Detection:** Run `node --version`. If it shows `v24.x`, that's the problem.

**Fix:**
```bash
nvm use 22
nvm alias default 22
```

**Environment Setup:**
- Uses nvm at `~/.nvm`
- Node v22.13.0 is installed
- Default is now set to v22

**Symptoms to Watch For:**
- Vite dev server takes over a minute to start
- Build takes 10+ minutes
- Requests take 3+ seconds each

## Development Notes

- Main branch: `main`
- Git status includes local settings file: `.claude/settings.local.json` (modified)

## Tech Stack

- Vite (build tool)
- React/TypeScript (framework)
- Node.js v22.13.0 (recommended)
