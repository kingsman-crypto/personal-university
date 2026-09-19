# Project Handoff: Personal University 🎓

## Overview
**Personal University** is an autonomous daily educational dispatch platform that curates and delivers structured morning syllabi across active courses directly to your email inbox.

---

## Key Architecture & Components

1. **Autonomous Cloud Dispatch Engine** ([`scripts/cloud-dispatch.mjs`](scripts/cloud-dispatch.mjs)):
   - A standalone ES module script that runs anywhere (GitHub Actions, local CLI, serverless cron, or background daemon).
   - Generates unique course sections using either the Gemini API or the built-in curated sequential educational libraries.
   - Evaluates past issues in [`data/dispatch_history.json`](data/dispatch_history.json) with strict duplicate detection (exact title matches and key phrase collisions) to enforce a zero-repetition policy.
   - Compiles a responsive, elegant HTML newsletter matching academic typography standards.
   - Delivers the email via Gmail SMTP using Nodemailer and records the issue to history.

2. **Zero-Machine Scheduled Delivery** ([`.github/workflows/daily-dispatch.yml`](.github/workflows/daily-dispatch.yml)):
   - Runs Monday through Friday at **11:00 UTC (07:00 AM EDT / 06:00 AM EST)** on GitHub's cloud runners.
   - Executes completely in the cloud without requiring any local computer to be turned on or awake.
   - Automatically commits and pushes the updated [`data/dispatch_history.json`](data/dispatch_history.json) back to `main` using the runner's credentials (`[skip ci]`).
   - Supports manual triggering on demand via GitHub's `workflow_dispatch` interface with an optional `--force` flag.

3. **Local Scheduler with Offline Catch-Up Logic** ([`src/lib/serverScheduler.ts`](src/lib/serverScheduler.ts)):
   - Runs inside the Next.js process (`npm run dev`).
   - Polling ticker checks every 60 seconds.
   - Includes catch-up logic: if the machine was asleep or offline during the 07:00 AM window, the scheduler detects that today's delivery was missed and immediately executes catch-up delivery upon waking or server start.

4. **Next.js Web Application** ([`src/app/`](src/app/)):
   - Interactive dashboard for managing courses, designing curriculum blueprints with the AI Curriculum Architect, adjusting delivery schedules, and previewing dispatches in real-time.

---

## Data Structure & Storage

All application state is maintained in human-readable JSON files in [`data/`](data/):
- [`data/settings.json`](data/settings.json): Newsletter title, subtitle, recipient email, delivery days (`[1, 2, 3, 4, 5]`), delivery time (`"07:00"`), timezone (`"America/New_York"`), and email provider credentials.
- [`data/courses.json`](data/courses.json): Course list, categories, reading times, enabled status, and AI curriculum instructions/blueprints.
- [`data/dispatch_history.json`](data/dispatch_history.json): Permanent archive of past dispatches used to guarantee non-repeating subjects.

---

## Quick Reference CLI Commands

```bash
# Start local web interface
npm run dev

# Check current scheduler status and next run time
npm run dispatch -- --status

# Trigger an immediate forced dispatch (bypasses day/duplicate checks for testing)
npm run dispatch:test

# Dry-run test (generates lessons and HTML preview without sending email or modifying history)
npm run dispatch -- --dry-run

# Run production build
npm run build

# Run linter
npm run lint
```

---

## GitHub Secrets (Optional but Recommended)

In the repository settings on GitHub (**Settings > Secrets and variables > Actions**), you can configure:
- `GMAIL_USER`: Google account username (`omghubert@gmail.com`)
- `GMAIL_APP_PASSWORD`: 16-character Google App Password
- `GEMINI_API_KEY`: Google Gemini API key
