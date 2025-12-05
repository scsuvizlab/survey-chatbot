// Configuration for both survey types

// ============================================
// WORKSHOP FEEDBACK SURVEY
// ============================================

const workshopContext = `The workshop was held in the St. Cloud State University AI and Visualization Lab (VizLab). 

We announced a new initiative called 'NextEd' launching next month, which will facilitate AI research and adoption on campus. NextEd offers three main services:

1. DGX Spark Workstations: Small, powerful Nvidia AI workstations for faculty who want to work with data or subjects that CoPilot won't touch or isn't suitable for. (Our system uses MS exclusively, so these provide alternatives.)

2. AI Policy and Advisory Board: Will work with IT staff to develop guidelines for safe, secure, and ethical AI use on campus. We're proposing a threat matrix based on the model being used, the nature of the research, and the sensitivity of the data. Solutions range from showing someone how to use CoPilot, to standing up airgapped networks where users physically access machines on-site.

3. AI Adoption Clinic: A day-long event where we're hoping to attract 6 faculty members interested in redesigning an existing course or designing a new course that leverages AI to enhance student agency and creativity.

The workshop ended with a demonstration using an LLM and Suno to create a song about Newton's 2nd Law - showing how creative applications can examine concepts from different perspectives.

We had lunch catered by Brava Burritos with a taco bar that was very well received.

Participants included AI-curious faculty, some skeptics, and a few business partners (not from MN State).`;

const workshopTopics = [
  "Overall workshop experience and impressions",
  "Specific content or sessions that resonated (or didn't)",
  "Thoughts on the Newton's Law song demonstration",
  "Interest in NextEd offerings (DGX workstations, Policy Board, Adoption Clinic)",
  "AI concerns broadly, including: reservations about AI in teaching, barriers to adoption in their courses or department, data privacy and security concerns, environmental considerations, and what kind of support would be most helpful from NextEd",
  "Technical comfort level with AI tools",
  "Specific course ideas or redesign concepts",
  "Their experience with this conversational survey compared to traditional multiple-choice questionnaires"
];

const workshopTopicLabels = [
  "Workshop Experience",
  "Specific Content",
  "Newton Song Demo",
  "NextEd Interest",
  "AI Concerns",
  "Technical Comfort",
  "Course Ideas",
  "Survey Experience"
];

function getWorkshopGreeting(name) {
  return `Hi ${name}! Thanks for taking a few minutes to share your thoughts about the VizLab AI Workshop.

I'm a conversational feedback tool - a prototype built on Claude (Anthropic's AI model) to gather richer insights than traditional surveys. A few things to know:

• Our conversation will be saved for the NextEd team to review
• This should take 5-10 minutes, but you can elaborate as much as you'd like
• Any length answer works - detailed responses, brief thoughts, "I don't know," or "I'd rather not say" are all perfectly valid
• I can't resume conversations yet, so if you close this window you'd need to start over (but anything shared will be saved)

I'm curious to start with your overall impressions - how did today's workshop land for you? What stood out most?`;
}

// ============================================
// FACULTY AI ADOPTION SURVEY
// ============================================

const facultySurveyInfo = {
  title: "St. Cloud State Faculty AI Survey",
  description: "Understanding AI adoption, interests, and concerns across the university",
  estimated_duration: "10-12 minutes"
};

const facultySections = [
  {
    id: "ai_awareness",
    title: "AI Awareness & Current Usage",
    type: "structured_then_explore",
    presentation: "Let's start with your current experience with AI tools. I'll ask 3 quick questions:",
    questions: [
      {
        id: "tools_used",
        text: "Which AI tools have you tried? (List any, or say 'none yet')",
        format: "open_list"
      },
      {
        id: "frequency",
        text: "How often do you use AI tools?",
        format: "scale",
        options: ["Never", "Rarely (few times/year)", "Monthly", "Weekly", "Daily"]
      },
      {
        id: "use_cases",
        text: "What do you primarily use AI for? (Name any that apply, or skip if not applicable)",
        format: "open_list",
        examples: ["lesson planning", "content creation", "grading", "research", "admin tasks"]
      }
    ],
    follow_up_trigger: "if_interesting_use_case"
  },
  
  {
    id: "teaching_interest",
    title: "Interest in AI for Teaching",
    type: "structured_then_explore",
    presentation: "Now, please rate your interest in using AI for each of these teaching applications. Use a scale of 1-5, where 1 = Not interested and 5 = Very interested:",
    questions: [
      {
        id: "personalized_learning",
        text: "1. Personalized learning paths for students",
        format: "rating_1_5"
      },
      {
        id: "automated_feedback",
        text: "2. Automated grading or feedback on assignments",
        format: "rating_1_5"
      },
      {
        id: "content_generation",
        text: "3. Generating course materials and examples",
        format: "rating_1_5"
      },
      {
        id: "student_tutor",
        text: "4. AI as a 24/7 student tutor or teaching assistant",
        format: "rating_1_5"
      },
      {
        id: "assessment_design",
        text: "5. Designing AI-aware assessments",
        format: "rating_1_5"
      }
    ],
    deep_dive_trigger: "any_rating >= 4",
    deep_dive_question: "You rated [ITEM] highly. Can you tell me more about how you'd want to use that?"
  },
  
  {
    id: "concerns",
    title: "Concerns & Barriers",
    type: "structured_then_explore",
    presentation: "For the next 6 statements about AI, please answer True or False. You can also answer 'It depends', 'Not sure', or elaborate if you want:",
    questions: [
      {
        id: "student_misuse",
        text: "1. I'm concerned about students using AI to cheat or plagiarize",
        format: "true_false",
        complexity_triggers: ["depends", "complicated", "sometimes", "but"]
      },
      {
        id: "data_privacy",
        text: "2. I'm worried about student data privacy with AI tools",
        format: "true_false",
        complexity_triggers: ["depends", "not sure", "some tools", "which"]
      },
      {
        id: "quality",
        text: "3. I question the quality or accuracy of AI-generated content",
        format: "true_false",
        complexity_triggers: ["depends", "varies", "sometimes"]
      },
      {
        id: "workload",
        text: "4. I think learning AI tools will increase my workload",
        format: "true_false",
        complexity_triggers: ["depends", "short term", "initially"]
      },
      {
        id: "job_security",
        text: "5. I'm concerned about AI replacing aspects of my job",
        format: "true_false",
        complexity_triggers: ["depends", "some aspects", "certain"]
      },
      {
        id: "equity",
        text: "6. I worry about equity issues with AI adoption",
        format: "true_false",
        complexity_triggers: ["depends", "complicated", "yes and no"]
      }
    ],
    deep_dive_trigger: "any_complexity_detected",
    deep_dive_max: 3
  },
  
  {
    id: "support_needs",
    title: "Support Needs",
    type: "structured_then_explore",
    presentation: "What would help you most in adopting AI? Please rank your top 3 needs from this list:",
    questions: [
      {
        id: "support_ranking",
        text: "Training workshops, One-on-one consultation, Example lesson plans/syllabi, Technical setup help, Peer learning community, Policy/guidelines clarity, Release time to experiment, Access to better tools",
        format: "ranking_top_3"
      }
    ],
    follow_up_question: "Why did you choose those three as priorities?"
  },
  
  {
    id: "nexted_interest",
    title: "NextEd Services",
    type: "structured_then_explore",
    context: "NextEd is a new initiative launching at SCSU to support AI adoption. It offers three services:\n\n• DGX Spark Workstations: Small, powerful AI workstations for working with sensitive data locally (alternative to cloud tools like CoPilot)\n• AI Policy & Advisory Board: Help develop safe, ethical AI use guidelines\n• Adoption Clinic: Intensive support for redesigning one of your courses with AI",
    presentation: "Please rate your interest in each service (1-5):",
    questions: [
      {
        id: "dgx_interest",
        text: "1. DGX Spark Workstations",
        format: "rating_1_5",
        follow_up_if: ">= 4",
        follow_up_question: "What would you use them for?"
      },
      {
        id: "policy_interest",
        text: "2. AI Policy & Advisory Board",
        format: "rating_1_5",
        follow_up_if: ">= 4",
        follow_up_question: "What policy areas matter most to you?"
      },
      {
        id: "clinic_interest",
        text: "3. Adoption Clinic",
        format: "rating_1_5",
        follow_up_if: ">= 4",
        follow_up_question: "Which course would you want to redesign?"
      }
    ]
  },
  
  {
    id: "demographics",
    title: "Background Information",
    type: "structured_only",
    presentation: "Finally, a few quick background questions:",
    questions: [
      {
        id: "comfort_level",
        text: "1. How would you describe your comfort with AI tools?",
        format: "scale",
        options: ["Novice", "Beginner", "Intermediate", "Advanced", "Expert"]
      },
      {
        id: "department",
        text: "2. What department or college are you in?",
        format: "open_text"
      },
      {
        id: "years_teaching",
        text: "3. How many years have you been teaching?",
        format: "open_text"
      },
      {
        id: "survey_feedback",
        text: "4. How was this conversational survey compared to traditional multiple-choice forms?",
        format: "scale",
        options: ["Much worse", "Worse", "About the same", "Better", "Much better"]
      }
    ]
  }
];

function getFacultyGreeting(name) {
  return `Hi ${name}! Thanks for taking time to share your thoughts about AI in teaching.

This is a hybrid survey - I'll ask you questions one at a time, and when your answers indicate complexity or high interest, I'll ask follow-up questions to understand better.

The survey has 6 sections and typically takes 10-30 minutes depending on how much detail you want to provide. You're in control - you can keep responses brief or elaborate as much as you'd like.

Let's start with your current experience with AI tools.

Which AI tools have you tried? (List any, or say 'none yet')`;
}

module.exports = {
  // Workshop feedback
  workshopContext,
  workshopTopics,
  workshopTopicLabels,
  getWorkshopGreeting,
  
  // Faculty survey
  facultySurveyInfo,
  facultySections,
  getFacultyGreeting
};
