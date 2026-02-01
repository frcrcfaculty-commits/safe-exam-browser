# Safe Browser for Proctored Exams

A locked-down exam browser for college lab environments with auto-grading and proctoring capabilities.

## Architecture

```
safe-exam-browser/
├── server/          # Node.js + Express + PostgreSQL
│   ├── src/
│   │   ├── routes/  # API endpoints
│   │   ├── middleware/
│   │   └── index.js
│   └── prisma/      # Database schema
└── client/          # Electron app
    └── src/
        ├── main/    # Electron main process
        └── renderer/ # React UI
```

## Quick Start

### Prerequisites

- Node.js 18+
- PostgreSQL 15+
- npm or yarn

### Server Setup

```bash
cd server

# Install dependencies
npm install

# Create .env file
cp .env.example .env
# Edit .env with your database credentials

# Run database migrations
npx prisma migrate dev --name init

# Generate Prisma client
npx prisma generate

# Seed database with sample data
npm run db:seed

# Start server
npm run dev
```

Server runs at `http://localhost:3001`

**Default Login Credentials:**
- Admin: `admin@college.edu` / `admin123`
- Professor: `professor@college.edu` / `prof123`

### Client Setup

```bash
cd client

# Install dependencies
npm install

# Start in development mode
npm run dev
```

### Production Build (Windows)

```bash
cd client
npm run build:win
```

The installer will be created in `client/dist/`.

## API Endpoints

### Authentication
- `POST /api/auth/login` - Login
- `POST /api/auth/register` - Register (admin only)

### Exams (Professor)
- `GET /api/exams` - List exams
- `POST /api/exams` - Create exam
- `POST /api/exams/:id/questions` - Add questions
- `PUT /api/exams/:id/publish` - Publish exam
- `GET /api/exams/:id/monitor` - Live monitoring
- `GET /api/exams/:id/export` - Export CSV results

### Client
- `POST /api/client/register` - Register device
- `GET /api/client/exams` - Get available exams
- `POST /api/client/start` - Start exam session
- `GET /api/client/exam` - Get exam questions
- `POST /api/client/save` - Auto-save response
- `POST /api/client/submit` - Submit exam
- `POST /api/client/heartbeat` - Send heartbeat + events

## Security Features

### Lockdown (Windows)
- Kiosk/fullscreen mode
- Block Alt+Tab, Win key, PrintScreen
- Block Ctrl+C/V/X (clipboard)
- Disable DevTools, right-click, view source
- Focus loss detection and logging

### Proctoring
- Continuous heartbeat monitoring
- Event logging (focus loss, blocked shortcuts)
- Session flags for suspicious activity

## Lab Deployment

1. Install Safe Exam Browser on all lab PCs
2. Configure Group Policy for Shell Launcher (optional)
3. Register devices with the server
4. Approve devices in admin panel
5. Professors can create and publish exams
6. Students enter roll number to start

## Sample MCQ Template

The seed script creates a sample exam with 10 questions. Professors can:
1. Login at the admin dashboard
2. Create new exams
3. Add MCQ questions (text, 4 options, correct answer)
4. Publish to make available on client

## License

MIT
