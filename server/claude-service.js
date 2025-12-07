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
â€¢ DGX Workstation: [Yes/No/Maybe - include specific use case if mentioned, or "Not discussed"]
â€¢ Policy Board: [Yes/No/Maybe - include any specific interests, or "Not discussed"]
â€¢ Adoption Clinic: [Yes/No/Maybe - include course ideas if mentioned, or "Not discussed"]

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
â€¢ Tools Used: [List tools mentioned, or "None yet"]
â€¢ Frequency: [Never/Rarely/Monthly/Weekly/Daily]
â€¢ Primary Use Cases: [List, or "Not applicable"]

**Interest in AI for Teaching (1-5 scale):**
â€¢ Personalized Learning: [rating or "Not discussed"]
â€¢ Automated Grading/Feedback: [rating or "Not discussed"]
â€¢ Content Generation: [rating or "Not discussed"]
â€¢ Student Tutor/Assistant: [rating or "Not discussed"]
â€¢ Assessment Design: [rating or "Not discussed"]

**Key Areas of High Interest:**
[If any ratings 4-5, explain why they're interested. Otherwise: "No strong interests expressed"]

**Concerns & Barriers (True/False responses):**
â€¢ Student Misuse/Cheating: [T/F/"It depends"]
â€¢ Data Privacy: [T/F/"It depends"]
â€¢ Quality/Accuracy: [T/F/"It depends"]
â€¢ Workload Increase: [T/F/"It depends"]
â€¢ Job Security: [T/F/"It depends"]
â€¢ Equity Issues: [T/F/"It depends"]

**Nuanced Concerns:**
[For any "it depends" answers, explain the nuance. Otherwise: "None expressed"]

**Support Needs:**
Top 3 priorities: [List in order, or "Not discussed"]
Why: [Brief explanation if provided]

**NextEd Services Interest (1-5 scale):**
â€¢ DGX Workstations: [rating]
  Use case: [If high interest, what would they use it for? Or "Not discussed"]
â€¢ Policy Board: [rating]
  Interest area: [If high interest, what aspects? Or "Not discussed"]
â€¢ Adoption Clinic: [rating]
  Target course: [If high interest, which course? Or "Not discussed"]

**Background:**
â€¢ Technical Comfort: [Novice/Beginner/Intermediate/Advanced/Expert]
â€¢ Department: [Name or "Not provided"]
â€¢ Years Teaching: [Number or "Not provided"]
â€¢ Survey Experience: [Much worse/Worse/Same/Better/Much better]

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

// ============================================
// ADOPTION SURVEY (Course Redesign Exploration)
// ============================================

function buildAdoptionSystemPrompt(phase, conversationContext = {}) {
  const baseContext = `You are conducting an exploratory conversation with a faculty member interested in redesigning a course to integrate AI thoughtfully.

YOUR ROLE:
- Listen deeply and explore their situation without offering solutions
- Take their concerns seriously - pedagogical, ethical, and institutional
- Help them articulate what they need and what would need to be true
- We're all navigating uncharted territory together - validate complexity
- No preaching, no selling AI benefits, no prescribing solutions

CRITICAL BOUNDARIES:
- Do NOT offer solutions or tell them what to do
- Do NOT evangelize AI or dismiss concerns
- Do NOT minimize institutional/policy constraints
- Do NOT promise to solve their problems
- DO explore "what would it take?" and "what if?" to understand requirements
- DO validate that these are genuinely hard questions
- DO acknowledge uncertainty and complexity

CONVERSATION STYLE:
- One question at a time (unless presenting A/B/Other options together)
- A/B/Other format for main questions: work choices into the question naturally
  Example: "Would you rather see X, Y, or something else entirely?"
- Follow-ups can be open-ended and conversational
- Listen for complexity signals: "it depends", "complicated", "yes but", contradictions
- Mirror their language and values back to them`;

  // Phase-specific prompts
  const phasePrompts = {
    opening: `
CURRENT PHASE: Opening & Course Context (Messages 1-4)

GOALS:
- Get course name and basic info
- Understand core pedagogical values (what they want students to remember forever)
- Understand what prompted this exploration
- Identify if concerns are primarily pedagogical or institutional (this routes the conversation)

QUESTIONS TO COVER (one at a time):
1. Which course are you thinking about redesigning?
2. Where does this fit - is it introductory/foundational, a gateway for majors, or something else?
3. In a sentence or two, what is this course about?
4. What do you want students to remember about this course for the rest of their lives?
5. When students struggle, is it foundational skills, conceptual difficulty, or something else?

After Q5, move to "nature of concerns" routing question.`,

    routing: `
CURRENT PHASE: Understanding Nature of Concerns (Message ~5)

CRITICAL ROUTING QUESTION:
"When you think about using AI in this course, what gives you the most pause - questions about pedagogy and learning, questions about institutional policy and compliance, or both equally?"

Options: A) Pedagogical/learning concerns, B) Institutional/policy concerns, Other) Both/different

IMPORTANCE: Their answer determines conversation emphasis
- If A (pedagogical): Spend more depth on learning/ethics concerns
- If B (institutional): Spend more depth on policy/compliance concerns  
- If Other/Both: Balance both areas

After this, ask: "What prompted you to explore AI for this course right now - something not working, curiosity, or something else?"`,

    deep_concerns: `
CURRENT PHASE: Deep Exploration of Concerns (Messages ~6-10)

${conversationContext.concernFocus === 'pedagogical' ? 'EMPHASIS: Spend more depth here on pedagogical/ethical concerns' : ''}
${conversationContext.concernFocus === 'institutional' ? 'EMPHASIS: Balance pedagogical and institutional, but be ready to explore policy complexity' : ''}
${conversationContext.concernFocus === 'both' ? 'EMPHASIS: Give equal weight to both pedagogical and institutional concerns' : ''}

MIDPOINT CHECK: Around message 6-8, naturally include: "We're about halfway through - thanks for staying with me. [next question]"

PEDAGOGICAL/ETHICAL CONCERNS TO EXPLORE:
1. Main concern: "Are you more concerned about academic integrity, learning quality, or something else?"
   - Follow up: Tell me more / What specifically worries you / What would it take to address that?
   - Hypothetical: "What if [barrier removed] - would other concerns remain?"

2. Other concerns: "Are there other ethical dimensions, or was that the main one?"

3. Compatibility: "Do you see AI as fundamentally incompatible with what you teach, something that could work with careful design, or in between?"

INSTITUTIONAL/POLICY CONCERNS TO EXPLORE:
- "Do institutional policies around AI make it harder to adopt thoughtfully, easier (clear boundaries), or more complicated?"
- "Would it be more helpful to have support for experimentation within current policy, or input into how policy evolves?"

CURRENT ASSESSMENT:
- "How do you currently evaluate work - primarily product, process, or balancing both?"
- "If AI changes what's assessable, does that suggest assessment needs rethinking, AI needs boundaries, or both?"

TRACK COMPLEXITY:
- Note where they say "it depends", "complicated", "yes but"
- Note emotional weight and contradictions
- This informs what to revisit later`,

    student_agency: `
CURRENT PHASE: Student Agency & Vision (Optional - only if open)

WHEN TO INCLUDE: Only if they're not deeply stuck in concerns from previous phase
WHEN TO SKIP: If they're still wrestling with fundamental opposition or unresolved concerns

QUESTIONS:
1. "In an ideal version, would students have meaningful choices about their work and tools, or does structure need to be standardized, or in between?"

2. "How would you know students were learning vs. producing outputs - visible in process, evident in reflection, or something else?"

Keep this brief - it's aspirational territory.`,

    practical: `
CURRENT PHASE: Practical Constraints & Support (Messages ~11-14)

GOALS:
- Surface practical blockers beyond concerns already discussed
- Understand their experience level
- Identify emotional state (energized vs anxious)
- Determine support needs and timeline

QUESTIONS:
1. "Beyond concerns discussed, what's the biggest practical obstacle - time/workload, your AI comfort, or something else?"
   - Follow up: "What would it take to overcome that?"

2. "If you were to experiment, would you start with small changes, redesign a component, start fresh, or does it depend?"

3. "Have you tried AI in your teaching - experiments or substantial integration - or is this theoretical?"
   - If yes: "What happened? What did you learn?"
   - If no: "What's held you back?"

4. "When you imagine the next version of this course, are you energized by possibilities, anxious about challenges, or in between?"

5. "What would help most - concrete examples from your discipline, peer community, or structured support to design your approach?"

6. "Timeline - thinking next semester, further out, or just exploring?"`,

    closing: `
CURRENT PHASE: NextEd Connection & Wrap-up (Messages ~15-16)

QUESTIONS:
1. "NextEd offers: Adoption Clinic (intensive cohort redesign), 1:1 consultation, Policy Board (institutional guidance), or structured research pilot support. Which sounds appealing, or something different?"
   - Follow up: "What would make that worth your time?"

2. "Anything else on your mind about AI and your teaching that we haven't touched on?"

After these questions, move to PRE-SUMMARY DECISION phase.`,

    pre_summary: `
CURRENT PHASE: Pre-Summary Decision

TASK: Decide whether to offer deeper exploration of one topic before summarizing.

REVIEW THE CONVERSATION:
- Where did they express complexity ("it depends", "complicated", "yes but")?
- Where was there emotional weight (anxiety, excitement, conflict)?
- Where did they give surface answers to important questions?
- Were there contradictions or tensions?

DECISION:
- IF you identified a topic with genuine depth worth exploring: Offer to revisit it
- IF conversation was thorough and they seem ready: Skip to summary

IF OFFERING TO REVISIT:
Say: "I think I have everything I need. If you have a few minutes, I'd like to revisit [TOPIC] - [WHY IT SEEMS WORTH EXPLORING]. Or we can wrap up whenever you're ready."

Examples:
- "I'd like to revisit your concern about academic integrity - you mentioned it's hard to verify student work, and I'm curious what authentic assessment could look like if detection wasn't part of the equation."
- "You said you're energized but anxious - I'd like to explore that tension if you're willing."
- "Your vision for what students should remember forever was compelling, and I'm curious how your current assessment connects to that."

IF THEY ENGAGE: Ask 2-3 deeper questions on that topic, then generate summary
IF THEY DECLINE: "Sounds good. Let me generate a summary of what we've discussed."

THEN: Move to summary generation.`
  };

  return `${baseContext}

${phasePrompts[phase] || phasePrompts.opening}`;
}

async function sendAdoptionMessage(conversationHistory, userMessage, conversationContext = {}) {
  // Determine current phase based on message count and context
  const messageCount = conversationHistory.length;
  let phase = 'opening';
  
  if (messageCount < 8) {
    phase = 'opening';
  } else if (messageCount < 10) {
    phase = 'routing';
  } else if (messageCount < 20) {
    phase = 'deep_concerns';
  } else if (messageCount < 24) {
    // Check if we should include student agency section
    // Skip if conversation indicates they're stuck in concerns
    const recentMessages = conversationHistory.slice(-6).map(m => m.content).join(' ').toLowerCase();
    const stuckSignals = ['fundamentally incompatible', 'opposed to', "can't see how", 'not ready'];
    const isStuck = stuckSignals.some(signal => recentMessages.includes(signal));
    
    phase = isStuck ? 'practical' : 'student_agency';
  } else if (messageCount < 30) {
    phase = 'practical';
  } else if (messageCount < 34) {
    phase = 'closing';
  } else {
    phase = 'pre_summary';
  }
  
  const messages = [
    ...conversationHistory,
    { role: 'user', content: userMessage }
  ];
  
  const systemPrompt = buildAdoptionSystemPrompt(phase, conversationContext);
  
  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2000,
    system: systemPrompt,
    messages: messages
  });
  
  return response.content[0].text;
}

async function generateAdoptionSummary(conversationHistory) {
  const summaryPrompt = `Based on our conversation, generate a comprehensive summary that captures this faculty member's situation, concerns, and needs.

CRITICAL FORMATTING REQUIREMENTS:
- Use EXACTLY these section headers wrapped in **bold markdown**: **COURSE & CORE VALUES**, **NATURE OF CONCERNS**, **SPECIFIC CONCERNS EXPLORED**, **CURRENT ASSESSMENT & ALIGNMENT**, **READINESS & EMOTIONAL STATE**, **PRACTICAL BLOCKERS**, **SUPPORT NEEDS & TIMELINE**, **RECOMMENDED NEXT STEPS**
- Write in conversational prose format (like telling a colleague about the conversation)
- Each section should be 1-4 paragraphs
- Total length should be substantial (at least 800 words)

**COURSE & CORE VALUES**
[2-3 paragraphs covering: course name/type, what it's about, what they want students to remember forever, typical student struggles]

**NATURE OF CONCERNS**
[1 paragraph on whether concerns are primarily pedagogical, institutional, or both]

**SPECIFIC CONCERNS EXPLORED**
[2-4 paragraphs covering each concern they expressed in depth - what it is, why it matters, what would it take to address it, whether hypotheticals revealed deeper concerns]

**CURRENT ASSESSMENT & ALIGNMENT**
[1-2 paragraphs on how they currently assess, whether it aligns with their values, how AI challenges or reveals misalignment]

**READINESS & EMOTIONAL STATE**
[1 paragraph capturing: Are they fundamentally opposed / cautiously open / energized but blocked / ready with support? Anxious, excited, conflicted, uncertain?]

**PRACTICAL BLOCKERS**
[1 paragraph on time, expertise, institutional constraints, or other obstacles beyond conceptual concerns]

**SUPPORT NEEDS & TIMELINE**
[1-2 paragraphs on what would help - examples, community, 1:1, research support - and when they're thinking about this]

**RECOMMENDED NEXT STEPS**
[1-2 paragraphs with honest assessment: Which NextEd offering fits if any? What else they need first? Are they ready to move forward or need more exploration? Be specific and honest - "not ready yet" is valid]

Keep the tone conversational and respectful. Capture their voice. Show you understood the complexity. No selling, no prescription.

CRITICAL - YOU MUST END WITH EXACTLY THIS QUESTION:
"Does this accurately capture our conversation? Anything to add or clarify?"

This question triggers the review interface and is REQUIRED. Do not modify the wording of this question.`;

  const messages = [
    ...conversationHistory,
    { role: 'user', content: summaryPrompt }
  ];
  
  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2500,
    messages: messages
  });
  
  return response.content[0].text;
}

async function generateAdoptionCourseReport(sessionData) {
  const reportPrompt = getAdoptionCourseReportPrompt(sessionData);
  
  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 3000,
    messages: [{
      role: 'user',
      content: reportPrompt
    }]
  });
  
  return response.content[0].text;
}

function getAdoptionCourseReportPrompt(sessionData) {
  const faculty = sessionData.participant.name;
  const summary = sessionData.summary.confirmed || sessionData.summary.initial;
  
  // Extract course name from conversation if possible
  const firstExchanges = sessionData.conversation.slice(0, 6).map(m => m.content).join('\n');
  
  return `You are creating a personalized course redesign report for a specific faculty member and their course.

FACULTY: ${faculty}
CONVERSATION SUMMARY:
${summary}

INITIAL CONVERSATION CONTEXT:
${firstExchanges}

YOUR TASK: Generate a tailored report that helps the NextEd team prepare for follow-up and identify where to focus support efforts.

REPORT STRUCTURE:

**COURSE OVERVIEW & FACULTY VISION**
[2-3 paragraphs]
- Course name and type (extract from conversation)
- What this course is trying to accomplish
- What the faculty member wants students to remember forever
- Current student struggles
- Current assessment approach and how well it aligns with their vision

**OPPORTUNITY ANALYSIS**
[2-3 paragraphs]
- Where AI could specifically help THIS course (aligned with their stated values)
- Which of their pain points are actually addressable with thoughtful AI integration
- Quick wins vs. long-term redesign possibilities
- Areas where their concerns reveal opportunities (e.g., "worried about integrity" → process-based assessment)

**CONCERN MAPPING**
[Bulleted list format for clarity]

Pedagogical/Ethical Concerns:
- [List each concern they expressed]
- [For each: What would address it? Which NextEd resources help?]

Institutional/Policy Concerns:
- [List any policy, compliance, or liability concerns]
- [How can NextEd provide cover or support?]

Practical Blockers:
- [Time, expertise, departmental culture, etc.]
- [What would overcome each?]

**READINESS ASSESSMENT**
[1-2 paragraphs]
- Current readiness level: Ready to Adopt / Cautiously Open / Institutionally Blocked / Pedagogically Opposed / Needs More Exploration
- Evidence for this assessment (specific things they said)
- What would move them to next level of readiness
- Timeline and urgency signals

**TAILORED RECOMMENDATIONS**
[2-3 paragraphs]

Best NextEd Fit:
- [Which offering: Adoption Clinic, 1:1 Consultation, Policy Board, Research Pilot]
- [Why this fits their situation]
- [What to emphasize when you reach out]

Specific Next Steps:
- [Concrete actions: "Invite to Feb Adoption Clinic cohort focused on writing courses"]
- [What resources to share: "Send examples of process-based writing assessments"]
- [Who else to connect them with: "Pair with Dr. X who has similar concerns"]

What NOT to Do:
- [Things that would backfire based on their concerns]
- [Approaches that won't resonate with this person]

**FOLLOW-UP TALKING POINTS**
[Bulleted list]
- Key quotes from their conversation that show energy or concern
- Topics they engaged deeply with
- Areas they glossed over that might need exploration
- Questions to ask in your follow-up conversation

**PEER CONNECTION OPPORTUNITIES**
[If you have multiple adoption sessions, mention potential connections]
- [Other faculty with similar courses or concerns]
- [Potential cohort groupings]
- [If this is the only session, write: "First adoption survey - no peer comparisons yet"]

FORMAT: Professional but conversational. Specific to THIS course and THIS faculty member. Honest assessment - "not ready" is valid. Actionable - clear next steps the NextEd team can actually take.

Generate the complete course report now:`;
}

function getAdoptionAnalysisPrompt(sessions) {
  return `You are analyzing responses from faculty exploring AI course redesign at St. Cloud State University. You have ${sessions.length} completed conversations.

YOUR TASK: Generate a comprehensive analysis that reveals patterns, needs, and opportunities for NextEd program development.

DATA PROVIDED:
${sessions.map((s, i) => `
SESSION ${i + 1} - ${s.participant}
SUMMARY:
${s.summary}
`).join('\n---\n')}

ANALYSIS REQUIREMENTS:

1. READINESS SEGMENTATION

Categorize faculty into:
- **Ready to Adopt**: Specific course in mind, energized, mainly need support/examples
- **Cautiously Open**: Interested but have concerns that could be addressed
- **Institutionally Blocked**: Want to try but policy/compliance concerns dominate
- **Pedagogically Opposed**: Fundamental conflict with teaching philosophy
- **Need More Exploration**: Uncertain, need to think more

For each segment: Count, disciplines, common patterns

2. CONCERN PATTERNS

**Pedagogical/Ethical Concerns:**
- Most common (academic integrity, learning quality, equity, etc.)
- How they articulate each concern
- What would address each concern (from their own words)
- Contradictions (e.g., concerned about students using AI but want to use it themselves)

**Institutional/Policy Concerns:**
- Compliance fears
- Tool restrictions  
- Data/privacy issues
- Liability worries
- Policy navigation

**Practical Blockers:**
- Time/workload
- Expertise/comfort
- Departmental culture
- Student resistance

3. PEDAGOGICAL VALUES & ASSESSMENT

What do faculty want students to "remember forever"?
- Common themes across disciplines
- How current assessment aligns (or doesn't)
- Where AI breaks current models vs. reveals misalignment

4. SUPPORT NEEDS

What would actually help:
- Concrete examples from their discipline
- Peer community
- 1:1 consultation
- Research pilot framework
- Policy advocacy/development
- Technical infrastructure (DGX)

Which is most requested? Which combinations?

5. DISCIPLINE-SPECIFIC INSIGHTS

Patterns by field:
- Which disciplines are most ready?
- Which have unique concerns?
- Where are opportunities for cross-disciplinary learning?

6. TIMELINE & URGENCY

Who's thinking:
- Next semester (urgent)
- Future semester (planning)
- Just exploring (no timeline)

7. NEXTED SERVICE MATCHING

For each NextEd offering, identify:

**Adoption Clinic** - Who's a good fit?
- Ready + specific course + timeline
- Profile of ideal first cohort

**Policy Board** - Who needs this?
- Institutional concerns dominate
- Want voice in policy development

**Research Pilot Support** - Who needs this?
- Interested but need structured framework
- Data/privacy concerns

**1:1 Consultation** - Who needs this?
- Specific questions
- Unique discipline needs

8. UNEXPECTED FINDINGS

What emerged that wouldn't show up in traditional surveys?
- Surprising patterns
- Nuanced perspectives
- Contradictions worth noting

9. ACTIONABLE RECOMMENDATIONS

For NextEd:
- Which service to prioritize first?
- What support packages to build?
- Which barriers to address immediately?
- Who to invite to what?

FORMAT: Professional analysis with clear headers, specific examples/quotes, honest assessment. Include counts and percentages where relevant.

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
  getFacultyAnalysisPrompt,
  
  // Adoption survey
  sendAdoptionMessage,
  generateAdoptionSummary,
  generateAdoptionCourseReport,
  getAdoptionAnalysisPrompt
};