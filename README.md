# NextEd Survey System

Multi-survey conversational feedback system using Claude AI. Currently hosts two surveys:
1. **Workshop Feedback** - Post-event conversational interview
2. **Faculty AI Survey** - General AI adoption survey with structured questions

## Features

- **Conversational AI** - Natural dialogue using Claude Sonnet 4.5
- **Hybrid Format** - Structured questions + adaptive follow-ups
- **Multi-Survey Support** - Separate endpoints and storage per survey
- **Admin Dashboard** - View, download, delete sessions; run LLM analysis
- **Progress Tracking** - Visual indicators for topics/sections
- **Auto-Save** - Incremental session persistence
- **Summary Generation** - AI-generated summaries with user review

## Quick Start

### Prerequisites
- Node.js 18+
- Anthropic API key

### Installation

```bash
# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env and add your ANTHROPIC_API_KEY and ADMIN_PASSWORD

# Create data directories
mkdir -p data/sessions/workshop
mkdir -p data/sessions/faculty

# Start server
node server/server.js
```

### Access URLs

- **Workshop Feedback:** http://localhost:3000/
- **Faculty Survey:** http://localhost:3000/faculty-survey.html
- **Admin Dashboard:** http://localhost:3000/admin.html

## Project Structure

```
├── server/
│   ├── server.js              # Express app with multi-survey routes
│   ├── claude-service.js      # Claude API integration (workshop + faculty)
│   ├── session-manager.js     # JSON file operations
│   ├── config.js              # Survey definitions
│   ├── migrate-sessions.js    # Migration script for existing data
│   └── cleanup-old-sessions.js # Optional cleanup script
│
├── public/
│   ├── index.html             # Workshop feedback interface
│   ├── chat.js                # Workshop feedback logic
│   ├── faculty-survey.html    # Faculty survey interface
│   ├── faculty-survey.js      # Faculty survey logic
│   ├── admin.html             # Admin dashboard
│   ├── styles.css             # Shared styles
│   └── nexted_logo1.png       # Banner image
│
├── data/
│   └── sessions/
│       ├── workshop/          # Workshop feedback JSONs
│       └── faculty/           # Faculty survey JSONs
│
├── .env                       # Environment variables (not in repo)
├── .gitignore
├── package.json
├── README.md                  # This file
└── MIGRATION.md              # Migration guide for existing deployments
```

## API Endpoints

### Workshop Feedback
- `POST /api/workshop/start` - Start session
- `POST /api/workshop/message` - Send message
- `POST /api/workshop/summary` - Generate summary
- `POST /api/workshop/complete` - Complete session

### Faculty Survey
- `POST /api/faculty/start` - Start session
- `POST /api/faculty/message` - Send message
- `POST /api/faculty/summary` - Generate summary
- `POST /api/faculty/complete` - Complete session

### Admin (Requires Auth)
- `GET /api/admin/sessions?survey_type=workshop|faculty|all` - List sessions
- `GET /api/admin/sessions/:survey_type/:filename` - Download session
- `DELETE /api/admin/sessions/:survey_type/:filename` - Delete session
- `GET /api/admin/sessions-all/:survey_type` - Download all
- `DELETE /api/admin/sessions-all/:survey_type` - Delete all
- `POST /api/admin/analyze/:survey_type` - Run LLM analysis

## Deployment to Render

### 1. Push to GitHub

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/username/nexted-surveys.git
git push -u origin main
```

### 2. Create Render Service

- New Web Service → Connect GitHub repo
- **Build Command:** `npm install`
- **Start Command:** `node server/server.js`
- **Environment Variables:**
  - `ANTHROPIC_API_KEY` = your_key
  - `ADMIN_PASSWORD` = your_password

### 3. Add Persistent Disk

After deployment:
- Dashboard → Your Service → Disks
- Add Disk:
  - **Mount Path:** `/opt/render/project/src/data/sessions`
  - **Size:** 1 GB

### 4. Migrate Existing Data (If Applicable)

If you have existing sessions in flat directory:

```bash
# Via Render shell
cd /opt/render/project/src
node server/migrate-sessions.js
```

See [MIGRATION.md](MIGRATION.md) for detailed instructions.

## Admin Dashboard

### Login

Navigate to `/admin.html` and enter your `ADMIN_PASSWORD`.

### Features

- **Survey Selector** - View all surveys or filter by type
- **Session Statistics** - Total, completed, in-progress counts
- **JSON Management** - Download/delete individual or all sessions
- **LLM Analysis** - Generate comprehensive analysis reports
- **Export Options** - Copy to clipboard or download as .txt

### Changing Admin Password

**On Render:**
Dashboard → Your Service → Environment → Edit `ADMIN_PASSWORD`

**Locally:**
Edit `.env` file

## Survey Structures

### Workshop Feedback (8 Topics)
1. Workshop Experience
2. Specific Content
3. Newton Song Demo
4. NextEd Interest
5. AI Concerns
6. Technical Comfort
7. Course Ideas
8. Survey Experience

### Faculty Survey (6 Sections)
1. AI Awareness & Usage
2. Interest in AI for Teaching (5 ratings)
3. Concerns & Barriers (6 T/F questions)
4. Support Needs (ranking)
5. NextEd Services (3 ratings)
6. Background Information

## Customization

### Adding a New Survey

1. **Define structure in `config.js`:**
```javascript
const newSurveyInfo = {
  // Survey definition
};
```

2. **Add methods in `claude-service.js`:**
```javascript
function sendNewSurveyMessage() { ... }
function generateNewSurveySummary() { ... }
```

3. **Add routes in `server.js`:**
```javascript
app.post('/api/newsurvey/start', ...);
// etc.
```

4. **Create frontend:**
- `new-survey.html`
- `new-survey.js`

5. **Create data directory:**
```bash
mkdir -p data/sessions/newsurvey
```

### Modifying Survey Questions

Edit `config.js`:
- Workshop: `workshopTopics` array
- Faculty: `facultySections` array

### Changing Time Limits

Edit JavaScript files:
- Workshop: `chat.js` - line with `minutes >= 10`
- Faculty: `faculty-survey.js` - line with `minutes >= 12`

## Data Format

Each session is stored as JSON:

```json
{
  "session_id": "uuid",
  "survey_type": "workshop|faculty",
  "status": "in-progress|completed",
  "participant": {
    "name": "...",
    "email": "...",
    "start_time": "ISO timestamp"
  },
  "conversation": [
    {
      "role": "assistant|user",
      "content": "message text",
      "timestamp": "ISO timestamp"
    }
  ],
  "summary": {
    "initial": "...",
    "confirmed": "...",
    "user_edits": null
  },
  "completed_time": "ISO timestamp",
  "last_updated": "ISO timestamp"
}
```

## Troubleshooting

### "401 Unauthorized" on admin page
- Check `ADMIN_PASSWORD` is set in environment
- Default is 'admin123' if not set
- Clear browser sessionStorage and re-login

### Sessions not saving
- Check data/sessions directories exist
- Check file permissions
- Check Render disk is mounted correctly

### Claude API errors
- Verify `ANTHROPIC_API_KEY` is correct
- Check API key has sufficient credits
- Check rate limits not exceeded

### Migration issues
- See [MIGRATION.md](MIGRATION.md)
- Backup data first
- Run migration script from project root

## Development

### Running locally

```bash
npm install
node server/server.js
```

### Testing

Test with bogus data:
1. Use fake email addresses
2. Complete surveys
3. Test admin dashboard
4. Delete test data via admin panel

### Deploying changes

```bash
git add .
git commit -m "Description"
git push
```

Render auto-deploys on push to main branch.

## Dependencies

```json
{
  "express": "^4.21.2",
  "cors": "^2.8.5",
  "dotenv": "^16.4.7",
  "@anthropic-ai/sdk": "^0.32.1"
}
```

## Environment Variables

### Required
- `ANTHROPIC_API_KEY` - Claude API key

### Optional
- `PORT` - Server port (default: 3000)
- `ADMIN_PASSWORD` - Admin dashboard password (default: 'admin123')

## Security Notes

- Admin dashboard uses simple password auth (good for pilot, not production)
- No rate limiting implemented (add for public deployment)
- No email verification (users can use fake emails)
- HTTPS enforced by Render in production
- Sessions stored as plain JSON (no encryption)

## Future Enhancements

- [ ] Database migration (PostgreSQL/MongoDB)
- [ ] Enhanced admin authentication (JWT tokens)
- [ ] Rate limiting
- [ ] Email verification
- [ ] Session recovery/resume capability
- [ ] Voice input/output
- [ ] Real-time analytics dashboard
- [ ] Export to CSV/Excel
- [ ] A/B testing framework

## License

Internal use - TrueNorth AI Services / NextEd Initiative

## Contact

For issues or questions about this system, contact the NextEd team.
