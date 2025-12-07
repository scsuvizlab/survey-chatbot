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
  const adminPassword = process.env.ADMIN_PASSWORD || 'admin123'; // Default for dev
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  const password = authHeader.substring(7); // Remove 'Bearer ' prefix
  
  if (password !== adminPassword) {
    return res.status(401).json({ error: 'Invalid password' });
  }
  
  next();
}

// Apply auth to all admin routes (without wildcard - Express will match all sub-paths)
app.use('/api/admin', requireAdminAuth);

// Store active sessions (session_id -> {filename, survey_type} mapping)
const activeSessions = new Map();

// Ensure data directories exist
async function initializeDataDirs() {
  const dirs = ['workshop', 'faculty', 'adoption'];
  for (const dir of dirs) {
    const dirPath = path.join(BASE_DATA_DIR, dir);
    try {
      await fs.mkdir(dirPath, { recursive: true });
      console.log(`âœ“ Data directory ready: ${dir}`);
    } catch (error) {
      console.error(`Error creating directory ${dir}:`, error);
    }
  }
}

initializeDataDirs();

// ============================================
// WORKSHOP FEEDBACK ENDPOINTS (existing survey)
// ============================================

app.post('/api/workshop/start', async (req, res) => {
  try {
    const { name, email } = req.body;
    
    if (!name || !email) {
      return res.status(400).json({ error: 'Name and email required' });
    }
    
    const surveyType = 'workshop';
    const { filename, sessionData } = await sessionManager.createSession(name, email, surveyType);
    
    activeSessions.set(sessionData.session_id, { filename, survey_type: surveyType });
    
    const greeting = config.getWorkshopGreeting(name);
    await sessionManager.updateSession(filename, 'assistant', greeting, surveyType);
    
    res.json({
      session_id: sessionData.session_id,
      message: greeting
    });
  } catch (error) {
    console.error('Error starting workshop session:', error);
    res.status(500).json({ error: 'Failed to start session' });
  }
});

app.post('/api/workshop/message', async (req, res) => {
  try {
    const { session_id, message } = req.body;
    
    if (!session_id || !message) {
      return res.status(400).json({ error: 'Session ID and message required' });
    }
    
    const sessionInfo = activeSessions.get(session_id);
    if (!sessionInfo || sessionInfo.survey_type !== 'workshop') {
      return res.status(404).json({ error: 'Session not found' });
    }
    
    await sessionManager.updateSession(sessionInfo.filename, 'user', message, 'workshop');
    
    const sessionPath = path.join(BASE_DATA_DIR, 'workshop', sessionInfo.filename);
    const sessionData = JSON.parse(await fs.readFile(sessionPath, 'utf8'));
    
    const conversationHistory = sessionData.conversation.slice(1).map(msg => ({
      role: msg.role,
      content: msg.content
    }));
    
    const claudeResponse = await claudeService.sendWorkshopMessage(conversationHistory, message);
    await sessionManager.updateSession(sessionInfo.filename, 'assistant', claudeResponse, 'workshop');
    
    res.json({ message: claudeResponse });
  } catch (error) {
    console.error('Error processing workshop message:', error);
    res.status(500).json({ error: 'Failed to process message' });
  }
});

app.post('/api/workshop/summary', async (req, res) => {
  try {
    const { session_id } = req.body;
    
    if (!session_id) {
      return res.status(400).json({ error: 'Session ID required' });
    }
    
    const sessionInfo = activeSessions.get(session_id);
    if (!sessionInfo || sessionInfo.survey_type !== 'workshop') {
      return res.status(404).json({ error: 'Session not found' });
    }
    
    const sessionPath = path.join(BASE_DATA_DIR, 'workshop', sessionInfo.filename);
    const sessionData = JSON.parse(await fs.readFile(sessionPath, 'utf8'));
    
    const conversationHistory = sessionData.conversation.map(msg => ({
      role: msg.role,
      content: msg.content
    }));
    
    const summary = await claudeService.generateWorkshopSummary(conversationHistory);
    res.json({ summary });
  } catch (error) {
    console.error('Error generating workshop summary:', error);
    res.status(500).json({ error: 'Failed to generate summary' });
  }
});

app.post('/api/workshop/complete', async (req, res) => {
  try {
    const { session_id, summary, user_edits } = req.body;
    
    if (!session_id) {
      return res.status(400).json({ error: 'Session ID required' });
    }
    
    const sessionInfo = activeSessions.get(session_id);
    if (!sessionInfo || sessionInfo.survey_type !== 'workshop') {
      return res.status(404).json({ error: 'Session not found' });
    }
    
    const finalSummary = {
      initial: summary,
      confirmed: summary,
      user_edits: user_edits || null
    };
    
    await sessionManager.completeSession(sessionInfo.filename, finalSummary, 'workshop');
    activeSessions.delete(session_id);
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error completing workshop session:', error);
    res.status(500).json({ error: 'Failed to complete session' });
  }
});

// ============================================
// FACULTY SURVEY ENDPOINTS (new survey)
// ============================================

app.post('/api/faculty/start', async (req, res) => {
  try {
    const { name, email } = req.body;
    
    if (!name || !email) {
      return res.status(400).json({ error: 'Name and email required' });
    }
    
    const surveyType = 'faculty';
    const { filename, sessionData } = await sessionManager.createSession(name, email, surveyType);
    
    activeSessions.set(sessionData.session_id, { filename, survey_type: surveyType });
    
    const greeting = config.getFacultyGreeting(name);
    await sessionManager.updateSession(filename, 'assistant', greeting, surveyType);
    
    res.json({
      session_id: sessionData.session_id,
      message: greeting
    });
  } catch (error) {
    console.error('Error starting faculty session:', error);
    res.status(500).json({ error: 'Failed to start session' });
  }
});

app.post('/api/faculty/message', async (req, res) => {
  try {
    const { session_id, message } = req.body;
    
    if (!session_id || !message) {
      return res.status(400).json({ error: 'Session ID and message required' });
    }
    
    const sessionInfo = activeSessions.get(session_id);
    if (!sessionInfo || sessionInfo.survey_type !== 'faculty') {
      return res.status(404).json({ error: 'Session not found' });
    }
    
    await sessionManager.updateSession(sessionInfo.filename, 'user', message, 'faculty');
    
    const sessionPath = path.join(BASE_DATA_DIR, 'faculty', sessionInfo.filename);
    const sessionData = JSON.parse(await fs.readFile(sessionPath, 'utf8'));
    
    const conversationHistory = sessionData.conversation.slice(1).map(msg => ({
      role: msg.role,
      content: msg.content
    }));
    
    const claudeResponse = await claudeService.sendFacultyMessage(conversationHistory, message);
    await sessionManager.updateSession(sessionInfo.filename, 'assistant', claudeResponse, 'faculty');
    
    res.json({ message: claudeResponse });
  } catch (error) {
    console.error('Error processing faculty message:', error);
    res.status(500).json({ error: 'Failed to process message' });
  }
});

app.post('/api/faculty/summary', async (req, res) => {
  try {
    const { session_id } = req.body;
    
    if (!session_id) {
      return res.status(400).json({ error: 'Session ID required' });
    }
    
    const sessionInfo = activeSessions.get(session_id);
    if (!sessionInfo || sessionInfo.survey_type !== 'faculty') {
      return res.status(404).json({ error: 'Session not found' });
    }
    
    const sessionPath = path.join(BASE_DATA_DIR, 'faculty', sessionInfo.filename);
    const sessionData = JSON.parse(await fs.readFile(sessionPath, 'utf8'));
    
    const conversationHistory = sessionData.conversation.map(msg => ({
      role: msg.role,
      content: msg.content
    }));
    
    const summary = await claudeService.generateFacultySummary(conversationHistory);
    res.json({ summary });
  } catch (error) {
    console.error('Error generating faculty summary:', error);
    res.status(500).json({ error: 'Failed to generate summary' });
  }
});

app.post('/api/faculty/complete', async (req, res) => {
  try {
    const { session_id, summary, user_edits } = req.body;
    
    if (!session_id) {
      return res.status(400).json({ error: 'Session ID required' });
    }
    
    const sessionInfo = activeSessions.get(session_id);
    if (!sessionInfo || sessionInfo.survey_type !== 'faculty') {
      return res.status(404).json({ error: 'Session not found' });
    }
    
    const finalSummary = {
      initial: summary,
      confirmed: summary,
      user_edits: user_edits || null
    };
    
    await sessionManager.completeSession(sessionInfo.filename, finalSummary, 'faculty');
    activeSessions.delete(session_id);
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error completing faculty session:', error);
    res.status(500).json({ error: 'Failed to complete session' });
  }
});

// ============================================
// ADOPTION SURVEY ENDPOINTS (Course Redesign Exploration)
// ============================================

app.post('/api/adoption/start', async (req, res) => {
  try {
    const { name, email } = req.body;
    
    if (!name || !email) {
      return res.status(400).json({ error: 'Name and email required' });
    }
    
    const surveyType = 'adoption';
    const { filename, sessionData } = await sessionManager.createSession(name, email, surveyType);
    
    activeSessions.set(sessionData.session_id, { filename, survey_type: surveyType });
    
    const greeting = config.getAdoptionGreeting(name);
    await sessionManager.updateSession(filename, 'assistant', greeting, surveyType);
    
    res.json({
      session_id: sessionData.session_id,
      message: greeting
    });
  } catch (error) {
    console.error('Error starting adoption session:', error);
    res.status(500).json({ error: 'Failed to start session' });
  }
});

app.post('/api/adoption/message', async (req, res) => {
  try {
    const { session_id, message } = req.body;
    
    if (!session_id || !message) {
      return res.status(400).json({ error: 'Session ID and message required' });
    }
    
    const sessionInfo = activeSessions.get(session_id);
    if (!sessionInfo || sessionInfo.survey_type !== 'adoption') {
      return res.status(404).json({ error: 'Session not found' });
    }
    
    await sessionManager.updateSession(sessionInfo.filename, 'user', message, 'adoption');
    
    const sessionPath = path.join(BASE_DATA_DIR, 'adoption', sessionInfo.filename);
    const sessionData = JSON.parse(await fs.readFile(sessionPath, 'utf8'));
    
    const conversationHistory = sessionData.conversation.slice(1).map(msg => ({
      role: msg.role,
      content: msg.content
    }));
    
    const claudeResponse = await claudeService.sendAdoptionMessage(conversationHistory, message);
    await sessionManager.updateSession(sessionInfo.filename, 'assistant', claudeResponse, 'adoption');
    
    res.json({ message: claudeResponse });
  } catch (error) {
    console.error('Error processing adoption message:', error);
    res.status(500).json({ error: 'Failed to process message' });
  }
});

app.post('/api/adoption/summary', async (req, res) => {
  try {
    const { session_id } = req.body;
    
    if (!session_id) {
      return res.status(400).json({ error: 'Session ID required' });
    }
    
    const sessionInfo = activeSessions.get(session_id);
    if (!sessionInfo || sessionInfo.survey_type !== 'adoption') {
      return res.status(404).json({ error: 'Session not found' });
    }
    
    const sessionPath = path.join(BASE_DATA_DIR, 'adoption', sessionInfo.filename);
    const sessionData = JSON.parse(await fs.readFile(sessionPath, 'utf8'));
    
    const conversationHistory = sessionData.conversation.map(msg => ({
      role: msg.role,
      content: msg.content
    }));
    
    const summary = await claudeService.generateAdoptionSummary(conversationHistory);
    res.json({ summary });
  } catch (error) {
    console.error('Error generating adoption summary:', error);
    res.status(500).json({ error: 'Failed to generate summary' });
  }
});

app.post('/api/adoption/complete', async (req, res) => {
  try {
    const { session_id, summary, user_edits } = req.body;
    
    if (!session_id) {
      return res.status(400).json({ error: 'Session ID required' });
    }
    
    const sessionInfo = activeSessions.get(session_id);
    if (!sessionInfo || sessionInfo.survey_type !== 'adoption') {
      return res.status(404).json({ error: 'Session not found' });
    }
    
    const finalSummary = {
      initial: summary,
      confirmed: summary,
      user_edits: user_edits || null
    };
    
    await sessionManager.completeSession(sessionInfo.filename, finalSummary, 'adoption');
    activeSessions.delete(session_id);
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error completing adoption session:', error);
    res.status(500).json({ error: 'Failed to complete session' });
  }
});

// ============================================
// ADMIN ENDPOINTS - Multi-Survey Support
// ============================================

app.get('/api/admin/sessions', async (req, res) => {
  try {
    const surveyType = req.query.survey_type || 'all';
    
    const surveyTypes = surveyType === 'all' ? ['workshop', 'faculty', 'adoption'] : [surveyType];
    const allSessions = [];
    
    for (const type of surveyTypes) {
      const dirPath = path.join(BASE_DATA_DIR, type);
      try {
        const files = await fs.readdir(dirPath);
        const jsonFiles = files.filter(f => f.endsWith('.json'));
        
        for (const file of jsonFiles) {
          const content = await fs.readFile(path.join(dirPath, file), 'utf8');
          const data = JSON.parse(content);
          allSessions.push({
            survey_type: type,
            filename: file,
            participant: data.participant,
            status: data.status,
            start_time: data.participant.start_time,
            completed_time: data.completed_time || null
          });
        }
      } catch (error) {
        console.error(`Error reading ${type} directory:`, error);
      }
    }
    
    allSessions.sort((a, b) => new Date(b.start_time) - new Date(a.start_time));
    res.json({ sessions: allSessions });
  } catch (error) {
    console.error('Error listing sessions:', error);
    res.status(500).json({ error: 'Failed to list sessions' });
  }
});

app.get('/api/admin/sessions/:survey_type/:filename', async (req, res) => {
  try {
    const { survey_type, filename } = req.params;
    
    if (filename.includes('..') || filename.includes('/')) {
      return res.status(400).json({ error: 'Invalid filename' });
    }
    
    if (!['workshop', 'faculty', 'adoption'].includes(survey_type)) {
      return res.status(400).json({ error: 'Invalid survey type' });
    }
    
    const filepath = path.join(BASE_DATA_DIR, survey_type, filename);
    const content = await fs.readFile(filepath, 'utf8');
    
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(content);
  } catch (error) {
    console.error('Error downloading session:', error);
    res.status(404).json({ error: 'Session not found' });
  }
});

app.delete('/api/admin/sessions/:survey_type/:filename', async (req, res) => {
  try {
    const { survey_type, filename } = req.params;
    
    if (filename.includes('..') || filename.includes('/')) {
      return res.status(400).json({ error: 'Invalid filename' });
    }
    
    if (!['workshop', 'faculty', 'adoption'].includes(survey_type)) {
      return res.status(400).json({ error: 'Invalid survey type' });
    }
    
    const filepath = path.join(BASE_DATA_DIR, survey_type, filename);
    
    try {
      await fs.access(filepath);
    } catch {
      return res.status(404).json({ error: 'Session not found' });
    }
    
    await fs.unlink(filepath);
    console.log(`Deleted ${survey_type} session: ${filename}`);
    res.json({ success: true, message: 'Session deleted successfully' });
  } catch (error) {
    console.error('Error deleting session:', error);
    res.status(500).json({ error: 'Failed to delete session' });
  }
});

app.get('/api/admin/sessions-all/:survey_type', async (req, res) => {
  try {
    const { survey_type } = req.params;
    
    if (!['workshop', 'faculty', 'adoption', 'all'].includes(survey_type)) {
      return res.status(400).json({ error: 'Invalid survey type' });
    }
    
    const surveyTypes = survey_type === 'all' ? ['workshop', 'faculty', 'adoption'] : [survey_type];
    const allSessions = [];
    
    for (const type of surveyTypes) {
      const dirPath = path.join(BASE_DATA_DIR, type);
      try {
        const files = await fs.readdir(dirPath);
        const jsonFiles = files.filter(f => f.endsWith('.json'));
        
        for (const file of jsonFiles) {
          const content = await fs.readFile(path.join(dirPath, file), 'utf8');
          const data = JSON.parse(content);
          data.survey_type = type; // Add survey type to data
          allSessions.push(data);
        }
      } catch (error) {
        console.error(`Error reading ${type} directory:`, error);
      }
    }
    
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="all-sessions-${survey_type}.json"`);
    res.json(allSessions);
  } catch (error) {
    console.error('Error downloading all sessions:', error);
    res.status(500).json({ error: 'Failed to download sessions' });
  }
});

app.delete('/api/admin/sessions-all/:survey_type', async (req, res) => {
  try {
    const { survey_type } = req.params;
    
    if (!['workshop', 'faculty', 'adoption', 'all'].includes(survey_type)) {
      return res.status(400).json({ error: 'Invalid survey type' });
    }
    
    const surveyTypes = survey_type === 'all' ? ['workshop', 'faculty', 'adoption'] : [survey_type];
    let totalDeleted = 0;
    
    for (const type of surveyTypes) {
      const dirPath = path.join(BASE_DATA_DIR, type);
      try {
        const files = await fs.readdir(dirPath);
        const jsonFiles = files.filter(f => f.endsWith('.json'));
        
        for (const file of jsonFiles) {
          try {
            await fs.unlink(path.join(dirPath, file));
            totalDeleted++;
          } catch (error) {
            console.error(`Failed to delete ${file}:`, error);
          }
        }
      } catch (error) {
        console.error(`Error reading ${type} directory:`, error);
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

app.post('/api/admin/analyze/:survey_type', async (req, res) => {
  try {
    const { survey_type } = req.params;
    
    if (!['workshop', 'faculty', 'adoption'].includes(survey_type)) {
      return res.status(400).json({ error: 'Invalid survey type' });
    }
    
    console.log(`Starting analysis for ${survey_type}...`);
    
    const dirPath = path.join(BASE_DATA_DIR, survey_type);
    const files = await fs.readdir(dirPath);
    const jsonFiles = files.filter(f => f.endsWith('.json'));
    
    if (jsonFiles.length === 0) {
      return res.status(400).json({ error: 'No sessions to analyze' });
    }
    
    const sessions = [];
    for (const file of jsonFiles) {
      const content = await fs.readFile(path.join(dirPath, file), 'utf8');
      const data = JSON.parse(content);
      
      if (data.status === 'completed' && data.summary) {
        sessions.push({
          participant: data.participant.name,
          summary: data.summary.confirmed || data.summary.initial,
          conversationSnippets: data.conversation
            .filter(msg => msg.role === 'user')
            .slice(0, 5)
            .map(msg => msg.content)
        });
      }
    }
    
    if (sessions.length === 0) {
      return res.status(400).json({ error: 'No completed sessions to analyze' });
    }
    
    console.log(`Analyzing ${sessions.length} completed ${survey_type} sessions...`);
    
    // Use survey-specific analysis prompt
    let analysisPrompt;
    if (survey_type === 'workshop') {
      analysisPrompt = claudeService.getWorkshopAnalysisPrompt(sessions);
    } else if (survey_type === 'faculty') {
      analysisPrompt = claudeService.getFacultyAnalysisPrompt(sessions);
    } else if (survey_type === 'adoption') {
      analysisPrompt = claudeService.getAdoptionAnalysisPrompt(sessions);
    }
    
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
    res.json({ analysis });
    
  } catch (error) {
    console.error('Error running analysis:', error);
    res.status(500).json({ error: 'Analysis failed: ' + error.message });
  }
});

// Generate individual course report for adoption surveys
app.post('/api/admin/course-report/:survey_type/:filename', async (req, res) => {
  try {
    const { survey_type, filename } = req.params;
    
    // Only allow for adoption surveys
    if (survey_type !== 'adoption') {
      return res.status(400).json({ error: 'Course reports are only available for adoption surveys' });
    }
    
    if (filename.includes('..') || filename.includes('/')) {
      return res.status(400).json({ error: 'Invalid filename' });
    }
    
    console.log(`Generating course report for ${filename}...`);
    
    const filepath = path.join(BASE_DATA_DIR, survey_type, filename);
    const content = await fs.readFile(filepath, 'utf8');
    const sessionData = JSON.parse(content);
    
    if (sessionData.status !== 'completed' || !sessionData.summary) {
      return res.status(400).json({ error: 'Can only generate reports for completed sessions' });
    }
    
    // Check if report already exists
    if (sessionData.course_report) {
      console.log('Using cached course report');
      return res.json({ report: sessionData.course_report });
    }
    
    // Generate new report
    const report = await claudeService.generateAdoptionCourseReport(sessionData);
    
    // Save report back to session file
    sessionData.course_report = report;
    sessionData.course_report_generated = new Date().toISOString();
    await fs.writeFile(filepath, JSON.stringify(sessionData, null, 2), 'utf8');
    
    console.log('Course report generated and saved');
    res.json({ report });
    
  } catch (error) {
    console.error('Error generating course report:', error);
    res.status(500).json({ error: 'Report generation failed: ' + error.message });
  }
});

// Save analysis report to file
app.post('/api/admin/save-analysis', async (req, res) => {
  try {
    const { survey_type, analysis } = req.body;
    
    if (!survey_type || !analysis) {
      return res.status(400).json({ error: 'Survey type and analysis required' });
    }
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').replace('Z', '');
    const filename = `${survey_type}-analysis-${timestamp}.txt`;
    const reportPath = path.join(__dirname, '../data/reports/analysis', filename);
    
    await fs.writeFile(reportPath, analysis, 'utf8');
    
    console.log(`Saved analysis report: ${filename}`);
    res.json({ success: true, filename });
    
  } catch (error) {
    console.error('Error saving analysis report:', error);
    res.status(500).json({ error: 'Failed to save report: ' + error.message });
  }
});

// Save course report to file
app.post('/api/admin/save-course-report', async (req, res) => {
  try {
    const { survey_type, filename, participant_name, report } = req.body;
    
    if (!survey_type || !filename || !report) {
      return res.status(400).json({ error: 'Survey type, filename, and report required' });
    }
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').replace('Z', '');
    const sanitizedName = participant_name.replace(/[^a-zA-Z0-9]/g, '_');
    const reportFilename = `course-${sanitizedName}-${timestamp}.txt`;
    const reportPath = path.join(__dirname, '../data/reports/courses', reportFilename);
    
    await fs.writeFile(reportPath, report, 'utf8');
    
    console.log(`Saved course report: ${reportFilename}`);
    res.json({ success: true, filename: reportFilename });
    
  } catch (error) {
    console.error('Error saving course report:', error);
    res.status(500).json({ error: 'Failed to save report: ' + error.message });
  }
});

// List all saved reports
app.get('/api/admin/reports', async (req, res) => {
  try {
    const reports = { analysis: [], courses: [] };
    
    // List analysis reports
    try {
      const analysisDir = path.join(__dirname, '../data/reports/analysis');
      const analysisFiles = await fs.readdir(analysisDir);
      
      for (const file of analysisFiles) {
        if (file.endsWith('.txt')) {
          const stats = await fs.stat(path.join(analysisDir, file));
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
    
    // List course reports
    try {
      const coursesDir = path.join(__dirname, '../data/reports/courses');
      const courseFiles = await fs.readdir(coursesDir);
      
      for (const file of courseFiles) {
        if (file.endsWith('.txt')) {
          const stats = await fs.stat(path.join(coursesDir, file));
          reports.courses.push({
            filename: file,
            created: stats.mtime,
            size: stats.size
          });
        }
      }
    } catch (error) {
      console.log('No course reports yet');
    }
    
    // Sort by date, newest first
    reports.analysis.sort((a, b) => b.created - a.created);
    reports.courses.sort((a, b) => b.created - a.created);
    
    res.json(reports);
    
  } catch (error) {
    console.error('Error listing reports:', error);
    res.status(500).json({ error: 'Failed to list reports' });
  }
});

// Download a saved report
app.get('/api/admin/reports/:type/:filename', async (req, res) => {
  try {
    const { type, filename } = req.params;
    
    if (!['analysis', 'courses'].includes(type)) {
      return res.status(400).json({ error: 'Invalid report type' });
    }
    
    if (filename.includes('..') || filename.includes('/')) {
      return res.status(400).json({ error: 'Invalid filename' });
    }
    
    const reportPath = path.join(__dirname, `../data/reports/${type}`, filename);
    const content = await fs.readFile(reportPath, 'utf8');
    
    res.setHeader('Content-Type', 'text/plain');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(content);
    
  } catch (error) {
    console.error('Error downloading report:', error);
    res.status(404).json({ error: 'Report not found' });
  }
});

// Delete a saved report
app.delete('/api/admin/reports/:type/:filename', async (req, res) => {
  try {
    const { type, filename } = req.params;
    
    if (!['analysis', 'courses'].includes(type)) {
      return res.status(400).json({ error: 'Invalid report type' });
    }
    
    if (filename.includes('..') || filename.includes('/')) {
      return res.status(400).json({ error: 'Invalid filename' });
    }
    
    const reportPath = path.join(__dirname, `../data/reports/${type}`, filename);
    await fs.unlink(reportPath);
    
    console.log(`Deleted report: ${filename}`);
    res.json({ success: true });
    
  } catch (error) {
    console.error('Error deleting report:', error);
    res.status(500).json({ error: 'Failed to delete report' });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log('\nWorkshop Feedback endpoints:');
  console.log('  POST /api/workshop/start');
  console.log('  POST /api/workshop/message');
  console.log('  POST /api/workshop/summary');
  console.log('  POST /api/workshop/complete');
  console.log('\nFaculty Survey endpoints:');
  console.log('  POST /api/faculty/start');
  console.log('  POST /api/faculty/message');
  console.log('  POST /api/faculty/summary');
  console.log('  POST /api/faculty/complete');
  console.log('\nAdoption Survey endpoints:');
  console.log('  POST /api/adoption/start');
  console.log('  POST /api/adoption/message');
  console.log('  POST /api/adoption/summary');
  console.log('  POST /api/adoption/complete');
  console.log('\nAdmin endpoints:');
  console.log('  GET /api/admin/sessions?survey_type=workshop|faculty|adoption|all');
  console.log('  GET /api/admin/sessions/:survey_type/:filename');
  console.log('  DELETE /api/admin/sessions/:survey_type/:filename');
  console.log('  GET /api/admin/sessions-all/:survey_type');
  console.log('  DELETE /api/admin/sessions-all/:survey_type');
  console.log('  POST /api/admin/analyze/:survey_type');
});