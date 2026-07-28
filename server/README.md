# Scholar's Circle Backend

Express + Prisma + PostgreSQL backend for auth, questions, exams, assignments, analytics, and challenges.

## 1) Setup

1. Copy env file:

```bash
cp .env.example .env
```

2. Edit `.env` values (`DATABASE_URL`, `JWT_SECRET`).

3. Install dependencies:

```bash
npm install
```

## 2) Database

Run migrations + generate client:

```bash
npm run prisma:migrate
npm run prisma:generate
```

Seed demo users/questions:

```bash
npm run prisma:seed
```

## 3) Start API

```bash
npm run dev
```

API base: `http://localhost:4000`

## Demo Accounts

- Teacher: `teacher@example.com` / `teacher123`
- Student: `student@example.com` / `student123`

## Main Routes

- `POST /auth/register`
- `POST /auth/login`
- `GET /subjects`
- `POST /subjects` (teacher)
- `GET /questions`
- `POST /questions` (teacher)
- `POST /sessions` (auth)
- `GET /sessions/mine` (auth)
- `GET /analytics/overview` (auth)
- `GET /assignments` (auth)
- `POST /assignments` (teacher)
- `POST /assignments/:id/submit` (student/teacher auth)
- `POST /challenges` (auth)
- `GET /challenges/:id`
