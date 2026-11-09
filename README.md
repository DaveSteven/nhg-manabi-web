# JLPT GO! Frontend

JLPT study web app built with React, TypeScript, Vite, and React Router.

The app provides book-based quizzes, mixed practice, wrong-question review, mock exam sessions, exam result review, and local resume support for in-progress practice.

## Tech Stack

- React 19
- TypeScript
- Vite
- React Router
- lucide-react icons

## Requirements

- Node.js 20 or newer is recommended
- npm
- The API server should be available at `http://127.0.0.1:8000` by default

## Setup

```bash
npm install
```

Start the development server:

```bash
npm run dev
```

Open:

```text
http://localhost:5173/
```

## Environment

The frontend reads API requests from `VITE_API_BASE`.

Default:

```text
http://127.0.0.1:8000
```

Example override:

```bash
VITE_API_BASE=http://localhost:8000 npm run dev
```

## Scripts

```bash
npm run dev
```

Runs the local Vite development server.

```bash
npm run typecheck
```

Runs TypeScript checking with `tsc --noEmit`.

```bash
npm run build
```

Builds the production frontend into `dist/`.

```bash
npm run preview
```

Previews the production build locally.

## Routes

- `/` - library home page
- `/quiz` - active quiz or quiz result
- `/wrong` - wrong-question notebook
- `/user` - user profile and recent history
- `/exams` - mock exam library
- `/exams/:examId` - active exam session
- `/exams/:examId/review/:attemptId` - exam result and explanation review

Unknown routes redirect to `/`.

## Project Structure

```text
src/
  main.tsx          React entrypoint and BrowserRouter setup
  App.tsx           application state, API actions, and route wiring
  pages/index.tsx   page/view components
  lib/study.ts      API helper, data mappers, exam helpers, cache helpers
  styles.css        global styles
```

Raw quiz import data is kept outside the public Vite directory under:

```text
source_data/
```

The browser receives filtered quiz payloads from the API. Do not move raw quiz
data into `public/`, because those files include answer and explanation fields
and Vite publishes that directory without access control.

## Local State

The app uses `localStorage` for:

- auth session token
- in-progress quiz state
- in-progress exam answer cache

This lets practice and exam pages survive refreshes or browser tab suspension.

## Development Notes

- The frontend expects the backend API to provide auth, quiz, wrong-question, exam, and attempt endpoints.
- Deep links are handled by React Router. In production, the web server should fall back to `index.html` for non-API routes.
- During local development, Vite handles route fallback automatically.

## Verification

Before pushing changes, run:

```bash
npm run typecheck
npm run build
```
