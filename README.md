# What Should I Do Next

A personal productivity desktop app built for university students — helps you decide what to study, when to study it, and how to stay on track.

Built with **React + Electron**, runs fully offline on macOS. Uses Supabase for optional account sync and Groq (Llama 3.3) for AI features.

---

## Features

### Dashboard
Daily motivational quote, overview of today's tasks, upcoming exams, and a weekly study progress summary at a glance.

### Today's Plan
Task list filtered by your current **energy level** (high / medium / low / exhausted) and time of day (morning / afternoon / evening). Tasks are sorted using the **Eisenhower matrix** — the app suggests what to tackle first based on urgency, importance, and how you're feeling.

### Weekly Schedule
Drag-and-drop schedule builder. Create recurring or one-off blocks for study sessions, breaks, household tasks, and events. Supports daily, weekly, bi-weekly, and monthly frequencies.

### Exam Tracker
Add exams and tests with deadlines, break them down by topic, and rate your **confidence per topic** (don't know → know very well). Includes a countdown and urgency indicators.

### Study Hours & Goals
Log study sessions manually or via the **Pomodoro timer** (25 / 50 / 60-minute focus modes + short and long breaks + stopwatch mode). Set weekly hour targets per subject and track progress.

### Projects
Kanban-style project tracker with status (active / paused / completed), priority levels, deadlines, and subtasks.

### Study Diary
Daily reflection log — what you studied, how it went, notes. Generates an AI-powered weekly review via Groq.

### Statistics
Visual breakdown of study hours per subject, weekly trends, and session streaks.

### AI Study Companion
Chat interface powered by **Groq (Llama 3.3 70B)**. Answers questions, explains concepts, generates flashcards, summarises topics — in whatever language you write in. Context-aware: knows your subjects and study methods from your settings.

### PDF Analysis
Upload a PDF (lecture notes, past papers) and get an AI-generated summary, key points, and study suggestions.

---

## Tech Stack

| Layer | Technology |
|---|---|
| UI | React 18 + Lucide React |
| Desktop | Electron 31 |
| Bundler | Vite 5 |
| Auth & sync | Supabase (optional — app works fully offline in Electron mode) |
| AI | Groq API — Llama 3.3 70B Versatile |
| Data persistence | localStorage (offline-first) |
| Build | electron-builder — outputs `.dmg` + `.zip` for macOS arm64 |

---

## Security

- No secrets in source code — Supabase credentials via `.env`, Groq API key entered by the user in Settings and stored in `localStorage`
- Electron hardened: `webSecurity: true`, plaintext HTTP requests to external hosts blocked, navigation restricted to expected origins
- Centralised auth logger with suspicious login detection (repeated failures within 15 minutes)

---

## Getting Started

### Prerequisites
- Node.js 18+
- A [Supabase](https://supabase.com) project (optional — only needed for account sync on the web version)
- A [Groq](https://console.groq.com) API key (optional — only needed for AI features)

### Install & run

```bash
git clone https://github.com/marianalameiro03-debug/what-should-i-do-next.git
cd what-should-i-do-next

cp .env.example .env
# Fill in VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env

npm install
npm run electron:dev    # development mode
```

### Build for macOS

```bash
npm run electron:build
# Output: dist-electron/What Should I Do Next-1.0.0-arm64.dmg
```

---

## Project Structure

```
src/
├── components/       # All UI views (Dashboard, SchedulePage, ExamsView, ...)
├── constants/        # Shared constants (quadrants, energy levels, periods, ...)
├── utils/            # Shared utilities (date helpers)
├── hooks/            # useUserSettings, useStudyData
├── lib/              # Supabase client, structured logger
└── data/             # Static schedule data
electron/
├── main.cjs          # Electron main process (security hardened)
└── preload.cjs       # Preload script
```

---

*Personal project — built to support my own study routine.*
