# Quick Reference Card

## URLs

### Local Development
- Workshop: http://localhost:3000/
- Faculty: http://localhost:3000/faculty-survey.html
- Admin: http://localhost:3000/admin.html

### Production (Update with your URL)
- Workshop: https://your-app.onrender.com/
- Faculty: https://your-app.onrender.com/faculty-survey.html
- Admin: https://your-app.onrender.com/admin.html (password required)

---

## Common Commands

### Local Development
```bash
# Start server
node server/server.js

# Migrate existing data
node server/migrate-sessions.js

# Clean up after migration (optional)
node server/cleanup-old-sessions.js
```

### Git Deployment
```bash
# Add all changes
git add .

# Commit
git commit -m "Your message"

# Push (auto-deploys to Render)
git push
```

### Render Shell Commands
```bash
# Navigate to project
cd /opt/render/project/src

# Run migration
node server/migrate-sessions.js

# Check disk usage
du -sh data/sessions

# List sessions
ls -l data/sessions/workshop/
ls -l data/sessions/faculty/

# View a session
cat data/sessions/workshop/filename.json

# Backup all sessions
tar -czf sessions-backup-$(date +%Y%m%d).tar.gz data/sessions/
```

---

## Environment Variables

### Required
```
ANTHROPIC_API_KEY=sk-ant-...
```

### Optional
```
PORT=3000                    # Default, Render sets automatically
ADMIN_PASSWORD=your_password # Default: admin123
```

Set in Render: Dashboard → Your Service → Environment

---

## Admin Dashboard

### Login
- URL: /admin.html
- Password: Value of ADMIN_PASSWORD env var
- Default: admin123

### Survey Filters
- **All Surveys** - Shows both workshop and faculty
- **Workshop Feedback** - Workshop only
- **Faculty AI Survey** - Faculty only

### Actions
- **Run Analysis** - Generate LLM report (select specific survey first)
- **Manage JSON Files** - Download or delete sessions
- **Download All** - Get all sessions as single JSON
- **Delete All** - Remove all sessions (double confirmation)

---

## Data Locations

### Local
```
data/
└── sessions/
    ├── workshop/
    │   └── email_timestamp.json
    └── faculty/
        └── email_timestamp.json
```

### Render
```
/opt/render/project/src/data/
└── sessions/
    ├── workshop/
    └── faculty/
```

---

## API Endpoints

### Workshop Feedback
```
POST /api/workshop/start
POST /api/workshop/message
POST /api/workshop/summary
POST /api/workshop/complete
```

### Faculty Survey
```
POST /api/faculty/start
POST /api/faculty/message
POST /api/faculty/summary
POST /api/faculty/complete
```

### Admin (Requires Auth Header)
```
GET    /api/admin/sessions?survey_type=workshop|faculty|all
GET    /api/admin/sessions/:survey_type/:filename
DELETE /api/admin/sessions/:survey_type/:filename
GET    /api/admin/sessions-all/:survey_type
DELETE /api/admin/sessions-all/:survey_type
POST   /api/admin/analyze/:survey_type
```

---

## Troubleshooting Quick Fixes

### Can't login to admin
```bash
# Check password is set
echo $ADMIN_PASSWORD

# Try default
Password: admin123

# Reset in Render
Dashboard → Environment → Edit ADMIN_PASSWORD → Save
```

### Sessions not saving
```bash
# Check directories exist
ls -la data/sessions/

# Create if missing
mkdir -p data/sessions/workshop
mkdir -p data/sessions/faculty

# On Render, check disk mounted
Dashboard → Disks → Verify mount path
```

### Survey not loading
```bash
# Check logs
# Local: Terminal output
# Render: Dashboard → Logs

# Verify environment
echo $ANTHROPIC_API_KEY  # Should not be empty
```

### Need to start over
```bash
# Delete all test data via admin panel
# Or via shell:
rm -rf data/sessions/workshop/*.json
rm -rf data/sessions/faculty/*.json
```

---

## File Locations

### Backend
- `server/server.js` - Main server
- `server/claude-service.js` - AI logic
- `server/session-manager.js` - File operations
- `server/config.js` - Survey definitions

### Frontend  
- `public/index.html` - Workshop UI
- `public/chat.js` - Workshop logic
- `public/faculty-survey.html` - Faculty UI
- `public/faculty-survey.js` - Faculty logic
- `public/admin.html` - Admin dashboard
- `public/styles.css` - Shared styles

### Documentation
- `README.md` - Setup guide
- `MIGRATION.md` - Migration guide
- `DEPLOYMENT-CHECKLIST.md` - Launch checklist
- `BUILD-SUMMARY.md` - What we built
- `TIIS-DOCUMENTATION.md` - Technical docs

---

## Quick Maintenance

### Weekly Tasks
- [ ] Download backup via admin panel
- [ ] Review completion rates
- [ ] Check for errors in logs
- [ ] Verify disk usage under 1GB

### Before Big Launch
- [ ] Delete all test sessions
- [ ] Test both surveys end-to-end
- [ ] Verify admin password is secure
- [ ] Update URLs in launch emails

### After Launch
- [ ] Monitor first 10 responses
- [ ] Check for technical issues
- [ ] Respond to user questions
- [ ] Download daily backups

---

## Support Contacts

### Services
- Anthropic: support@anthropic.com
- Render: support@render.com
- GitHub: support.github.com

### Internal
- Technical: [Your Email]
- NextEd Team: [Team Email]
- Questions: [Support Email]

---

## Version
NextEd Multi-Survey System v0.5
Last Updated: December 2024
