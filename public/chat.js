// C3 Chat Interface Logic
const API_BASE = '/api';

let sessionId = null;
let conversationEnded = false;
let timerInterval = null;
let startTime = null;
let isTyping = false; // Prevent user input during bot typing animation

// DOM Elements
const loginTab = document.getElementById('login-tab');
const signupTab = document.getElementById('signup-tab');
const loginForm = document.getElementById('login-form');
const signupForm = document.getElementById('signup-form');
const authContainer = document.getElementById('auth-form');
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

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    // Tab switching handled by onclick in HTML
    loginForm.addEventListener('submit', handleLogin);
    signupForm.addEventListener('submit', handleSignup);
    sendBtn.addEventListener('click', handleSendMessage);
    userInput.addEventListener('keydown', handleKeyPress);
    modifyBtn.addEventListener('click', handleModify);
    approveBtn.addEventListener('click', handleApprove);
    helpBtn.addEventListener('click', showHelp);
    endConversationBtn.addEventListener('click', handleEndConversation);
});

// Tab switching - make globally accessible for onclick handlers
window.showSignupForm = function() {
    signupTab.classList.add('active');
    loginTab.classList.remove('active');
    signupForm.classList.remove('hidden');
    loginForm.classList.add('hidden');
};

window.showLoginForm = function() {
    loginTab.classList.add('active');
    signupTab.classList.remove('active');
    loginForm.classList.remove('hidden');
    signupForm.classList.add('hidden');
};

// Aliases for HTML onclick handlers
window.showSignup = window.showSignupForm;
window.showLogin = window.showLoginForm;

function showLoginForm() {
    window.showLoginForm();
}

function showSignupForm() {
    window.showSignupForm();
}

// Handle signup
async function handleSignup(e) {
    e.preventDefault();
    
    const name = document.getElementById('signup-name').value.trim();
    const email = document.getElementById('signup-email').value.trim();
    const password = document.getElementById('signup-password').value;
    
    if (!name || !email || !password) return;
    
    try {
        const response = await fetch(`${API_BASE}/signup`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, email, password })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            sessionId = data.session_id;
            
            // Hide auth, show chat
            authContainer.classList.add('hidden');
            chatInterface.classList.remove('hidden');
            
            // Display bot's greeting with typing animation
            addBotMessageWithTyping(data.message);
            
            // Start timer
            startTimer();
            
            // Focus on input after animation completes
            setTimeout(() => userInput.focus(), data.message.split(' ').length * 50);
        } else {
            alert('Signup error: ' + data.error);
        }
    } catch (error) {
        console.error('Error:', error);
        alert('Failed to connect to server. Please try again.');
    }
}

// Handle login
async function handleLogin(e) {
    e.preventDefault();
    
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;
    
    if (!email || !password) return;
    
    try {
        const response = await fetch(`${API_BASE}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            sessionId = data.session_id;
            
            // Hide auth, show chat
            authContainer.classList.add('hidden');
            chatInterface.classList.remove('hidden');
            
            // Check if resuming existing conversation
            if (data.conversation && data.conversation.length > 0) {
                // Show resume notice in messages container
                const resumeNotice = document.createElement('div');
                resumeNotice.className = 'message bot-message';
                resumeNotice.innerHTML = `
                    <div class="message-bubble" style="background-color: #e3f2fd; padding: 20px;">
                        <strong>Welcome back!</strong> You have an existing conversation from ${new Date(data.start_time).toLocaleDateString()}.<br><br>
                        <button onclick="continueConversation()" class="btn-primary" style="margin-right: 10px;">Continue Conversation</button>
                        <button onclick="viewHistory()" class="btn-secondary">View History First</button>
                    </div>
                `;
                messagesContainer.appendChild(resumeNotice);
                
                // Store conversation for later
                window.existingConversation = data.conversation;
                window.startTime = new Date(data.start_time).getTime();
            } else {
                // New conversation - show greeting
                addBotMessageWithTyping(data.message);
                startTimer();
                setTimeout(() => userInput.focus(), data.message.split(' ').length * 50);
            }
        } else {
            alert('Login error: ' + data.error);
        }
    } catch (error) {
        console.error('Error:', error);
        alert('Failed to connect to server. Please try again.');
    }
}

// Resume conversation functions
window.continueConversation = function() {
    // Clear the resume notice
    messagesContainer.innerHTML = '';
    
    // Display conversation history instantly (no animation for history)
    window.existingConversation.forEach(msg => {
        addMessage(msg.role, msg.content, false); // false = no animation
    });
    
    // Start timer from original start time
    startTimer(window.startTime);
    
    userInput.focus();
};

window.viewHistory = function() {
    // Clear the resume notice
    messagesContainer.innerHTML = '';
    
    // Display conversation history
    window.existingConversation.forEach(msg => {
        addMessage(msg.role, msg.content, false);
    });
    
    // Add notice
    const noticeDiv = document.createElement('div');
    noticeDiv.className = 'message bot-message';
    noticeDiv.innerHTML = '<div class="message-bubble" style="background-color: #e3f2fd; color: #1565c0; font-style: italic;">That\'s everything so far. Feel free to continue whenever you\'re ready.</div>';
    messagesContainer.appendChild(noticeDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
    
    // Start timer
    startTimer(window.startTime);
    
    userInput.focus();
};

// Timer Functions
function startTimer(existingStartTime = null) {
    startTime = existingStartTime || Date.now();
    
    timerInterval = setInterval(() => {
        const elapsed = Math.floor((Date.now() - startTime) / 1000);
        const minutes = Math.floor(elapsed / 60);
        const seconds = elapsed % 60;
        
        timerDisplay.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
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

// Handle "I'm Done" button
async function handleEndConversation() {
    if (conversationEnded || isTyping) return;
    
    // Stop timer
    stopTimer();
    
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
    if (conversationEnded || isTyping) return;
    
    const message = userInput.value.trim();
    if (!message) return;
    
    // Display user message (instant, no animation)
    addMessage('user', message, false);
    
    // Clear input
    userInput.value = '';
    
    // Disable input while processing
    setInputEnabled(false);
    showTypingIndicator();
    
    try {
        const response = await fetch(`${API_BASE}/message`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                session_id: sessionId, 
                message,
                start_time: startTime
            })
        });
        
        const data = await response.json();
        
        hideTypingIndicator();
        
        if (response.ok) {
            // Display bot response with typing animation
            await addBotMessageWithTyping(data.message);
            
            // Check if this is a summary
            if (isSummaryMessage(data.message)) {
                // Bot initiated summary - stop timer and show modal
                stopTimer();
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

// Add message to chat with optional typing animation
function addMessage(role, content, animate = false) {
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

// Add bot message with typing animation
async function addBotMessageWithTyping(content) {
    isTyping = true;
    setInputEnabled(false);
    
    // Create message container
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message bot-message';
    
    const bubbleDiv = document.createElement('div');
    bubbleDiv.className = 'message-bubble';
    bubbleDiv.textContent = ''; // Start empty
    
    messageDiv.appendChild(bubbleDiv);
    messagesContainer.appendChild(messageDiv);
    
    // Split into words
    const words = content.split(' ');
    
    // Calculate delay per word based on total length
    // Shorter messages: slower (60ms/word)
    // Longer messages: faster (20ms/word)
    // This makes short messages feel natural and long messages not tedious
    const wordCount = words.length;
    let delayPerWord;
    
    if (wordCount < 20) {
        delayPerWord = 60; // Slow for very short messages
    } else if (wordCount < 50) {
        delayPerWord = 40; // Medium
    } else if (wordCount < 100) {
        delayPerWord = 25; // Faster for longer messages
    } else {
        delayPerWord = 20; // Very fast for very long messages
    }
    
    // Animate words appearing one by one
    for (let i = 0; i < words.length; i++) {
        await new Promise(resolve => setTimeout(resolve, delayPerWord));
        
        if (i === 0) {
            bubbleDiv.textContent = words[i];
        } else {
            bubbleDiv.textContent += ' ' + words[i];
        }
        
        // Scroll to bottom during animation
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
    
    isTyping = false;
    
    // Re-enable input after animation completes (unless conversation ended)
    if (!conversationEnded) {
        setInputEnabled(true);
    }
}

// Check if message is a summary
function isSummaryMessage(message) {
    const lowerMessage = message.toLowerCase();
    
    const hasConfirmation = (lowerMessage.includes('does this') || lowerMessage.includes('does that')) && 
                           (lowerMessage.includes('capture') || lowerMessage.includes('accurate'));
    
    const sectionHeaders = message.match(/\*\*[A-Z][^*]+\*\*/g) || [];
    const hasMultipleSections = sectionHeaders.length >= 3;
    
    const hasCourseContent = lowerMessage.includes('course');
    const isSubstantial = message.length > 500;
    
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
    startTimer(); // Restart timer if they want to continue
    userInput.focus();
    addBotMessageWithTyping('Please share any clarifications or additions you\'d like to make.');
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
            await addBotMessageWithTyping('Thank you for your time and thoughtful responses! Your conversation has been saved. You can return anytime to continue exploring these ideas.');
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