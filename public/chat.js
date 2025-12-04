// Use relative path - works both locally and on Render
const API_BASE = '/api';

let sessionId = null;
let conversationEnded = false;
let timerInterval = null;
let startTime = null;
let tenMinuteWarningShown = false;
let currentTopicIndex = null; // Track which topic bot is currently asking about

// Topic tracking - detect based on bot's question context (8 topics)
const topics = [
    { 
        label: "Workshop Experience", 
        covered: false, 
        botKeywords: ["workshop", "experience", "impressions", "overall", "stood out", "land for you"]
    },
    { 
        label: "Specific Content", 
        covered: false, 
        botKeywords: ["content", "sessions", "resonated", "specific", "part of", "demonstrations"]
    },
    { 
        label: "Newton Song Demo", 
        covered: false, 
        botKeywords: ["song", "newton", "music", "demonstration", "suno", "creative"]
    },
    { 
        label: "NextEd Interest", 
        covered: false, 
        botKeywords: ["nexted", "interested", "dgx", "workstation", "policy board", "adoption clinic", "spark"]
    },
    { 
        label: "AI Concerns", 
        covered: false, 
        botKeywords: ["concerns", "reservations", "worried", "barriers", "obstacles", "challenges", "privacy", "security", "data", "support", "help", "environmental", "energy", "carbon"]
    },
    { 
        label: "Technical Comfort", 
        covered: false, 
        botKeywords: ["comfort", "familiar", "technical", "ai tools", "experience with", "used", "tried"]
    },
    { 
        label: "Course Ideas", 
        covered: false, 
        botKeywords: ["course", "redesign", "teaching", "class", "curriculum", "students", "assignment"]
    },
    { 
        label: "Survey Experience", 
        covered: false, 
        botKeywords: ["survey", "conversational", "experience", "compared to", "multiple choice", "questionnaire", "this tool", "feedback"]
    }
];

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
const timerDisplay = document.getElementById('timer');
const helpModal = document.getElementById('help-modal');
const progressBtn = document.getElementById('progress-btn');
const progressText = document.getElementById('progress-text');
const topicDropdown = document.getElementById('topic-dropdown');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    userInfoForm.addEventListener('submit', handleInitialSubmit);
    sendBtn.addEventListener('click', handleSendMessage);
    userInput.addEventListener('keydown', handleKeyPress);
    modifyBtn.addEventListener('click', handleModify);
    approveBtn.addEventListener('click', handleApprove);
    helpBtn.addEventListener('click', showHelp);
    endConversationBtn.addEventListener('click', handleEndConversation);
    progressBtn.addEventListener('click', toggleTopicDropdown);
    
    // Initialize topic dropdown
    renderTopics();
    
    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
        if (!progressBtn.contains(e.target) && !topicDropdown.contains(e.target)) {
            closeTopicDropdown();
        }
    });
});

// Topic Functions
function renderTopics() {
    const topicList = document.querySelector('.topic-list');
    topicList.innerHTML = '';
    
    topics.forEach((topic, index) => {
        const item = document.createElement('div');
        item.className = `topic-item ${topic.covered ? 'covered' : ''}`;
        item.innerHTML = `
            <div class="topic-checkbox ${topic.covered ? 'covered' : ''}"></div>
            <span class="topic-text">${topic.label}</span>
        `;
        topicList.appendChild(item);
    });
}

function updateTopicProgress() {
    const coveredCount = topics.filter(t => t.covered).length;
    progressText.textContent = `${coveredCount}/8 topics`;
    renderTopics();
}

// Detect which topic the bot is asking about
function detectBotTopic(botMessage) {
    const lowerMessage = botMessage.toLowerCase();
    
    for (let i = 0; i < topics.length; i++) {
        if (topics[i].covered) continue; // Skip already covered topics
        
        const hasKeyword = topics[i].botKeywords.some(keyword => 
            lowerMessage.includes(keyword.toLowerCase())
        );
        
        if (hasKeyword) {
            currentTopicIndex = i;
            return;
        }
    }
    
    // No specific topic detected
    currentTopicIndex = null;
}

// Mark current topic as covered when user responds substantively
function markCurrentTopicCovered(userMessage) {
    // Must be substantive (>15 chars) and not a dismissive response
    if (userMessage.length < 15) return;
    
    const lower = userMessage.toLowerCase();
    const dismissive = ['i don\'t know', 'not sure', 'maybe', 'next question', 'move on', 'pass'];
    const isDismissive = dismissive.some(phrase => lower.includes(phrase));
    
    if (isDismissive) {
        // User declined to engage with this topic
        currentTopicIndex = null;
        return;
    }
    
    // Mark the current topic as covered
    if (currentTopicIndex !== null && !topics[currentTopicIndex].covered) {
        topics[currentTopicIndex].covered = true;
        updateTopicProgress();
    }
}

function toggleTopicDropdown() {
    const isHidden = topicDropdown.classList.contains('hidden');
    
    if (isHidden) {
        topicDropdown.classList.remove('hidden');
        progressBtn.classList.add('active');
    } else {
        closeTopicDropdown();
    }
}

function closeTopicDropdown() {
    topicDropdown.classList.add('hidden');
    progressBtn.classList.remove('active');
}

// Timer Functions
function startTimer() {
    startTime = Date.now();
    tenMinuteWarningShown = false;
    
    timerInterval = setInterval(() => {
        const elapsed = Math.floor((Date.now() - startTime) / 1000);
        const minutes = Math.floor(elapsed / 60);
        const seconds = elapsed % 60;
        
        timerDisplay.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
        
        // Check for 10-minute mark
        if (minutes >= 10 && !tenMinuteWarningShown) {
            tenMinuteWarningShown = true;
            addMessage('bot', '⏰ Just a heads up - we\'ve been chatting for 10 minutes. Feel free to continue or click "I\'m Done" whenever you\'re ready to wrap up.');
        }
    }, 1000);
}

function stopTimer() {
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }
}

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
            
            // Detect initial topic from greeting
            detectBotTopic(data.message);
            
            // Start timer
            startTimer();
            
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
    
    // Stop timer
    stopTimer();
    
    // Disable controls
    setInputEnabled(false);
    endConversationBtn.disabled = true;
    closeTopicDropdown();
    
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
    
    // Mark current topic as covered if user gave substantive response
    markCurrentTopicCovered(message);
    
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
                // Bot initiated summary - stop timer and show modal
                stopTimer();
                closeTopicDropdown();
                setTimeout(() => showSummaryModal(data.message), 1000);
            } else {
                // Detect which topic bot is asking about now
                detectBotTopic(data.message);
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

// Check if message is a summary - more robust detection
function isSummaryMessage(message) {
    const summaryIndicators = [
        'PARTICIPANT SUMMARY',
        'participant summary',
        'Workshop Feedback:',
        'NextEd Interest:',
        'Key Concerns',
        'Does this accurately capture your thoughts',
        'Does this capture your thoughts',
        'Review this summary',
        'here\'s a summary',
        'let me summarize',
        'Summary of',
        'Recommended Follow-up:'
    ];
    
    return summaryIndicators.some(indicator => 
        message.includes(indicator)
    );
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
    startTimer(); // Restart timer if they want to continue
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
            stopTimer();
        } else {
            alert('Error completing session. Please try again.');
        }
    } catch (error) {
        console.error('Error:', error);
        alert('Failed to complete session. Please try again.');
    }
}