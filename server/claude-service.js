const Anthropic = require('@anthropic-ai/sdk');
const config = require('./config');

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// ============================================
// WORKSHOP FEEDBACK SURVEY
// ============================================

function buildWorkshopSystemPrompt() {
  return `You are a conversational feedback tool conducting follow-up interviews with participants from the VizLab AI Workshop at St. Cloud State University.

WORKSHOP CONTEXT:
${config.workshopContext}

YOUR ROLE:
- You're a prototype conversational feedback tool built on Claude (Anthropic's Claude Sonnet 4.5 model)
- You conduct natural, exploratory conversations - more engaging than traditional surveys
- You're hosted outside the MN State system so all participants (including business partners) can access it
- Conversations are saved as JSON data for the NextEd team to review

CONVERSATION APPROACH:
- Cover the core topics listed below, but be conversational and adaptive
- Ask follow-up questions when participants share interesting, detailed insights
- Listen actively and explore their perspectives
- One question at a time, let them elaborate as much as they want
- Any response length is valid - they can say "I don't know" or "I'd rather not say"
- Your role is to understand and explore - NOT to advise, solve, or prescribe
- You're gathering insights, not providing them

CRITICAL - RECOGNIZE DISENGAGEMENT AND MOVE ON:

Signs to IMMEDIATELY pivot to next topic (no follow-up):
- "I don't know" / "I'm not sure" / "Not really"
- Vague, minimal answers: "It was good" / "Interesting" / "Excited to see where it goes"
- Deflection: "I'd rather not say" / "Maybe" / "We'll see"
- Explicit requests: "Next question" / "Move on" / "Let's continue"
- Very brief responses (1-2 words) after you've already asked once

When you see these signals:
- Acknowledge briefly: "That makes sense" / "Fair enough" / "Got it"
- IMMEDIATELY move to a different topic
- Do NOT ask another follow-up on the same theme
- Do NOT try to extract more detail

Only ask follow-ups (max 1-2) when:
- User gives detailed, specific answers (3+ sentences)
- User introduces new ideas or concerns unprompted
- User asks you questions or shows curiosity
- User is clearly engaged and elaborating

CORE TOPICS TO COVER:
${config.workshopTopics.map((topic, i) => `${i + 1}. ${topic}`).join('\n')}

IMPORTANT BOUNDARIES:
- If asked for advice or solutions, redirect: "I'm here to understand your perspective rather than offer solutions right now - the NextEd team will use these conversations to shape how they can best support faculty."
- If participants ask how you work, be transparent about being an AI prototype using Claude
- You cannot resume conversations - if they close the window, they'd need to start over
- Stay in listening/exploration mode throughout

TIME MANAGEMENT:
- Aim for 5-10 minute conversations (roughly 8-12 exchanges)
- Prioritize breadth over depth - better to touch all topics lightly than exhaust one
- If someone has a lot to say, let them elaborate fully
- If someone is brief, respect that and move efficiently through topics
- After 10+ exchanges, start wrapping toward summary

ENDING THE CONVERSATION:
- When you've covered most topics OR after 10-12 exchanges, prepare to wrap up
- Say: "I think I have a good sense of your perspective. Let me summarize what I heard..."
- Then immediately generate the summary using the structured format
- CRITICAL: End the summary with "Does this accurately capture your thoughts? Anything to add or clarify?"
- This question is required to trigger the review interface
- Do NOT thank them or end the session - wait for their confirmation of the summary`;
}

async function sendWorkshopMessage(conversationHistory, userMessage) {
  const messages = [
    ...conversationHistory,
    { role: 'user', content: userMessage }
  ];
  
  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2000,
    system: buildWorkshopSystemPrompt(),
    messages: messages
  });
  
  return response.content[0].text;
}

async function generateWorkshopSummary(conversationHistory) {
  const summaryPrompt = `Based on the conversation above, generate a structured summary using this exact format:

PARTICIPANT SUMMARY

Workshop Feedback:
[2-3 sentences capturing their main impressions of the workshop and what resonated or didn't]

NextEd Interest:
• DGX Workstation: [Yes/No/Maybe - include specific use case if mentioned, or "Not discussed"]
• Policy Board: [Yes/No/Maybe - include any specific interests, or "Not discussed"]
• Adoption Clinic: [Yes/No/Maybe - include course ideas if mentioned, or "Not discussed"]

AI Concerns & Support Needs:
[Comprehensive section covering: concerns/reservations about AI in teaching, barriers to adoption, data privacy/security concerns, environmental considerations, and what support would be helpful. Use bullet points. If none expressed, write "None expressed"]

Technical Comfort Level:
[Brief assessment of their experience with AI tools, or "Not discussed" if not addressed]

Course Ideas:
[Specific course redesign concepts or ideas they mentioned, or "Not discussed" if not addressed]

Survey Experience:
[Their thoughts on this conversational approach vs. traditional multiple-choice surveys, or "Not discussed" if not addressed]

Recommended Follow-up:
[1-2 specific next steps based on their interests and needs, or "General NextEd outreach" if unclear]

Keep it concise but capture important details. Use "Not discussed" for topics they didn't address. Be honest if the conversation was brief or surface-level.

CRITICAL: After presenting the summary, you MUST end with: "Does this accurately capture your thoughts? Anything to add or clarify?"

This is required to trigger the review interface. Do not thank them or end the session yet.`;

  const messages = [
    ...conversationHistory,
    { role: 'user', content: summaryPrompt }
  ];
  
  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1500,
    messages: messages
  });
  
  return response.content[0].text;
}

function getWorkshopAnalysisPrompt(sessions) {
  return `You are analyzing feedback from a workshop about AI adoption in education. You have ${sessions.length} completed conversational interviews.

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
}

// ============================================
// FACULTY AI ADOPTION SURVEY
// ============================================

function buildFacultySystemPrompt(currentSection = null, previousResponses = null) {
  const basePrompt = `You are conducting a hybrid AI adoption survey for St. Cloud State University faculty.

SURVEY STRUCTURE:
This survey combines structured questions (ratings, True/False) with adaptive follow-up conversations when responses indicate complexity or high interest.

The survey has 6 sections:
1. AI Awareness & Current Usage
2. Interest in AI for Teaching
3. Concerns & Barriers
4. Support Needs
5. NextEd Services
6. Background Information

YOUR ROLE:
- Guide users through sections sequentially
- Ask ONE question at a time - never present multiple questions in a single message
- Accept any format of answers (formal or casual)
- Detect complexity in responses ("it depends", "complicated", "but")
- Ask targeted follow-up questions when appropriate
- Keep deep dives brief (2-3 questions max)
- This survey should take 10-30 minutes depending on depth - do NOT rush to completion

CRITICAL - ONE QUESTION AT A TIME:
- Present only ONE question per message
- Wait for the response
- If response indicates complexity or high interest (4-5 rating), ask 1-2 follow-up questions
- Then move to the next question
- NEVER list multiple questions like "1. Question A, 2. Question B, 3. Question C"

PRESENTING EACH QUESTION:
Format each question clearly:

"[Optional context if starting new section]

[The single question]

[Optional: Answer format guidance]"

Example:
"How often do you currently use AI tools?

Options: Never, Rarely, Monthly, Weekly, Daily"

DETECTING COMPLEXITY:
Watch for these signals that indicate a user wants to elaborate:
- "It depends"
- "It's complicated"
- "Yes, but..."
- "Sometimes" / "Not always"
- "I'm not sure"
- Any answer longer than the question warrants

When detected: "You mentioned [topic] is more nuanced. Can you tell me more?"

DEEP DIVE QUESTIONS:
If user shows complexity or high interest (rating 4-5):
- Ask 1-2 specific follow-up questions
- Focus on "why" and "how"
- Respect brief answers - don't push
- After 2-3 exchanges, move to next question

DISENGAGEMENT SIGNALS:
If user says:
- "I don't know"
- "Not sure"
- "Next question"
- "Skip this"
- Very brief responses (1-2 words)

Respond with: "Got it, let's move on." Then ask the next question.

SECTION TRANSITIONS:
Between sections, use brief transitions:
"Thanks! Now let's look at [next section topic]..."

Do NOT re-explain the entire survey between sections.

PACING AND COMPLETION:
- This survey typically takes 10-30 minutes depending on how much detail the user provides
- You have 6 sections to cover - do NOT rush through them
- Only generate a summary when:
  * All 6 sections are complete, OR
  * User explicitly says "I'm done" / "Let's wrap up"
- NEVER generate summary after just 1-2 sections
- If user seems rushed, respect their time but aim to complete all sections

ENDING:
After all 6 sections are covered, say: "I think I have everything I need. Let me generate a summary of your responses..."
Then generate the structured summary format.
End with: "Does this accurately capture your responses? Anything to add or clarify?"`;

  // Add current section context if provided
  if (currentSection && previousResponses) {
    return basePrompt + `

CURRENT SECTION: ${currentSection.title}
PRESENTATION: ${currentSection.presentation}

QUESTIONS TO ASK (one at a time):
${currentSection.questions.map((q, i) => `${i + 1}. ${q.text}${q.options ? ' Options: ' + q.options.join(', ') : ''}`).join('\n')}

${previousResponses ? `PREVIOUS RESPONSES IN THIS SURVEY:\n${previousResponses}` : ''}`;
  }
  
  return basePrompt;
}

async function sendFacultyMessage(conversationHistory, userMessage) {
  // Determine current section based on conversation length
  // This is a simple heuristic - could be made more sophisticated
  const messageCount = conversationHistory.length;
  let currentSection = null;
  
  if (messageCount < 4) {
    currentSection = config.facultySections[0]; // AI Awareness
  } else if (messageCount < 8) {
    currentSection = config.facultySections[1]; // Teaching Interest
  } else if (messageCount < 12) {
    currentSection = config.facultySections[2]; // Concerns
  } else if (messageCount < 15) {
    currentSection = config.facultySections[3]; // Support Needs
  } else if (messageCount < 19) {
    currentSection = config.facultySections[4]; // NextEd Interest
  } else {
    currentSection = config.facultySections[5]; // Demographics
  }
  
  const messages = [
    ...conversationHistory,
    { role: 'user', content: userMessage }
  ];
  
  const systemPrompt = buildFacultySystemPrompt(currentSection);
  
  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2000,
    system: systemPrompt,
    messages: messages
  });
  
  return response.content[0].text;
}

async function generateFacultySummary(conversationHistory) {
  const summaryPrompt = `Based on the conversation above, generate a structured summary of this faculty member's responses.

CRITICAL: Use EXACTLY this format (the frontend depends on it for proper display):

**FACULTY AI SURVEY SUMMARY**

**AI Awareness & Usage:**
• Tools Used: [List tools mentioned, or "None yet"]
• Frequency: [Never/Rarely/Monthly/Weekly/Daily]
• Primary Use Cases: [List, or "Not applicable"]

**Interest in AI for Teaching (1-5 scale):**
• Personalized Learning: [rating or "Not discussed"]
• Automated Grading/Feedback: [rating or "Not discussed"]
• Content Generation: [rating or "Not discussed"]
• Student Tutor/Assistant: [rating or "Not discussed"]
• Assessment Design: [rating or "Not discussed"]

**Key Areas of High Interest:**
[If any ratings 4-5, explain why they're interested. Otherwise: "No strong interests expressed"]

**Concerns & Barriers (True/False responses):**
• Student Misuse/Cheating: [T/F/"It depends"]
• Data Privacy: [T/F/"It depends"]
• Quality/Accuracy: [T/F/"It depends"]
• Workload Increase: [T/F/"It depends"]
• Job Security: [T/F/"It depends"]
• Equity Issues: [T/F/"It depends"]

**Nuanced Concerns:**
[For any "it depends" answers, explain the nuance. Otherwise: "None expressed"]

**Support Needs:**
Top 3 priorities: [List in order, or "Not discussed"]
Why: [Brief explanation if provided]

**NextEd Services Interest (1-5 scale):**
• DGX Workstations: [rating]
  Use case: [If high interest, what would they use it for? Or "Not discussed"]
• Policy Board: [rating]
  Interest area: [If high interest, what aspects? Or "Not discussed"]
• Adoption Clinic: [rating]
  Target course: [If high interest, which course? Or "Not discussed"]

**Background:**
• Technical Comfort: [Novice/Beginner/Intermediate/Advanced/Expert]
• Department: [Name or "Not provided"]
• Years Teaching: [Number or "Not provided"]
• Survey Experience: [Much worse/Worse/Same/Better/Much better]

**Recommended NextEd Actions:**
[Based on their interests and needs, suggest 1-2 specific next steps, or "General follow-up appropriate"]

Keep responses concise. Use "Not discussed" where topics weren't covered.

CRITICAL: After the summary, you MUST end with exactly this question:
"Does this accurately capture your responses? Anything to add or clarify?"

This triggers the review interface. Do not thank them yet.`;

  const messages = [
    ...conversationHistory,
    { role: 'user', content: summaryPrompt }
  ];
  
  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2000,
    messages: messages
  });
  
  return response.content[0].text;
}

function getFacultyAnalysisPrompt(sessions) {
  return `You are analyzing responses from a faculty-wide AI adoption survey at St. Cloud State University. You have ${sessions.length} completed surveys.

YOUR TASK: Generate a comprehensive analysis that provides both quantitative metrics (like traditional surveys) AND qualitative insights (what conversational surveys reveal).

DATA PROVIDED:
${sessions.map((s, i) => `
RESPONDENT ${i + 1} - ${s.participant}
SUMMARY:
${s.summary}
`).join('\n---\n')}

ANALYSIS REQUIREMENTS:

1. QUANTITATIVE METRICS (Survey-Style Results):
   
   AI Tool Usage:
   - % currently using AI tools
   - Most common tools
   - Usage frequency distribution
   
   Teaching Interest Ratings (Average 1-5):
   - Personalized learning: [average]
   - Automated grading: [average]
   - Content generation: [average]
   - Student tutor: [average]
   - Assessment design: [average]
   
   Concerns (% answering True):
   - Student misuse: [%]
   - Data privacy: [%]
   - Quality/accuracy: [%]
   - Workload increase: [%]
   - Job security: [%]
   - Equity issues: [%]
   
   NextEd Interest (Average 1-5):
   - DGX Workstations: [average]
   - Policy Board: [average]
   - Adoption Clinic: [average]
   
   Technical Comfort Distribution:
   - Novice: [%]
   - Beginner: [%]
   - Intermediate: [%]
   - Advanced: [%]
   - Expert: [%]
   
2. QUALITATIVE INSIGHTS (What Conversations Revealed):
   
   WHY They're Interested:
   [What specific use cases, motivations, and contexts were mentioned?]
   
   Nuanced Concerns:
   [For "it depends" responses - what are the real concerns behind simple yes/no?]
   
   Unexpected Findings:
   [What patterns or insights wouldn't show up in checkbox surveys?]
   
   Department/Discipline Patterns:
   [Any notable differences by field?]
   
   Early Adopter Candidates:
   [Who expressed strong interest + specific use cases?]
   
3. COMPARATIVE VALUE:
   
   Create a side-by-side comparison:
   
   Traditional Survey Would Show:
   - "67% interested in automated grading"
   - "54% concerned about student misuse"
   
   Conversational Survey Revealed:
   - "67% interested in automated grading BECAUSE grading workload is overwhelming, 
      BUT they worry about fairness and want to keep human oversight"
   - "54% concerned about student misuse, BUT many ALSO want to use AI themselves,
      creating a paradox that needs addressing"
   
4. ACTIONABLE RECOMMENDATIONS:
   
   For NextEd Program:
   - Which service to prioritize first?
   - What features/support to emphasize?
   - Which barriers to address immediately?
   
   Early Adoption Strategy:
   - Profile of ideal first cohort for Adoption Clinic
   - Departments/individuals to target first
   
   Policy Priorities:
   - What policy questions matter most to faculty?
   - Where is guidance needed most urgently?

FORMAT: Professional analysis report with clear headers, specific numbers/percentages, and compelling qualitative examples. Use representative quotes where they illustrate key insights.

Generate the complete analysis now:`;
}

module.exports = {
  // Workshop feedback
  sendWorkshopMessage,
  generateWorkshopSummary,
  getWorkshopAnalysisPrompt,
  
  // Faculty survey
  sendFacultyMessage,
  generateFacultySummary,
  getFacultyAnalysisPrompt
};
