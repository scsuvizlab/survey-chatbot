// Configuration for C3 (Creative Curriculum Chatbot)

const c3Info = {
  title: "Creative Curriculum Chatbot (C3)",
  description: "Exploring creative applications of AI in teaching across all disciplines",
  estimated_duration: "15-20 minutes",
  remove_timer: false,
  remove_progress: true
};

// Core topics the bot explores (not shown to users unless they ask)
const c3Topics = [
  {
    id: "course_specifics",
    label: "Course Details & Context",
    keywords: ["course", "class", "students", "level", "department", "enrollment", "format"],
    description: "Which specific course they're thinking about and its context"
  },
  {
    id: "adoption_motivation",
    label: "Why AI, Why Now",
    keywords: ["why", "prompted", "interested", "motivation", "considering", "exploring"],
    description: "What prompted them to explore AI for this course"
  },
  {
    id: "barriers_challenges",
    label: "Barriers & Challenges",
    keywords: ["concern", "worry", "barrier", "obstacle", "challenge", "afraid", "problem", "difficult"],
    description: "Specific concerns about AI adoption - pedagogical, institutional, technical, student-related"
  },
  {
    id: "core_values",
    label: "Core Learning Goals",
    keywords: ["remember forever", "most important", "core learning", "essential", "fundamental", "takeaway"],
    description: "What they want students to remember forever from this course"
  },
  {
    id: "student_agency",
    label: "Student Agency & Creativity",
    keywords: ["choice", "agency", "creative", "voice", "meaningful decisions", "ownership", "authentic"],
    description: "Where students currently exercise creativity, choice, or authentic voice"
  },
  {
    id: "exceptional_moments",
    label: "Exceptional Student Work",
    keywords: ["exceptional", "stood out", "beyond", "excellent", "memorable", "impressed"],
    description: "Examples of when students went beyond the assignment"
  },
  {
    id: "ai_possibilities",
    label: "AI as Creative Amplifier",
    keywords: ["possibilities", "enhance", "amplify", "enable", "make possible", "potential"],
    description: "Where they see AI potentially amplifying student creativity"
  },
  {
    id: "next_steps",
    label: "Path Forward",
    keywords: ["support", "need", "help", "try", "experiment", "pilot", "resources"],
    description: "What they'd need to feel safe exploring creative AI applications"
  }
];

function getC3Greeting(name) {
  return `Hi ${name}! Thanks for taking time to explore creative applications of AI in teaching.

I'm here to think alongside you about where AI might fit (or not fit) in your course - not to prescribe solutions, but to help you work through the questions.

A few things to know:

• This conversation usually takes 15-20 minutes
• There are no right or wrong answers - complexity and uncertainty are welcome
• You can pause anytime and pick up where you left off later
• I'll check in every 10 minutes to see how you're doing

Let's start with something concrete: Which specific course are you thinking about redesigning or exploring with AI?`;
}

module.exports = {
  c3Info,
  c3Topics,
  getC3Greeting
};