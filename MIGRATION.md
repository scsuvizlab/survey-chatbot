# Migration Guide: Multi-Survey Architecture

## Overview
This update adds support for multiple survey types (workshop feedback and faculty survey) with separate storage directories.

## What Changed

### Directory Structure
```
OLD:
data/sessions/
  └── email_timestamp.json

NEW:
data/sessions/
  ├── workshop/
  │   └── email_timestamp.json
  └── faculty/
      └── email_timestamp.json
```

### API Endpoints
```
OLD:
POST /api/start
POST /api/message
POST /api/summary
POST /api/complete

NEW:
POST /api/workshop/start
POST /api/workshop/message
POST /api/workshop/summary
POST /api/workshop/complete

POST /api/faculty/start
POST /api/faculty/message
POST /api/faculty/summary
POST /api/faculty/complete
```

### Admin Endpoints
```
OLD:
GET /api/admin/sessions
GET /api/admin/sessions/:filename
DELETE /api/admin/sessions/:filename

NEW:
GET /api/admin/sessions?survey_type=workshop|faculty|all
GET /api/admin/sessions/:survey_type/:filename
DELETE /api/admin/sessions/:survey_type/:filename
```

## Migration Steps

### 1. Backup Existing Data
```bash
# On Render shell or locally
cd data
tar -czf sessions-backup-$(date +%Y%m%d).tar.gz sessions/
```

### 2. Run Migration Script
```bash
# Copy new server files
cp migrate-sessions.js server/
cp cleanup-old-sessions.js server/

# Run migration
node server/migrate-sessions.js
```

This will:
- Create `data/sessions/workshop/` directory
- Copy all existing JSONs to workshop folder
- Add `survey_type: 'workshop'` to each file
- Leave originals in place (safety)

### 3. Verify Migration
```bash
# Check new directory
ls -l data/sessions/workshop/

# Compare counts
echo "Old directory:"
ls -1 data/sessions/*.json 2>/dev/null | wc -l
echo "New directory:"
ls -1 data/sessions/workshop/*.json | wc -l
```

### 4. Update Environment Variables
```bash
# Add to .env or Render environment
ADMIN_PASSWORD=your_secure_password
```

### 5. Deploy Updated Code
```bash
git add .
git commit -m "Multi-survey architecture with migration"
git push
```

### 6. Test Admin Access
1. Go to https://your-app.onrender.com/admin.html
2. Login with your ADMIN_PASSWORD
3. Verify sessions appear under "Workshop Feedback"

### 7. Optional: Clean Up Old Files
**ONLY after verifying migration worked!**
```bash
node server/cleanup-old-sessions.js
```

## Rollback Plan

If something goes wrong:

```bash
# Restore from backup
cd data
rm -rf sessions/
tar -xzf sessions-backup-YYYYMMDD.tar.gz

# Revert git commit
git revert HEAD
git push
```

## Environment Variables

### Development (.env)
```
ANTHROPIC_API_KEY=sk-ant-...
PORT=3000
ADMIN_PASSWORD=admin123
```

### Production (Render)
Navigate to: Dashboard → Your Service → Environment
Add:
- `ADMIN_PASSWORD` = `your_secure_password`

## Testing Checklist

- [ ] Migration script runs without errors
- [ ] All files appear in workshop/ folder
- [ ] File count matches (old vs new)
- [ ] Admin login works with password
- [ ] Workshop sessions visible in admin panel
- [ ] Can download individual sessions
- [ ] Can delete individual sessions
- [ ] Analysis works for workshop data
- [ ] Existing workshop feedback URL still works

## Troubleshooting

### "Cannot read directory"
```bash
# Ensure directories exist
mkdir -p data/sessions/workshop
mkdir -p data/sessions/faculty
```

### "401 Unauthorized" on admin page
- Check ADMIN_PASSWORD is set in environment
- Default is 'admin123' if not set
- Clear browser sessionStorage and re-login

### Sessions not appearing
- Check survey_type selector dropdown
- Try "All Surveys" view
- Check server logs for errors

### Migration script errors
- Ensure you're in project root directory
- Check file permissions: `chmod +x server/migrate-sessions.js`
- Run with explicit node: `node server/migrate-sessions.js`

## Files Changed

### New Files
- `server/migrate-sessions.js` - Migration script
- `server/cleanup-old-sessions.js` - Cleanup script
- `MIGRATION.md` - This file

### Modified Files
- `server/server.js` - Multi-survey support, admin auth
- `server/session-manager.js` - Survey type parameter
- `server/config.js` - Both survey configs
- `public/admin.html` - Login, survey selector
- `.env.example` - Admin password variable

### Update Required (Not Changed Yet)
- `public/index.html` - Needs to point to /api/workshop/*
- `public/chat.js` - Needs to point to /api/workshop/*
- `server/claude-service.js` - Needs workshop/faculty split

## Next Steps

1. Run migration on deployed instance
2. Verify workshop feedback still works
3. Build faculty survey interface
4. Test both surveys independently
5. Update documentation

## Questions?

Check server logs:
- Local: Terminal output
- Render: Dashboard → Logs tab

Common issues are usually:
- Missing environment variables
- File permission problems
- Directory path mismatches
