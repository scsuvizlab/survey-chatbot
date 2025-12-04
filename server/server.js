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
const SESSIONS_DIR = path.join(__dirname, '../data/sessions');

const anthropicClient = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Store active sessions (session_id -> filename mapping)
const activeSessions = new Map();

// POST /api/start - Initialize conversation, collect name/email
app.post('/api/start', async (req, res) => {
  try {
    const { name, email } = req.body;
    
    if (!name || !email) {
      return res.status(400).json({ error: 'Name and email required' });
    }
    
    // Create session file
    const { filename, sessionData } = await sessionManager.createSession(name, email);
    
    // Store mapping
    activeSessions.set(sessionData.session_id, filename);
    
    // Get personalized greeting with participant's name
    const greeting = config.getInitialGreeting(name);
    
    // Save initial greeting
    await sessionManager.updateSession(filename, 'assistant', greeting);
    
    res.json({
      session_id: sessionData.session_id,
      message: greeting
    });
  } catch (error) {
    console.error('Error starting session:', error);
    res.status(500).json({ error: 'Failed to start session' });
  }
});

// POST /api/message - Handle user message and get Claude response
app.post('/api/message', async (req, res) => {
  try {
    const { session_id, message } = req.body;
    
    if (!session_id || !message) {
      return res.status(400).json({ error: 'Session ID and message required' });
    }
    
    const filename = activeSessions.get(session_id);
    if (!filename) {
      return res.status(404).json({ error: 'Session not found' });
    }
    
    // Save user message
    await sessionManager.updateSession(filename, 'user', message);
    
    // Get current conversation history for Claude
    const sessionPath = path.join(SESSIONS_DIR, filename);
    const sessionData = JSON.parse(await fs.readFile(sessionPath, 'utf8'));
    
    // Build conversation history for Claude (exclude initial greeting from conversation array)
    const conversationHistory = sessionData.conversation
      .slice(1) // Skip the initial greeting we already sent
      .map(msg => ({
        role: msg.role,
        content: msg.content
      }));
    
    // Get Claude's response
    const claudeResponse = await claudeService.sendMessage(conversationHistory, message);
    
    // Save Claude's response
    await sessionManager.updateSession(filename, 'assistant', claudeResponse);
    
    res.json({ message: claudeResponse });
  } catch (error) {
    console.error('Error processing message:', error);
    res.status(500).json({ error: 'Failed to process message' });
  }
});

// POST /api/summary - Generate and return conversation summary
app.post('/api/summary', async (req, res) => {
  try {
    const { session_id } = req.body;
    
    if (!session_id) {
      return res.status(400).json({ error: 'Session ID required' });
    }
    
    const filename = activeSessions.get(session_id);
    if (!filename) {
      return res.status(404).json({ error: 'Session not found' });
    }
    
    // Get conversation history
    const sessionPath = path.join(SESSIONS_DIR, filename);
    const sessionData = JSON.parse(await fs.readFile(sessionPath, 'utf8'));
    
    const conversationHistory = sessionData.conversation.map(msg => ({
      role: msg.role,
      content: msg.content
    }));
    
    // Generate summary
    const summary = await claudeService.generateSummary(conversationHistory);
    
    res.json({ summary });
  } catch (error) {
    console.error('Error generating summary:', error);
    res.status(500).json({ error: 'Failed to generate summary' });
  }
});

// POST /api/complete - Mark session as completed with confirmed summary
app.post('/api/complete', async (req, res) => {
  try {
    const { session_id, summary, user_edits } = req.body;
    
    if (!session_id) {
      return res.status(400).json({ error: 'Session ID required' });
    }
    
    const filename = activeSessions.get(session_id);
    if (!filename) {
      return res.status(404).json({ error: 'Session not found' });
    }
    
    // Complete session with summary
    const finalSummary = {
      initial: summary,
      confirmed: summary,
      user_edits: user_edits || null
    };
    
    await sessionManager.completeSession(filename, finalSummary);
    
    // Clean up active session
    activeSessions.delete(session_id);
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error completing session:', error);
    res.status(500).json({ error: 'Failed to complete session' });
  }
});

// ============================================
// ADMIN ENDPOINTS - Data Access
// ============================================

// GET /api/admin/sessions - List all session files
app.get('/api/admin/sessions', async (req, res) => {
  try {
    const files = await fs.readdir(SESSIONS_DIR);
    const jsonFiles = files.filter(f => f.endsWith('.json'));
    
    const sessions = [];
    for (const file of jsonFiles) {
      const content = await fs.readFile(path.join(SESSIONS_DIR, file), 'utf8');
      const data = JSON.parse(content);
      sessions.push({
        filename: file,
        participant: data.participant,
        status: data.status,
        start_time: data.participant.start_time,
        completed_time: data.completed_time || null
      });
    }
    
    // Sort by start time, newest first
    sessions.sort((a, b) => new Date(b.start_time) - new Date(a.start_time));
    
    res.json({ sessions });
  } catch (error) {
    console.error('Error listing sessions:', error);
    res.status(500).json({ error: 'Failed to list sessions' });
  }
});

// GET /api/admin/sessions/:filename - Download specific session
app.get('/api/admin/sessions/:filename', async (req, res) => {
  try {
    const { filename } = req.params;
    
    // Security: prevent path traversal
    if (filename.includes('..') || filename.includes('/')) {
      return res.status(400).json({ error: 'Invalid filename' });
    }
    
    const filepath = path.join(SESSIONS_DIR, filename);
    const content = await fs.readFile(filepath, 'utf8');
    
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(content);
  } catch (error) {
    console.error('Error downloading session:', error);
    res.status(404).json({ error: 'Session not found' });
  }
});

// DELETE /api/admin/sessions/:filename - Delete specific session
app.delete('/api/admin/sessions/:filename', async (req, res) => {
  try {
    const { filename } = req.params;
    
    // Security: prevent path traversal
    if (filename.includes('..') || filename.includes('/')) {
      return res.status(400).json({ error: 'Invalid filename' });
    }
    
    const filepath = path.join(SESSIONS_DIR, filename);
    
    // Check if file exists
    try {
      await fs.access(filepath);
    } catch {
      return res.status(404).json({ error: 'Session not found' });
    }
    
    // Delete the file
    await fs.unlink(filepath);
    
    console.log(`Deleted session: ${filename}`);
    res.json({ success: true, message: 'Session deleted successfully' });
  } catch (error) {
    console.error('Error deleting session:', error);
    res.status(500).json({ error: 'Failed to delete session' });
  }
});

// GET /api/admin/sessions-all - Download all sessions as single JSON array
app.get('/api/admin/sessions-all', async (req, res) => {
  try {
    const files = await fs.readdir(SESSIONS_DIR);
    const jsonFiles = files.filter(f => f.endsWith('.json'));
    
    const allSessions = [];
    for (const file of jsonFiles) {
      const content = await fs.readFile(path.join(SESSIONS_DIR, file), 'utf8');
      const data = JSON.parse(content);
      allSessions.push(data);
    }
    
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename="all-sessions.json"');
    res.json(allSessions);
  } catch (error) {
    console.error('Error downloading all sessions:', error);
    res.status(500).json({ error: 'Failed to download sessions' });
  }
});

// DELETE /api/admin/sessions-all - Delete all sessions
app.delete('/api/admin/sessions-all', async (req, res) => {
  try {
    const files = await fs.readdir(SESSIONS_DIR);
    const jsonFiles = files.filter(f => f.endsWith('.json'));
    
    if (jsonFiles.length === 0) {
      return res.json({ success: true, deleted_count: 0, message: 'No sessions to delete' });
    }
    
    // Delete all JSON files
    let deletedCount = 0;
    for (const file of jsonFiles) {
      try {
        await fs.unlink(path.join(SESSIONS_DIR, file));
        deletedCount++;
      } catch (error) {
        console.error(`Failed to delete ${file}:`, error);
      }
    }
    
    console.log(`Deleted ${deletedCount} sessions`);
    res.json({ 
      success: true, 
      deleted_count: deletedCount,
      message: `Successfully deleted ${deletedCount} session(s)` 
    });
  } catch (error) {
    console.error('Error deleting all sessions:', error);
    res.status(500).json({ error: 'Failed to delete sessions' });
  }
});

// POST /api/admin/analyze - Run LLM analysis on all sessions
app.post('/api/admin/analyze', async (req, res) => {
  try {
    console.log('Starting analysis...');
    
    // Read all session files
    const files = await fs.readdir(SESSIONS_DIR);
    const jsonFiles = files.filter(f => f.endsWith('.json'));
    
    if (jsonFiles.length === 0) {
      return res.status(400).json({ error: 'No sessions to analyze' });
    }
    
    const sessions = [];
    for (const file of jsonFiles) {
      const content = await fs.readFile(path.join(SESSIONS_DIR, file), 'utf8');
      const data = JSON.parse(content);
      
      // Only analyze completed sessions
      if (data.status === 'completed' && data.summary) {
        sessions.push({
          participant: data.participant.name,
          summary: data.summary.confirmed || data.summary.initial,
          // Include a few key conversation excerpts
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
    
    console.log(`Analyzing ${sessions.length} completed sessions...`);
    
    // Prepare data for Claude
    const analysisPrompt = `You are analyzing feedback from a workshop about AI adoption in education. You have ${sessions.length} completed conversational interviews.

YOUR TASK: Generate a comprehensive analysis report that demonstrates the value of conversational interviews over traditional surveys.

DATA PROVIDED:
${sessions.map((s, i) => `
SESSION ${i + 1} - ${s.participant}
SUMMARY:
${s.summary}
`).join('\n---\n')}

ANALYSIS REQUIREMENTS:

1. QUANTITATIVE FINDINGS (What traditional surveys would capture):
   - Calculate participation metrics
   - Count interest levels in each NextEd offering (DGX Workstations, Policy Board, Adoption Clinic)
   - Identify top concerns and their frequency
   - Categorize technical comfort levels
   - Any other countable metrics

2. QUALITATIVE INSIGHTS (What conversations reveal that surveys miss):
   - WHY people are interested/not interested
   - Specific use cases and contexts mentioned
   - Unexpected findings or themes
   - Contradictions or nuances (e.g., wanting AI help but fearing student misuse)
   - Departmental/institutional barriers
   - Representative quotes that illustrate key points

3. COMPARATIVE ANALYSIS:
   - Create a comparison showing what traditional surveys would get vs. what TIIS conversational method revealed
   - Highlight actionable insights that surveys would miss
   - Demonstrate depth and context

4. RECOMMENDATIONS:
   - Based on the insights, what should NextEd prioritize?
   - Which faculty are early adopter candidates?
   - What barriers need addressing first?

FORMAT: Professional report with clear sections, data-driven, and compelling. Use specific numbers and percentages. Include representative quotes where they illustrate key points.

Generate the analysis now:`;

    // Send to Claude for analysis
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

// Start server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log('API endpoints:');
  console.log('  POST /api/start - Start new conversation');
  console.log('  POST /api/message - Send message');
  console.log('  POST /api/summary - Generate summary');
  console.log('  POST /api/complete - Complete session');
  console.log('\nAdmin endpoints:');
  console.log('  GET /api/admin/sessions - List all sessions');
  console.log('  GET /api/admin/sessions/:filename - Download specific session');
  console.log('  DELETE /api/admin/sessions/:filename - Delete specific session');
  console.log('  GET /api/admin/sessions-all - Download all sessions');
  console.log('  DELETE /api/admin/sessions-all - Delete all sessions');
  console.log('  POST /api/admin/analyze - Run LLM analysis');
});