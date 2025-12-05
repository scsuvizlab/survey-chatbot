const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

const BASE_DATA_DIR = path.join(__dirname, '../data/sessions');

// Create a new session file
async function createSession(name, email, surveyType = 'workshop') {
  const sessionId = crypto.randomUUID();
  const timestamp = new Date().toISOString();
  
  // Sanitize email for filename
  const sanitizedEmail = email
    .replace('@', '_at_')
    .replace(/[^a-zA-Z0-9_.-]/g, '_');
  
  // Create filename with survey type folder
  const filenameTimestamp = timestamp.replace(/[:.]/g, '-').replace('Z', '');
  const filename = `${sanitizedEmail}_${filenameTimestamp}.json`;
  
  const sessionData = {
    session_id: sessionId,
    survey_type: surveyType,
    status: 'in-progress',
    participant: {
      name,
      email,
      start_time: timestamp
    },
    conversation: [],
    summary: null,
    completed_time: null,
    last_updated: timestamp
  };
  
  // Write to appropriate survey folder
  const dirPath = path.join(BASE_DATA_DIR, surveyType);
  const filepath = path.join(dirPath, filename);
  
  // Ensure directory exists
  await fs.mkdir(dirPath, { recursive: true });
  
  await fs.writeFile(filepath, JSON.stringify(sessionData, null, 2), 'utf8');
  
  return { filename, sessionData };
}

// Update session with new message
async function updateSession(filename, role, content, surveyType = 'workshop') {
  const filepath = path.join(BASE_DATA_DIR, surveyType, filename);
  
  const data = JSON.parse(await fs.readFile(filepath, 'utf8'));
  
  data.conversation.push({
    role: role,
    content: content,
    timestamp: new Date().toISOString()
  });
  
  data.last_updated = new Date().toISOString();
  
  await fs.writeFile(filepath, JSON.stringify(data, null, 2), 'utf8');
  
  return data;
}

// Mark session as completed with summary
async function completeSession(filename, summary, surveyType = 'workshop') {
  const filepath = path.join(BASE_DATA_DIR, surveyType, filename);
  
  const data = JSON.parse(await fs.readFile(filepath, 'utf8'));
  
  data.status = 'completed';
  data.summary = summary;
  data.completed_time = new Date().toISOString();
  data.last_updated = new Date().toISOString();
  
  await fs.writeFile(filepath, JSON.stringify(data, null, 2), 'utf8');
  
  return data;
}

module.exports = {
  createSession,
  updateSession,
  completeSession
};
