// Adoption Survey (Course Redesign Exploration) - Frontend Logic
const API_BASE = '/api/adoption';

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
const helpBtn = document.getElementById('help-btn');
const endConversationBtn = document.getElementById('end-conversation-btn');
const helpModal = document.getElementById('help-modal');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    userInfoForm.addEventListener('submit', handleInitialSubmit);
    sendBtn.addEventListener('click', handleSendMessage);
    userInput.addEventListener('keydown', handleKeyPress);
    modifyBtn.addEventListener('click', handleModify);
    approveBtn.addEventListener('click', handleApprove);
    helpBtn.addEventListener('click', showHelp);
    endConversationBtn.addEventListener('click', handleEndConversation);
});

// Help Modal Functions
function showHelp() {
    helpModal.classList.remove('hidden');
}

function hideHelp() {
    helpModal.classList.add('hidden');
}

// Make these globally accessible
window.showHelp = showHelp;
window.hideHelp = hideHelp;

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

// Handle "I'm Done" button
async function handleEndConversation() {
    if (conversationEnded) return;
    
    // Disable controls
    setInputEnabled(false);
    endConversationBtn.disabled = true;
    
    // Show typing indicator
    showTypingIndicator();
    
    try {
        const response = await fetch(`${API_BASE}/summary`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ session_id: sessionId })
        });
        
        const data = await response.json();
        
        hideTypingIndicator();
        
        if (response.ok) {
            // Show summary modal
            showSummaryModal(data.summary);
        } else {
            alert('Error generating summary: ' + data.error);
            setInputEnabled(true);
            endConversationBtn.disabled = false;
        }
    } catch (error) {
        console.error('Error:', error);
        hideTypingIndicator();
        alert('Failed to end conversation. Please try again.');
        setInputEnabled(true);
        endConversationBtn.disabled = false;
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
            
            // Check if this is a summary
            if (isSummaryMessage(data.message)) {
                // Bot initiated summary - show modal
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

// Handle Enter key
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

// Check if message is a summary - more robust structural detection
function isSummaryMessage(message) {
    // Look for structural indicators of a complete summary
    const lowerMessage = message.toLowerCase();
    
    // Must have the confirmation question
    const hasConfirmation = (lowerMessage.includes('does this') || lowerMessage.includes('does that')) && 
                           (lowerMessage.includes('capture') || lowerMessage.includes('accurate'));
    
    // Must have multiple section headers (looking for **SECTION:** pattern)
    const sectionHeaders = message.match(/\*\*[A-Z][^*]+\*\*/g) || [];
    const hasMultipleSections = sectionHeaders.length >= 3;
    
    // Must have expected content keywords from adoption summary
    const hasCourseContent = lowerMessage.includes('course') && 
                             (lowerMessage.includes('concerns') || lowerMessage.includes('concern'));
    
    // Must have readiness assessment
    const hasReadiness = lowerMessage.includes('readiness') || 
                         lowerMessage.includes('ready') || 
                         lowerMessage.includes('cautiously open') ||
                         lowerMessage.includes('blocked') ||
                         lowerMessage.includes('opposed');
    
    // Summary must be substantial (at least 500 characters for a real summary)
    const isSubstantial = message.length > 500;
    
    console.log('Summary detection:', { 
        hasConfirmation, 
        hasMultipleSections, 
        sectionCount: sectionHeaders.length,
        hasCourseContent, 
        hasReadiness,
        isSubstantial,
        length: message.length
    });
    
    // Only trigger modal if it looks like a complete summary
    return hasConfirmation && hasMultipleSections && hasCourseContent && isSubstantial;
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
    endConversationBtn.disabled = !enabled;
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
            addMessage('bot', 'Thank you for your time and thoughtful responses! Your conversation has been saved. You may now close this window.');
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