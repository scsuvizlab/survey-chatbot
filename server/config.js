// Workshop context and configuration

const workshopContext = `The workshop was held in the St. Cloud State University AI and Visualization Lab (VizLab). 

We announced a new initiative called 'NextEd' launching next month, which will facilitate AI research and adoption on campus. NextEd offers three main services:

1. DGX Spark Workstations: Small, powerful Nvidia AI workstations for faculty who want to work with data or subjects that CoPilot won't touch or isn't suitable for. (Our system uses MS exclusively, so these provide alternatives.)

2. AI Policy and Advisory Board: Will work with IT staff to develop guidelines for safe, secure, and ethical AI use on campus. We're proposing a threat matrix based on the model being used, the nature of the research, and the sensitivity of the data. Solutions range from showing someone how to use CoPilot, to standing up airgapped networks where users physically access machines on-site.

3. AI Adoption Clinic: A day-long event where we're hoping to attract 6 faculty members interested in redesigning an existing course or designing a new course that leverages AI to enhance student agency and creativity.

The workshop ended with a demonstration using an LLM and Suno to create a song about Newton's 2nd Law - showing how creative applications can examine concepts from different perspectives.

We had lunch catered by Brava Burritos with a taco bar that was very well received.

Participants included AI-curious faculty, some skeptics, and a few business partners (not from MN State).`;

// Core topics with full descriptions (for system prompt)
const coreTopics = [
  "Overall workshop experience and impressions",
  "Specific content or sessions that resonated (or didn't)",
  "Thoughts on the Newton's Law song demonstration",
  "Interest in NextEd offerings (DGX workstations, Policy Board, Adoption Clinic)",
  "Concerns or reservations about AI in teaching",
  "Barriers to AI adoption in their courses or department",
  "Technical comfort level with AI tools",
  "Specific course ideas or redesign concepts",
  "What kind of support would be most helpful from NextEd",
  "Data privacy or security concerns"
];

// Shorter labels for UI display
const topicLabels = [
  "Workshop Experience",
  "Specific Content",
  "Newton Song Demo",
  "NextEd Interest",
  "AI Concerns",
  "Adoption Barriers",
  "Technical Comfort",
  "Course Ideas",
  "Support Needs",
  "Data Privacy"
];

// This greeting is sent after user submits name/email form
function getInitialGreeting(name) {
  return `Hi ${name}! Thanks for taking a few minutes to share your thoughts about the VizLab AI Workshop.

I'm a conversational feedback tool - a prototype built on Claude (Anthropic's AI model) to gather richer insights than traditional surveys. A few things to know:

• Our conversation will be saved for the NextEd team to review
• This should take 5-10 minutes, but you can elaborate as much as you'd like
• Any length answer works - detailed responses, brief thoughts, "I don't know," or "I'd rather not say" are all perfectly valid
• I can't resume conversations yet, so if you close this window you'd need to start over (but anything shared will be saved)

I'm curious to start with your overall impressions - how did today's workshop land for you? What stood out most?`;
}

module.exports = {
  workshopContext,
  coreTopics,
  topicLabels,
  getInitialGreeting
};