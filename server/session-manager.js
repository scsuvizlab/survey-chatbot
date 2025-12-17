const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

const BASE_DATA_DIR = path.join(__dirname, '../data/sessions');

// Simple password hashing (for pilot - use bcrypt for production)
function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

// Create a new session with password
async function createSession(name, email, password) {
  const sessionId = crypto.randomUUID();
  const timestamp = new Date().toISOString();
  
  // Sanitize email for filename
  const sanitizedEmail = email
    .replace('@', '_at_')
    .replace(/[^a-zA-Z0-9_.-]/g, '_');
  
  // Create filename
  const filenameTimestamp = timestamp.replace(/[:.]/g, '-').replace('Z', '');
  const filename = `${sanitizedEmail}_${filenameTimestamp}.json`;
  
  const sessionData = {
    session_id: sessionId,
    status: 'in-progress',
    participant: {
      name,
      email,
      password_hash: hashPassword(password),
      start_time: timestamp
    },
    conversation: [],
    summary: null,
    completed_time: null,
    last_updated: timestamp,
    last_accessed: timestamp
  };
  
  const filepath = path.join(BASE_DATA_DIR, filename);
  
  // Ensure directory exists
  await fs.mkdir(BASE_DATA_DIR, { recursive: true });
  
  await fs.writeFile(filepath, JSON.stringify(sessionData, null, 2), 'utf8');
  
  return { filename, sessionData };
}

// Find existing session by email
async function findSessionByEmail(email) {
  try {
    const files = await fs.readdir(BASE_DATA_DIR);
    const sanitizedEmail = email
      .replace('@', '_at_')
      .replace(/[^a-zA-Z0-9_.-]/g, '_');
    
    // Find files that start with this email
    const matchingFiles = files.filter(f => 
      f.startsWith(sanitizedEmail) && f.endsWith('.json')
    );
    
    if (matchingFiles.length === 0) {
      return null;
    }
    
    // Return the most recent session for this email
    const sessionFile = matchingFiles[matchingFiles.length - 1];
    const filepath = path.join(BASE_DATA_DIR, sessionFile);
    const content = await fs.readFile(filepath, 'utf8');
    const sessionData = JSON.parse(content);
    
    return { filename: sessionFile, sessionData };
  } catch (error) {
    console.error('Error finding session:', error);
    return null;
  }
}

// Authenticate and load session
async function authenticateSession(email, password) {
  const session = await findSessionByEmail(email);
  
  if (!session) {
    return { success: false, error: 'No session found for this email' };
  }
  
  const passwordHash = hashPassword(password);
  
  if (session.sessionData.participant.password_hash !== passwordHash) {
    return { success: false, error: 'Incorrect password' };
  }
  
  // Update last accessed time
  session.sessionData.last_accessed = new Date().toISOString();
  const filepath = path.join(BASE_DATA_DIR, session.filename);
  await fs.writeFile(filepath, JSON.stringify(session.sessionData, null, 2), 'utf8');
  
  return { 
    success: true, 
    filename: session.filename, 
    sessionData: session.sessionData 
  };
}

// Update session with new message
async function updateSession(filename, role, content) {
  const filepath = path.join(BASE_DATA_DIR, filename);
  
  const data = JSON.parse(await fs.readFile(filepath, 'utf8'));
  
  data.conversation.push({
    role: role,
    content: content,
    timestamp: new Date().toISOString()
  });
  
  data.last_updated = new Date().toISOString();
  data.last_accessed = new Date().toISOString();
  
  await fs.writeFile(filepath, JSON.stringify(data, null, 2), 'utf8');
  
  return data;
}

// Mark session as completed with summary
async function completeSession(filename, summary) {
  const filepath = path.join(BASE_DATA_DIR, filename);
  
  const data = JSON.parse(await fs.readFile(filepath, 'utf8'));
  
  data.status = 'completed';
  data.summary = summary;
  data.completed_time = new Date().toISOString();
  data.last_updated = new Date().toISOString();
  
  await fs.writeFile(filepath, JSON.stringify(data, null, 2), 'utf8');
  
  return data;
}

// Get session data
async function getSession(filename) {
  const filepath = path.join(BASE_DATA_DIR, filename);
  const content = await fs.readFile(filepath, 'utf8');
  return JSON.parse(content);
}

module.exports = {
  createSession,
  findSessionByEmail,
  authenticateSession,
  updateSession,
  completeSession,
  getSession
};
