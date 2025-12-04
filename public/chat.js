// Use relative path - works both locally and on Render
const API_BASE = '/api';

let sessionId = null;
let conversationEnded = false;

// DOM Elements
const initialForm = document.getElementById('initial-form');
const userInfoForm = document.getElementById('user-info-form');
const chatInterface = document.getElementById('chat-interface');
const messagesContainer = document.getElementById('messages');
const userInput = document.getElementById('user-input');
const sendBtn = document.getElementById('send-btn');
const typingIndicator = document.getElementById('typing-indicator');
const summaryModal = document.getElementById('summary-modal');
const summaryText = document.getElementById('summary-text');
const modifyBtn = document.getElementById('modify-btn');
const approveBtn = document.getElementById('approve-btn');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    userInfoForm.addEventListener('submit', handleInitialSubmit);
    sendBtn.addEventListener('click', handleSendMessage);
    userInput.addEventListener('keydown', handleKeyPress);
    modifyBtn.addEventListener('click', handleModify);
    approveBtn.addEventListener('click', handleApprove);
});

// Handle initial form submission
async function handleInitialSubmit(e) {
    e.preventDefault();
    
    const name = document.getElementById('name').value.trim();
    const email = document.getElementById('email').value.trim();
    
    if (!name || !email) return;
    
    try {
        const response = await fetch(`${API_BASE}/start`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, email })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            sessionId = data.session_id;
            
            // Hide form, show chat
            initialForm.classList.add('hidden');
            chatInterface.classList.remove('hidden');
            
            // Display bot's greeting
            addMessage('bot', data.message);
            
            // Focus on input
            userInput.focus();
        } else {
            alert('Error starting session: ' + data.error);
        }
    } catch (error) {
        console.error('Error:', error);
        alert('Failed to connect to server. Please try again.');
    }
}

// Handle sending messages
async function handleSendMessage() {
    if (conversationEnded) return;
    
    const message = userInput.value.trim();
    if (!message) return;
    
    // Display user message
    addMessage('user', message);
    
    // Clear input
    userInput.value = '';
    
    // Disable input while processing
    setInputEnabled(false);
    showTypingIndicator();
    
    try {
        const response = await fetch(`${API_BASE}/message`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ session_id: sessionId, message })
        });
        
        const data = await response.json();
        
        hideTypingIndicator();
        
        if (response.ok) {
            // Display bot response
            addMessage('bot', data.message);
            
            // Check if this is a summary presentation
            if (isSummaryMessage(data.message)) {
                // Wait a moment, then show summary modal
                setTimeout(() => showSummaryModal(data.message), 1000);
            } else {
                setInputEnabled(true);
            }
        } else {
            alert('Error: ' + data.error);
            setInputEnabled(true);
        }
    } catch (error) {
        console.error('Error:', error);
        hideTypingIndicator();
        alert('Failed to send message. Please try again.');
        setInputEnabled(true);
    }
}

// Handle Enter key (newline only, no send)
function handleKeyPress(e) {
    // Allow normal enter for newlines
    // Users must click Send button
}

// Add message to chat
function addMessage(role, content) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${role}-message`;
    
    const bubbleDiv = document.createElement('div');
    bubbleDiv.className = 'message-bubble';
    bubbleDiv.textContent = content;
    
    messageDiv.appendChild(bubbleDiv);
    messagesContainer.appendChild(messageDiv);
    
    // Scroll to bottom
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// Check if message is a summary
function isSummaryMessage(message) {
    return message.includes('PARTICIPANT SUMMARY') || 
           message.includes('Does this accurately capture your thoughts?');
}

// Show/hide typing indicator
function showTypingIndicator() {
    typingIndicator.classList.remove('hidden');
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function hideTypingIndicator() {
    typingIndicator.classList.add('hidden');
}

// Enable/disable input
function setInputEnabled(enabled) {
    userInput.disabled = !enabled;
    sendBtn.disabled = !enabled;
}

// Show summary modal
function showSummaryModal(summaryContent) {
    summaryText.textContent = summaryContent;
    summaryModal.classList.remove('hidden');
}

// Hide summary modal
function hideSummaryModal() {
    summaryModal.classList.add('hidden');
}

// Handle modify button
function handleModify() {
    hideSummaryModal();
    setInputEnabled(true);
    userInput.focus();
    addMessage('bot', 'Please share any clarifications or additions you\'d like to make.');
}

// Handle approve button
async function handleApprove() {
    try {
        const summary = summaryText.textContent;
        
        const response = await fetch(`${API_BASE}/complete`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                session_id: sessionId, 
                summary: summary,
                user_edits: null 
            })
        });
        
        if (response.ok) {
            hideSummaryModal();
            addMessage('bot', 'Thank you for your time and thoughtful responses! Your feedback has been saved. You may now close this window.');
            conversationEnded = true;
            setInputEnabled(false);
        } else {
            alert('Error completing session. Please try again.');
        }
    } catch (error) {
        console.error('Error:', error);
        alert('Failed to complete session. Please try again.');
    }
}