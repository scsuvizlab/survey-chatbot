require('dotenv').config();
const express = require('express');
const cors = require('cors');
const sessionManager = require('./session-manager');
const claudeService = require('./claude-service');
const config = require('./config');

const app = express();
const PORT = process.env.PORT || 3000;

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
    const sessionPath = require('path').join(__dirname, '../data/sessions', filename);
    const sessionData = JSON.parse(await require('fs').promises.readFile(sessionPath, 'utf8'));
    
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
    const sessionPath = require('path').join(__dirname, '../data/sessions', filename);
    const sessionData = JSON.parse(await require('fs').promises.readFile(sessionPath, 'utf8'));
    
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

// Start server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log('API endpoints:');
  console.log('  POST /api/start - Start new conversation');
  console.log('  POST /api/message - Send message');
  console.log('  POST /api/summary - Generate summary');
  console.log('  POST /api/complete - Complete session');
});