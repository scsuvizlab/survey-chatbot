require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fs = require('fs').promises;
const path = require('path');
const Anthropic = require('@anthropic-ai/sdk');
const sessionManager = require('./session-manager');
const claudeService = require('./claude-service');
const config = require('./config');

const app = express();
const PORT = process.env.PORT || 3000;
const BASE_DATA_DIR = path.join(__dirname, '../data/sessions');
const REPORTS_DIR = path.join(__dirname, '../data/reports');

const anthropicClient = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Admin authentication middleware
function requireAdminAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  const password = authHeader.substring(7);
  
  if (password !== adminPassword) {
    return res.status(401).json({ error: 'Invalid password' });
  }
  
  next();
}

app.use('/api/admin', requireAdminAuth);

// Store active sessions (session_id -> filename mapping)
const activeSessions = new Map();

// Ensure data directories exist
async function initializeDataDirs() {
  const dirs = [
    BASE_DATA_DIR,
    path.join(REPORTS_DIR, 'analysis'),
    path.join(REPORTS_DIR, 'conversations')
  ];
  
  for (const dir of dirs) {
    try {
      await fs.mkdir(dir, { recursive: true });
      console.log(`✓ Directory ready: ${dir}`);
    } catch (error) {
      console.error(`Error creating directory ${dir}:`, error);
    }
  }
}

initializeDataDirs();

// ============================================
// C3 ENDPOINTS
// ============================================

// Signup - Create new session
app.post('/api/signup', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email, and password required' });
    }
    
    if (password.length < 4) {
      return res.status(400).json({ error: 'Password must be at least 4 characters' });
    }
    
    // Check if email already exists
    const existing = await sessionManager.findSessionByEmail(email);
    if (existing) {
      return res.status(400).json({ 
        error: 'An account with this email already exists. Please login instead.' 
      });
    }
    
    const { filename, sessionData } = await sessionManager.createSession(name, email, password);
    
    activeSessions.set(sessionData.session_id, { 
      filename, 
      start_time: Date.now() 
    });
    
    const greeting = config.getC3Greeting(name);
    await sessionManager.updateSession(filename, 'assistant', greeting);
    
    res.json({
      session_id: sessionData.session_id,
      message: greeting,
      is_new: true
    });
  } catch (error) {
    console.error('Error creating session:', error);
    res.status(500).json({ error: 'Failed to create session' });
  }
});

// Login - Resume existing session
app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }
    
    const result = await sessionManager.authenticateSession(email, password);
    
    if (!result.success) {
      return res.status(401).json({ error: result.error });
    }
    
    // Calculate start time from session data
    const startTime = new Date(result.sessionData.participant.start_time).getTime();
    
    activeSessions.set(result.sessionData.session_id, { 
      filename: result.filename,
      start_time: startTime
    });
    
    // Return conversation history so frontend can display it
    res.json({
      session_id: result.sessionData.session_id,
      conversation: result.sessionData.conversation,
      status: result.sessionData.status,
      is_new: false
    });
  } catch (error) {
    console.error('Error logging in:', error);
    res.status(500).json({ error: 'Failed to login' });
  }
});

// Send message
app.post('/api/message', async (req, res) => {
  try {
    const { session_id, message } = req.body;
    
    if (!session_id || !message) {
      return res.status(400).json({ error: 'Session ID and message required' });
    }
    
    const sessionInfo = activeSessions.get(session_id);
    if (!sessionInfo) {
      return res.status(404).json({ error: 'Session not found or expired' });
    }
    
    await sessionManager.updateSession(sessionInfo.filename, 'user', message);
    
    const sessionData = await sessionManager.getSession(sessionInfo.filename);
    
    const conversationHistory = sessionData.conversation.slice(1).map(msg => ({
      role: msg.role,
      content: msg.content
    }));
    
    const claudeResponse = await claudeService.sendC3Message(
      conversationHistory, 
      message,
      sessionInfo.start_time
    );
    
    await sessionManager.updateSession(sessionInfo.filename, 'assistant', claudeResponse);
    
    res.json({ message: claudeResponse });
  } catch (error) {
    console.error('Error processing message:', error);
    res.status(500).json({ error: 'Failed to process message' });
  }
});

// Generate summary
app.post('/api/summary', async (req, res) => {
  try {
    const { session_id } = req.body;
    
    if (!session_id) {
      return res.status(400).json({ error: 'Session ID required' });
    }
    
    const sessionInfo = activeSessions.get(session_id);
    if (!sessionInfo) {
      return res.status(404).json({ error: 'Session not found' });
    }
    
    const sessionData = await sessionManager.getSession(sessionInfo.filename);
    
    const conversationHistory = sessionData.conversation.map(msg => ({
      role: msg.role,
      content: msg.content
    }));
    
    const summary = await claudeService.generateC3Summary(conversationHistory);
    res.json({ summary });
  } catch (error) {
    console.error('Error generating summary:', error);
    res.status(500).json({ error: 'Failed to generate summary' });
  }
});

// Complete session
app.post('/api/complete', async (req, res) => {
  try {
    const { session_id, summary, user_edits } = req.body;
    
    if (!session_id) {
      return res.status(400).json({ error: 'Session ID required' });
    }
    
    const sessionInfo = activeSessions.get(session_id);
    if (!sessionInfo) {
      return res.status(404).json({ error: 'Session not found' });
    }
    
    const finalSummary = {
      initial: summary,
      confirmed: summary,
      user_edits: user_edits || null
    };
    
    await sessionManager.completeSession(sessionInfo.filename, finalSummary);
    
    // Keep session in activeSessions so user can still access it
    // Don't delete like we did before - they can resume anytime
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error completing session:', error);
    res.status(500).json({ error: 'Failed to complete session' });
  }
});

// ============================================
// ADMIN ENDPOINTS
// ============================================

// List all sessions
app.get('/api/admin/sessions', async (req, res) => {
  try {
    const files = await fs.readdir(BASE_DATA_DIR);
    const jsonFiles = files.filter(f => f.endsWith('.json'));
    
    const sessions = [];
    
    for (const file of jsonFiles) {
      const content = await fs.readFile(path.join(BASE_DATA_DIR, file), 'utf8');
      const data = JSON.parse(content);
      sessions.push({
        filename: file,
        participant: data.participant,
        status: data.status,
        start_time: data.participant.start_time,
        completed_time: data.completed_time || null,
        last_accessed: data.last_accessed || data.last_updated
      });
    }
    
    sessions.sort((a, b) => new Date(b.start_time) - new Date(a.start_time));
    res.json({ sessions });
  } catch (error) {
    console.error('Error listing sessions:', error);
    res.status(500).json({ error: 'Failed to list sessions' });
  }
});

// Download session
app.get('/api/admin/sessions/:filename', async (req, res) => {
  try {
    const { filename } = req.params;
    
    if (filename.includes('..') || filename.includes('/')) {
      return res.status(400).json({ error: 'Invalid filename' });
    }
    
    const filepath = path.join(BASE_DATA_DIR, filename);
    const content = await fs.readFile(filepath, 'utf8');
    
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(content);
  } catch (error) {
    console.error('Error downloading session:', error);
    res.status(404).json({ error: 'Session not found' });
  }
});

// Delete session
app.delete('/api/admin/sessions/:filename', async (req, res) => {
  try {
    const { filename } = req.params;
    
    if (filename.includes('..') || filename.includes('/')) {
      return res.status(400).json({ error: 'Invalid filename' });
    }
    
    const filepath = path.join(BASE_DATA_DIR, filename);
    
    try {
      await fs.access(filepath);
    } catch {
      return res.status(404).json({ error: 'Session not found' });
    }
    
    await fs.unlink(filepath);
    console.log(`Deleted session: ${filename}`);
    res.json({ success: true, message: 'Session deleted successfully' });
  } catch (error) {
    console.error('Error deleting session:', error);
    res.status(500).json({ error: 'Failed to delete session' });
  }
});

// Download all sessions
app.get('/api/admin/sessions-all', async (req, res) => {
  try {
    const files = await fs.readdir(BASE_DATA_DIR);
    const jsonFiles = files.filter(f => f.endsWith('.json'));
    
    const allSessions = [];
    
    for (const file of jsonFiles) {
      const content = await fs.readFile(path.join(BASE_DATA_DIR, file), 'utf8');
      const data = JSON.parse(content);
      allSessions.push(data);
    }
    
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename="all-c3-sessions.json"');
    res.json(allSessions);
  } catch (error) {
    console.error('Error downloading all sessions:', error);
    res.status(500).json({ error: 'Failed to download sessions' });
  }
});

// Delete all sessions
app.delete('/api/admin/sessions-all', async (req, res) => {
  try {
    const files = await fs.readdir(BASE_DATA_DIR);
    const jsonFiles = files.filter(f => f.endsWith('.json'));
    
    let totalDeleted = 0;
    
    for (const file of jsonFiles) {
      try {
        await fs.unlink(path.join(BASE_DATA_DIR, file));
        totalDeleted++;
      } catch (error) {
        console.error(`Failed to delete ${file}:`, error);
      }
    }
    
    console.log(`Deleted ${totalDeleted} sessions`);
    res.json({ 
      success: true, 
      deleted_count: totalDeleted,
      message: `Successfully deleted ${totalDeleted} session(s)` 
    });
  } catch (error) {
    console.error('Error deleting all sessions:', error);
    res.status(500).json({ error: 'Failed to delete sessions' });
  }
});

// Run aggregate analysis
app.post('/api/admin/analyze', async (req, res) => {
  try {
    console.log('Starting C3 analysis...');
    
    const files = await fs.readdir(BASE_DATA_DIR);
    const jsonFiles = files.filter(f => f.endsWith('.json'));
    
    if (jsonFiles.length === 0) {
      return res.status(400).json({ error: 'No sessions to analyze' });
    }
    
    const sessions = [];
    for (const file of jsonFiles) {
      const content = await fs.readFile(path.join(BASE_DATA_DIR, file), 'utf8');
      const data = JSON.parse(content);
      
      if (data.status === 'completed' && data.summary) {
        sessions.push({
          participant: data.participant.name,
          department: extractDepartment(data.summary.confirmed || data.summary.initial),
          summary: data.summary.confirmed || data.summary.initial
        });
      }
    }
    
    if (sessions.length === 0) {
      return res.status(400).json({ error: 'No completed sessions to analyze' });
    }
    
    console.log(`Analyzing ${sessions.length} completed C3 sessions...`);
    
    const analysisPrompt = claudeService.getC3AnalysisPrompt(sessions);
    
    const response = await anthropicClient.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4000,
      messages: [{
        role: 'user',
        content: analysisPrompt
      }]
    });
    
    const analysis = response.content[0].text;
    console.log('Analysis complete');
    
    // Auto-save the report
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').replace('Z', '');
    const filename = `c3-analysis-${timestamp}.txt`;
    const reportPath = path.join(REPORTS_DIR, 'analysis', filename);
    await fs.writeFile(reportPath, analysis, 'utf8');
    console.log(`Saved analysis report: ${filename}`);
    
    res.json({ analysis, filename });
    
  } catch (error) {
    console.error('Error running analysis:', error);
    res.status(500).json({ error: 'Analysis failed: ' + error.message });
  }
});

// Generate individual conversation analysis
app.post('/api/admin/conversation-analysis/:filename', async (req, res) => {
  try {
    const { filename } = req.params;
    
    if (filename.includes('..') || filename.includes('/')) {
      return res.status(400).json({ error: 'Invalid filename' });
    }
    
    console.log(`Generating conversation analysis for ${filename}...`);
    
    const filepath = path.join(BASE_DATA_DIR, filename);
    const content = await fs.readFile(filepath, 'utf8');
    const sessionData = JSON.parse(content);
    
    if (sessionData.status !== 'completed' || !sessionData.summary) {
      return res.status(400).json({ error: 'Can only analyze completed sessions' });
    }
    
    // Check if analysis already exists in session
    if (sessionData.conversation_analysis) {
      console.log('Using cached conversation analysis');
      return res.json({ analysis: sessionData.conversation_analysis });
    }
    
    // Calculate duration
    const startTime = new Date(sessionData.participant.start_time);
    const endTime = new Date(sessionData.completed_time);
    const durationMinutes = Math.round((endTime - startTime) / 60000);
    
    const analysisPrompt = claudeService.getC3ConversationAnalysisPrompt({
      participant: sessionData.participant,
      department: extractDepartment(sessionData.summary.confirmed || sessionData.summary.initial),
      duration: `${durationMinutes} minutes`,
      conversation: sessionData.conversation,
      summary: sessionData.summary
    });
    
    const response = await anthropicClient.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 3000,
      messages: [{
        role: 'user',
        content: analysisPrompt
      }]
    });
    
    const analysis = response.content[0].text;
    
    // Save analysis back to session file
    sessionData.conversation_analysis = analysis;
    sessionData.conversation_analysis_generated = new Date().toISOString();
    await fs.writeFile(filepath, JSON.stringify(sessionData, null, 2), 'utf8');
    
    // Also save as separate report file
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').replace('Z', '');
    const sanitizedName = sessionData.participant.name.replace(/[^a-zA-Z0-9]/g, '_');
    const reportFilename = `conversation-${sanitizedName}-${timestamp}.txt`;
    const reportPath = path.join(REPORTS_DIR, 'conversations', reportFilename);
    await fs.writeFile(reportPath, analysis, 'utf8');
    
    console.log('Conversation analysis generated and saved');
    res.json({ analysis, filename: reportFilename });
    
  } catch (error) {
    console.error('Error generating conversation analysis:', error);
    res.status(500).json({ error: 'Analysis failed: ' + error.message });
  }
});

// List saved reports
app.get('/api/admin/reports', async (req, res) => {
  try {
    const reports = { analysis: [], conversations: [] };
    
    // List analysis reports
    try {
      const analysisFiles = await fs.readdir(path.join(REPORTS_DIR, 'analysis'));
      
      for (const file of analysisFiles) {
        if (file.endsWith('.txt')) {
          const stats = await fs.stat(path.join(REPORTS_DIR, 'analysis', file));
          reports.analysis.push({
            filename: file,
            created: stats.mtime,
            size: stats.size
          });
        }
      }
    } catch (error) {
      console.log('No analysis reports yet');
    }
    
    // List conversation reports
    try {
      const conversationFiles = await fs.readdir(path.join(REPORTS_DIR, 'conversations'));
      
      for (const file of conversationFiles) {
        if (file.endsWith('.txt')) {
          const stats = await fs.stat(path.join(REPORTS_DIR, 'conversations', file));
          reports.conversations.push({
            filename: file,
            created: stats.mtime,
            size: stats.size
          });
        }
      }
    } catch (error) {
      console.log('No conversation reports yet');
    }
    
    // Sort by date, newest first
    reports.analysis.sort((a, b) => b.created - a.created);
    reports.conversations.sort((a, b) => b.created - a.created);
    
    res.json(reports);
    
  } catch (error) {
    console.error('Error listing reports:', error);
    res.status(500).json({ error: 'Failed to list reports' });
  }
});

// Download a report
app.get('/api/admin/reports/:type/:filename', async (req, res) => {
  try {
    const { type, filename } = req.params;
    
    if (!['analysis', 'conversations'].includes(type)) {
      return res.status(400).json({ error: 'Invalid report type' });
    }
    
    if (filename.includes('..') || filename.includes('/')) {
      return res.status(400).json({ error: 'Invalid filename' });
    }
    
    const reportPath = path.join(REPORTS_DIR, type, filename);
    const content = await fs.readFile(reportPath, 'utf8');
    
    res.setHeader('Content-Type', 'text/plain');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(content);
    
  } catch (error) {
    console.error('Error downloading report:', error);
    res.status(404).json({ error: 'Report not found' });
  }
});

// Delete a report
app.delete('/api/admin/reports/:type/:filename', async (req, res) => {
  try {
    const { type, filename } = req.params;
    
    if (!['analysis', 'conversations'].includes(type)) {
      return res.status(400).json({ error: 'Invalid report type' });
    }
    
    if (filename.includes('..') || filename.includes('/')) {
      return res.status(400).json({ error: 'Invalid filename' });
    }
    
    const reportPath = path.join(REPORTS_DIR, type, filename);
    await fs.unlink(reportPath);
    
    console.log(`Deleted report: ${filename}`);
    res.json({ success: true });
    
  } catch (error) {
    console.error('Error deleting report:', error);
    res.status(500).json({ error: 'Failed to delete report' });
  }
});

// Helper function to extract department from summary
function extractDepartment(summary) {
  const match = summary.match(/\*\*Course Context:\*\*([^*]+)/);
  if (match) {
    const context = match[1];
    const deptMatch = context.match(/Department[:\s]+([^,\n]+)/i);
    if (deptMatch) {
      return deptMatch[1].trim();
    }
  }
  return 'Not specified';
}

// Start server
app.listen(PORT, () => {
  console.log(`\n🚀 C3 (Creative Curriculum Chatbot) running on http://localhost:${PORT}`);
  console.log('\nUser endpoints:');
  console.log('  POST /api/signup - Create new session');
  console.log('  POST /api/login - Resume existing session');
  console.log('  POST /api/message - Send message');
  console.log('  POST /api/summary - Generate summary');
  console.log('  POST /api/complete - Complete session');
  console.log('\nAdmin endpoints:');
  console.log('  GET /api/admin/sessions - List all sessions');
  console.log('  GET /api/admin/sessions/:filename - Download session');
  console.log('  DELETE /api/admin/sessions/:filename - Delete session');
  console.log('  POST /api/admin/analyze - Run aggregate analysis');
  console.log('  POST /api/admin/conversation-analysis/:filename - Analyze individual conversation');
  console.log('  GET /api/admin/reports - List saved reports');
  console.log('\n✓ System ready\n');
});
