const fs = require('fs').promises;
const path = require('path');

const SESSIONS_DIR = path.join(__dirname, '../data/sessions');

// Ensure sessions directory exists
async function ensureSessionsDir() {
  try {
    await fs.access(SESSIONS_DIR);
  } catch {
    await fs.mkdir(SESSIONS_DIR, { recursive: true });
  }
}

// Sanitize email for filename
function sanitizeEmail(email) {
  return email.replace('@', '_at_').replace(/[^a-zA-Z0-9._-]/g, '_');
}

// Generate filename
function generateFilename(email) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('.')[0];
  const sanitized = sanitizeEmail(email);
  return `${sanitized}_${timestamp}.json`;
}

// Create new session
async function createSession(name, email) {
  await ensureSessionsDir();
  
  const sessionData = {
    session_id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    status: 'in_progress',
    participant: {
      name,
      email,
      start_time: new Date().toISOString()
    },
    conversation: [],
    last_updated: new Date().toISOString()
  };
  
  const filename = generateFilename(email);
  const filepath = path.join(SESSIONS_DIR, filename);
  
  await fs.writeFile(filepath, JSON.stringify(sessionData, null, 2));
  
  return { filename, sessionData };
}

// Update session with new message
async function updateSession(filename, role, content) {
  const filepath = path.join(SESSIONS_DIR, filename);
  
  const data = await fs.readFile(filepath, 'utf8');
  const sessionData = JSON.parse(data);
  
  sessionData.conversation.push({
    role,
    content,
    timestamp: new Date().toISOString()
  });
  
  sessionData.last_updated = new Date().toISOString();
  
  await fs.writeFile(filepath, JSON.stringify(sessionData, null, 2));
  
  return sessionData;
}

// Mark session as completed
async function completeSession(filename, summary) {
  const filepath = path.join(SESSIONS_DIR, filename);
  
  const data = await fs.readFile(filepath, 'utf8');
  const sessionData = JSON.parse(data);
  
  sessionData.status = 'completed';
  sessionData.summary = summary;
  sessionData.completed_time = new Date().toISOString();
  
  await fs.writeFile(filepath, JSON.stringify(sessionData, null, 2));
  
  return sessionData;
}

module.exports = {
  createSession,
  updateSession,
  completeSession
};