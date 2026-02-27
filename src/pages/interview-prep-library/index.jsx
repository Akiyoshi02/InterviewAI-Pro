import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import Header from '../../components/ui/Header';
import UserContextNavigation from '../../components/ui/UserContextNavigation';
import MaintenanceBanner from '../../components/ui/MaintenanceBanner';
import Icon from '../../components/AppIcon';
import Button from '../../components/ui/Button';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { useMaintenanceMode } from '../../hooks/useMaintenanceMode';

// ── Question Bank Data ──────────────────────────────────────────────────────

const QUESTION_BANK = [
  // Behavioral
  { id: 'b1', category: 'Behavioral', type: 'STAR', difficulty: 'medium', role: 'General', question: 'Tell me about a time you had to meet a tight deadline.', guidance: 'Describe a specific project. Highlight your planning, prioritisation, and what you delivered.' },
  { id: 'b2', category: 'Behavioral', type: 'STAR', difficulty: 'medium', role: 'General', question: 'Describe a situation where you had to work with a difficult colleague.', guidance: 'Focus on professionalism, communication, and the positive outcome.' },
  { id: 'b3', category: 'Behavioral', type: 'STAR', difficulty: 'hard', role: 'Leadership', question: 'Tell me about a time you led a team through a significant change.', guidance: 'Show empathy, clear communication, and measurable results.' },
  { id: 'b4', category: 'Behavioral', type: 'STAR', difficulty: 'easy', role: 'General', question: 'Describe a time you received critical feedback. How did you respond?', guidance: 'Show self-awareness and growth mindset.' },
  { id: 'b5', category: 'Behavioral', type: 'STAR', difficulty: 'medium', role: 'General', question: 'Tell me about a project where you took the initiative.', guidance: 'Quantify the impact wherever possible.' },
  // Situational
  { id: 's1', category: 'Situational', type: 'Hypothetical', difficulty: 'medium', role: 'General', question: 'If you discovered a critical bug just before a major release, what would you do?', guidance: 'Show risk assessment, stakeholder communication, and decision making.' },
  { id: 's2', category: 'Situational', type: 'Hypothetical', difficulty: 'hard', role: 'Leadership', question: 'How would you handle a high-performing team member who is consistently missing deadlines?', guidance: 'Balance empathy with accountability. Focus on root cause and solutions.' },
  { id: 's3', category: 'Situational', type: 'Hypothetical', difficulty: 'easy', role: 'General', question: 'You are given three urgent tasks at the same time. How do you prioritise?', guidance: 'Use a framework: impact, urgency, dependencies.' },
  // Technical
  { id: 't1', category: 'Technical', type: 'Conceptual', difficulty: 'medium', role: 'Software Engineer', question: 'Explain the difference between REST and GraphQL APIs.', guidance: 'Cover flexibility, over-fetching, under-fetching, and when to use each.' },
  { id: 't2', category: 'Technical', type: 'Conceptual', difficulty: 'hard', role: 'Software Engineer', question: 'How would you design a URL shortening service?', guidance: 'Discuss hashing, storage, redirect mechanics, and scalability.' },
  { id: 't3', category: 'Technical', type: 'Conceptual', difficulty: 'medium', role: 'Data Analyst', question: 'How do you handle missing data in a dataset?', guidance: 'Discuss imputation, deletion, or flagging strategies.' },
  // Motivation
  { id: 'm1', category: 'Motivation', type: 'Open', difficulty: 'easy', role: 'General', question: 'Why do you want to work here?', guidance: 'Show research about the company, align with their mission, and link to your career goals.' },
  { id: 'm2', category: 'Motivation', type: 'Open', difficulty: 'easy', role: 'General', question: 'Where do you see yourself in five years?', guidance: 'Be ambitious but realistic. Show growth mindset and commitment.' },
  { id: 'm3', category: 'Motivation', type: 'Open', difficulty: 'medium', role: 'General', question: 'What is your greatest professional achievement?', guidance: 'Quantify results and connect to the role you are applying for.' },
];

const GUIDES = [
  {
    id: 'g1',
    title: 'Mastering the STAR Method',
    category: 'Technique',
    readTime: '8 min',
    icon: 'Star',
    content: `The STAR method is a structured way to answer behavioural interview questions.

**Situation** – Set the scene. Briefly describe the context. Keep it specific and concise.
*Example: "I was a junior developer on a team of 5 working on a financial platform with a two-week sprint deadline."*

**Task** – Explain your responsibility. What were you expected to do?
*Example: "I was tasked with redesigning the payment flow after usability tests revealed a 40% drop-off rate."*

**Action** – Describe what YOU did. Use "I" not "we". Be specific.
*Example: "I interviewed five users, created three wireframe variants, ran A/B tests over one week, and shipped the winning design."*

**Result** – Share the outcome. Quantify whenever possible.
*Example: "Drop-off rate fell from 40% to 12%, and transaction volume increased by $200K in the first month."*

**Tips:**
- Prepare 8–10 STAR stories that cover different competencies.
- Adapt the same story for different questions by adjusting the emphasis.
- Keep the Situation and Task brief (~20%) and expand on Action and Result (~80%).`,
  },
  {
    id: 'g2',
    title: 'How to Research a Company Before Your Interview',
    category: 'Preparation',
    readTime: '6 min',
    icon: 'Search',
    content: `Thorough company research sets you apart and helps you tailor every answer.

**1. Mission, Vision & Values**
Read the About page, annual reports, and LinkedIn company page. Understand the "why" behind the business.

**2. Recent News**
Check Google News, TechCrunch, or industry publications for the last 6 months. Mention a recent launch or initiative to show genuine interest.

**3. Products & Services**
Try the product if possible. Understand the ICP (ideal customer profile) and key differentiators.

**4. Financial Health** (for public companies)
Glance at recent earnings calls or investor relations pages. Know their growth trajectory.

**5. Culture & Team**
Read Glassdoor reviews and LinkedIn profiles of interviewers. Understand leadership style.

**6. Questions to Ask**
Prepare 4–5 thoughtful questions. "What does success look like in the first 90 days?" shows strategic thinking.`,
  },
  {
    id: 'g3',
    title: 'Answering "Tell Me About Yourself"',
    category: 'Technique',
    readTime: '5 min',
    icon: 'User',
    content: `This is almost always the first question. It sets the tone for the entire interview.

**Structure: Present – Past – Future**
1. **Present** – Your current role and key achievements (2–3 sentences).
2. **Past** – Relevant experience that led you here (1–2 sentences).
3. **Future** – Why this role and company excite you (1–2 sentences).

**Example Answer (Software Engineer):**
"I'm currently a full-stack engineer at FinTech Startup where I've led the redesign of our customer portal, cutting load time by 60% and improving NPS by 15 points. Before that, I spent three years at an agency working across healthcare and retail clients, which gave me broad experience with React, Node.js, and scaling APIs. I'm looking for a product-focused engineering role where I can take ownership of features end-to-end — which is exactly what drew me to your platform."

**Common Mistakes:**
- Reading your CV chronologically (boring).
- Being too vague ("I'm a hard worker").
- Forgetting to connect to the role.

**Keep it to 90 seconds.** Practice until it sounds natural, not rehearsed.`,
  },
  {
    id: 'g4',
    title: 'Technical Interview Preparation Guide',
    category: 'Technical',
    readTime: '12 min',
    icon: 'Code2',
    content: `Technical interviews test problem-solving, communication, and coding ability.

**Data Structures to Review:**
- Arrays, Strings, Hash Maps
- Stacks, Queues, Linked Lists
- Trees (Binary Tree, BST, Trie)
- Graphs (BFS, DFS)
- Heaps / Priority Queues

**Algorithm Patterns:**
- Sliding Window
- Two Pointers
- Fast & Slow Pointers
- BFS / DFS
- Dynamic Programming
- Backtracking

**Interview Day Strategy:**
1. **Clarify** – Ask about edge cases and constraints before coding.
2. **Plan** – Talk through your approach before writing code.
3. **Code** – Write clean, readable code with variable names that explain intent.
4. **Test** – Walk through your solution with examples, including edge cases.
5. **Optimise** – Discuss time/space complexity and possible improvements.

**Communication is key.** Interviewers want to understand how you think. Narrate your thought process throughout.

**Resources:**
- LeetCode (Blind 75 list)
- NeetCode.io
- "Cracking the Coding Interview" by G. McDowell`,
  },
  {
    id: 'g5',
    title: 'Salary Negotiation Playbook',
    category: 'Career',
    readTime: '7 min',
    icon: 'DollarSign',
    content: `Salary negotiation is a skill. Most candidates leave money on the table by not negotiating.

**Golden Rule: Let them make the first offer.**
Avoid anchoring too low. If pressed, give a wide range based on market research.

**Research Market Rate:**
- Glassdoor, LinkedIn Salary, Levels.fyi (for tech)
- Factor in location, company stage, and your experience level.

**The Negotiation Script:**
After receiving an offer: "Thank you so much — I'm genuinely excited about this role. Based on my research and the scope of what we discussed, I was expecting something closer to £X. Is there any flexibility there?"

**What Else is Negotiable:**
- Signing bonus
- Equity / stock options
- Remote work days
- Annual leave
- Professional development budget
- Start date

**Key Mindset:** You are not being greedy. You are a professional who understands market value. Employers expect negotiation.

**Don't:**
- Reveal your current salary first.
- Accept immediately without taking time to review.
- Make ultimatums unless you mean them.`,
  },
];

// ── STAR Builder ──────────────────────────────────────────────────────────

const STAR_FIELDS = [
  { key: 'question', label: 'Question', placeholder: 'Paste the interview question here…', rows: 2 },
  { key: 'situation', label: 'S – Situation', placeholder: 'Set the scene briefly. When? Where? Who was involved?', rows: 3 },
  { key: 'task', label: 'T – Task', placeholder: 'What was your specific responsibility?', rows: 3 },
  { key: 'action', label: 'A – Action', placeholder: 'What did YOU do? Be specific and use "I" language.', rows: 5 },
  { key: 'result', label: 'R – Result', placeholder: 'What was the outcome? Quantify where possible.', rows: 3 },
];

const EMPTY_STAR = { question: '', situation: '', task: '', action: '', result: '' };

// ── Main Component ──────────────────────────────────────────────────────────

const TABS = [
  { id: 'questions', label: 'Question Bank', icon: 'HelpCircle' },
  { id: 'guides', label: 'Guides', icon: 'BookOpen' },
  { id: 'star', label: 'STAR Builder', icon: 'Star' },
];

const CATEGORIES = ['All', 'Behavioral', 'Situational', 'Technical', 'Motivation'];
const DIFFICULTIES = ['All', 'easy', 'medium', 'hard'];

const InterviewPrepLibraryPage = () => {
  const { user, logout } = useAuth();
  const { maintenanceMode } = useMaintenanceMode();
  const navigate = useNavigate();
  const [isNavCollapsed, setIsNavCollapsed] = useState(false);

  const [activeTab, setActiveTab] = useState('questions');

  // Question bank filters
  const [catFilter, setCatFilter] = useState('All');
  const [diffFilter, setDiffFilter] = useState('All');
  const [qSearch, setQSearch] = useState('');
  const [expandedQ, setExpandedQ] = useState(null);

  // Guide state
  const [selectedGuide, setSelectedGuide] = useState(null);

  // STAR builder state
  const [star, setStar] = useState(EMPTY_STAR);
  const [starSaved, setStarSaved] = useState(() => {
    try { return JSON.parse(localStorage.getItem('star_answers') || '[]'); } catch { return []; }
  });
  const [saveMsg, setSaveMsg] = useState(null);

  const userType = 'candidate';

  const filteredQuestions = useMemo(() => {
    return QUESTION_BANK.filter((q) => {
      if (catFilter !== 'All' && q.category !== catFilter) return false;
      if (diffFilter !== 'All' && q.difficulty !== diffFilter) return false;
      if (qSearch && !q.question.toLowerCase().includes(qSearch.toLowerCase())) return false;
      return true;
    });
  }, [catFilter, diffFilter, qSearch]);

  const saveStar = () => {
    if (!star.situation && !star.action) return;
    const entry = { ...star, savedAt: new Date().toISOString(), id: Date.now() };
    const updated = [entry, ...starSaved].slice(0, 20);
    setStarSaved(updated);
    localStorage.setItem('star_answers', JSON.stringify(updated));
    setSaveMsg('STAR answer saved!');
    setTimeout(() => setSaveMsg(null), 2000);
  };

  const clearStar = () => setStar(EMPTY_STAR);

  const loadStar = (entry) => setStar(entry);

  const deleteStar = (id) => {
    const updated = starSaved.filter((s) => s.id !== id);
    setStarSaved(updated);
    localStorage.setItem('star_answers', JSON.stringify(updated));
  };

  const diffColor = (d) =>
    d === 'easy' ? 'text-green-600 bg-green-100 dark:bg-green-900/30 dark:text-green-400'
    : d === 'medium' ? 'text-amber-600 bg-amber-100 dark:bg-amber-900/30 dark:text-amber-400'
    : 'text-red-600 bg-red-100 dark:bg-red-900/30 dark:text-red-400';

  return (
    <div className="dashboard-shell">
      <Header userType={userType} isAuthenticated onLogout={async () => { await logout(); navigate('/login'); }} />
      {maintenanceMode && <MaintenanceBanner />}
      <div className="h-14 xs:h-16" />
      <div className="relative z-10 flex flex-col lg:flex-row">
        <UserContextNavigation userType={userType} isCollapsed={isNavCollapsed} onToggleCollapse={() => setIsNavCollapsed(!isNavCollapsed)} />
        <main className={`flex-1 transition-all duration-300 pb-20 lg:pb-0 ${isNavCollapsed ? 'lg:ml-20' : 'lg:ml-72 xl:ml-80'}`}>
          <div className="container-responsive py-6 xs:py-8 sm:py-10 space-y-6">
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
              <h1 className="text-xl font-bold text-gray-900 dark:text-slate-100">Interview Prep Library</h1>
              <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
                Guides, question banks, and a STAR answer builder to help you prepare.
              </p>
            </motion.div>

            {/* Tabs */}
            <div className="flex gap-1 bg-gray-100 dark:bg-slate-800 rounded-xl p-1">
              {TABS.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                    activeTab === tab.id
                      ? 'bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 shadow'
                      : 'text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-300'
                  }`}
                >
                  <Icon name={tab.icon} size={14} />
                  <span className="hidden sm:inline">{tab.label}</span>
                </button>
              ))}
            </div>

            {/* ── Question Bank ── */}
            {activeTab === 'questions' && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
                {/* Filters */}
                <div className="flex flex-wrap gap-2">
                  <input
                    type="text"
                    value={qSearch}
                    onChange={(e) => setQSearch(e.target.value)}
                    placeholder="Search questions…"
                    className="flex-1 min-w-[160px] text-sm rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <select
                    value={catFilter}
                    onChange={(e) => setCatFilter(e.target.value)}
                    className="text-sm rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                  </select>
                  <select
                    value={diffFilter}
                    onChange={(e) => setDiffFilter(e.target.value)}
                    className="text-sm rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {DIFFICULTIES.map((d) => <option key={d} value={d}>{d === 'All' ? 'All levels' : d.charAt(0).toUpperCase() + d.slice(1)}</option>)}
                  </select>
                </div>

                <p className="text-xs text-gray-500 dark:text-slate-400">{filteredQuestions.length} questions</p>

                <div className="space-y-2">
                  {filteredQuestions.map((q) => (
                    <div key={q.id} className="rounded-xl border border-white/40 dark:border-slate-700/50 bg-white/80 dark:bg-slate-800/80 shadow overflow-hidden">
                      <button
                        onClick={() => setExpandedQ(expandedQ === q.id ? null : q.id)}
                        className="w-full flex items-start gap-3 p-4 text-left hover:bg-gray-50/50 dark:hover:bg-slate-700/30 transition-colors"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                            <span className="text-xs text-gray-500 dark:text-slate-400">{q.category}</span>
                            <span className="text-xs text-gray-400">·</span>
                            <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${diffColor(q.difficulty)}`}>
                              {q.difficulty}
                            </span>
                            {q.type !== 'General' && (
                              <span className="text-xs text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 px-2 py-0.5 rounded-full">{q.type}</span>
                            )}
                          </div>
                          <p className="text-sm font-medium text-gray-900 dark:text-slate-100">{q.question}</p>
                        </div>
                        <Icon name={expandedQ === q.id ? 'ChevronUp' : 'ChevronDown'} size={16} className="text-gray-400 mt-0.5 shrink-0" />
                      </button>

                      <AnimatePresence>
                        {expandedQ === q.id && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="overflow-hidden"
                          >
                            <div className="px-4 pb-4 space-y-3">
                              <div className="rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800/50 p-3">
                                <p className="text-xs font-medium text-blue-700 dark:text-blue-300 mb-1 flex items-center gap-1.5">
                                  <Icon name="Lightbulb" size={13} />
                                  How to approach this
                                </p>
                                <p className="text-xs text-blue-700 dark:text-blue-300">{q.guidance}</p>
                              </div>
                              <Button
                                size="sm"
                                variant="outline"
                                iconName="Star"
                                onClick={() => {
                                  setStar((p) => ({ ...p, question: q.question }));
                                  setActiveTab('star');
                                }}
                              >
                                Build STAR answer
                              </Button>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {/* ── Guides ── */}
            {activeTab === 'guides' && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
                {selectedGuide ? (
                  <div className="space-y-4">
                    <Button
                      variant="ghost"
                      size="sm"
                      iconName="ArrowLeft"
                      onClick={() => setSelectedGuide(null)}
                    >
                      Back to guides
                    </Button>
                    <div className="rounded-2xl border border-white/40 dark:border-slate-700/50 bg-white/80 dark:bg-slate-800/80 shadow-lg p-6">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                          <Icon name={selectedGuide.icon} size={20} className="text-blue-600 dark:text-blue-400" />
                        </div>
                        <div>
                          <h2 className="text-base font-bold text-gray-900 dark:text-slate-100">{selectedGuide.title}</h2>
                          <p className="text-xs text-gray-500 dark:text-slate-400">{selectedGuide.category} · {selectedGuide.readTime} read</p>
                        </div>
                      </div>
                      <div className="prose prose-sm dark:prose-invert max-w-none text-sm text-gray-700 dark:text-slate-300 leading-relaxed whitespace-pre-line">
                        {selectedGuide.content}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {GUIDES.map((guide) => (
                      <button
                        key={guide.id}
                        onClick={() => setSelectedGuide(guide)}
                        className="rounded-2xl border border-white/40 dark:border-slate-700/50 bg-white/80 dark:bg-slate-800/80 shadow hover:shadow-md transition-all hover:-translate-y-0.5 p-4 text-left space-y-3"
                      >
                        <div className="flex items-start gap-3">
                          <div className="w-9 h-9 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center shrink-0">
                            <Icon name={guide.icon} size={17} className="text-blue-600 dark:text-blue-400" />
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-gray-900 dark:text-slate-100">{guide.title}</p>
                            <p className="text-xs text-gray-500 dark:text-slate-400">{guide.category} · {guide.readTime}</p>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </motion.div>
            )}

            {/* ── STAR Builder ── */}
            {activeTab === 'star' && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
                <div className="rounded-2xl border border-white/40 dark:border-slate-700/50 bg-white/80 dark:bg-slate-800/80 shadow-lg p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-sm font-semibold text-gray-900 dark:text-slate-100 flex items-center gap-2">
                      <Icon name="Star" size={15} className="text-yellow-500" />
                      STAR Answer Builder
                    </h2>
                    <Button variant="ghost" size="sm" onClick={clearStar}>Clear</Button>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-slate-400">
                    Structure your behavioural interview answers using the Situation–Task–Action–Result framework.
                  </p>

                  {STAR_FIELDS.map(({ key, label, placeholder, rows }) => (
                    <div key={key} className="space-y-1">
                      <label className="text-xs font-semibold text-gray-700 dark:text-slate-300">{label}</label>
                      <textarea
                        value={star[key]}
                        rows={rows}
                        onChange={(e) => setStar((p) => ({ ...p, [key]: e.target.value }))}
                        placeholder={placeholder}
                        className="w-full text-sm rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                      />
                    </div>
                  ))}

                  <div className="flex gap-2 items-center flex-wrap">
                    <Button onClick={saveStar} iconName="Save" size="sm">Save answer</Button>
                    {saveMsg && <span className="text-xs text-green-600">{saveMsg}</span>}
                  </div>
                </div>

                {/* Saved answers */}
                {starSaved.length > 0 && (
                  <div className="space-y-3">
                    <h3 className="text-sm font-semibold text-gray-700 dark:text-slate-300">Saved Answers ({starSaved.length})</h3>
                    {starSaved.map((entry) => (
                      <div key={entry.id} className="rounded-xl border border-white/40 dark:border-slate-700/50 bg-white/80 dark:bg-slate-800/80 shadow p-4 space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-medium text-gray-800 dark:text-slate-200 line-clamp-2">
                            {entry.question || entry.situation?.slice(0, 80) || 'Untitled'}
                          </p>
                          <div className="flex gap-1 shrink-0">
                            <button
                              onClick={() => loadStar(entry)}
                              className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                            >
                              Load
                            </button>
                            <span className="text-gray-300">·</span>
                            <button
                              onClick={() => deleteStar(entry.id)}
                              className="text-xs text-red-500 hover:underline"
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                        <p className="text-xs text-gray-500 dark:text-slate-400">
                          Saved {new Date(entry.savedAt).toLocaleDateString()}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </motion.div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
};

export default InterviewPrepLibraryPage;
