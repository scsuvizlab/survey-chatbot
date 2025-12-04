const Anthropic = require('@anthropic-ai/sdk');
const config = require('./config');

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Build system prompt with workshop context
function buildSystemPrompt() {
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
${config.coreTopics.map((topic, i) => `${i + 1}. ${topic}`).join('\n')}

IMPORTANT: Topic #8 asks about their experience with THIS CONVERSATIONAL SURVEY compared to traditional multiple-choice questionnaires. Make sure to ask this before wrapping up!

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

// Send message to Claude
async function sendMessage(conversationHistory, userMessage) {
  const messages = [
    ...conversationHistory,
    { role: 'user', content: userMessage }
  ];
  
  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2000,
    system: buildSystemPrompt(),
    messages: messages
  });
  
  return response.content[0].text;
}

// Generate summary of conversation
async function generateSummary(conversationHistory) {
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

module.exports = {
  sendMessage,
  generateSummary
};