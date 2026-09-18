# Personal University 🎓

A personalized daily educational dispatch platform delivering curated morning syllabi straight to your email inbox.

---

## ⚡ Automated Daily Dispatches (Computer-Off Delivery)

Personal University is designed to generate and send daily morning dispatches **even when your computer is completely turned off or asleep**.

### How Cloud Delivery Works
Daily dispatches are scheduled and delivered via **GitHub Actions** (`.github/workflows/daily-dispatch.yml`):
- **Cloud Cron**: Executes Monday through Friday at **11:00 UTC (07:00 AM EDT / 06:00 AM EST)** in GitHub's cloud environment.
- **Independent Execution**: Generates your unique course lessons (with zero-repetition safeguards), compiles the responsive HTML email, and delivers it via Gmail SMTP to `omghubert@gmail.com`.
- **Automatic History Persistence**: Commits and pushes the updated `data/dispatch_history.json` back to your repository so the syllabus archive and anti-repetition memory remain seamless across all future dispatches.

### Activating Cloud Automation on GitHub
To enable the cloud runner, simply push this repository to GitHub:

```bash
# 1. Create a new GitHub repository (e.g. personal-university) at https://github.com/new
# 2. Link and push your repository:
git remote add origin https://github.com/<your-username>/<your-repo-name>.git
git push -u origin main
```

Once pushed, the **Personal University Daily Morning Dispatch** workflow will automatically activate under the **Actions** tab.

#### Optional: GitHub Secrets
For extra security, you can store your credentials in GitHub Secrets (**Settings > Secrets and variables > Actions**):
- `GMAIL_USER`: `omghubert@gmail.com`
- `GMAIL_APP_PASSWORD`: your 16-character Google App Password
- `GEMINI_API_KEY`: (optional) your Gemini API key

*(If not set as secrets, the runner securely reads your existing configurations in `data/settings.json`)*.

---

## 💻 Local Commands & Testing

You can also run the dispatcher or development server locally at any time:

```bash
# Start the interactive UI
npm run dev

# Check scheduler status and upcoming run
npm run dispatch -- --status

# Test generating and delivering a dispatch immediately
npm run dispatch:test

# Dry-run test (generates lessons and HTML preview without sending email or recording history)
npm run dispatch -- --dry-run
```

### Local Scheduler Catch-up Logic
When running the Next.js server locally (`npm run dev`), the built-in scheduler (`src/lib/serverScheduler.ts`) includes automated catch-up logic:
- If your computer was asleep or off at 07:00 AM, the scheduler detects upon waking or starting that today's delivery was missed, and immediately triggers catch-up delivery without waiting for tomorrow.
