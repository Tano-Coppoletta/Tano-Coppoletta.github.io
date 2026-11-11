// All site content lives here. Copy follows the Claude Design file "Portfolio.dc.html".
// Fields ending in `Italic` are set in Instrument Serif italic after the plain text.

export const person = {
  name: 'Gaetano Coppoletta',
  email: 'tano.coppoletta@gmail.com',
  linkedin: 'https://www.linkedin.com/in/gaetano-coppoletta/',
  resume: '/Gaetano_Coppoletta_Resume.pdf',
  description:
    'Software engineer at Oracle building AI-powered security workflows for ~2,000 engineers. Previously co-founded GorgeousTV and published security research at NDSS.',
  headline: 'Software engineer turning complex systems into',
  headlineItalic: 'products people use.',
  intro:
    'Tech lead at Oracle, building AI‑powered security workflows for ~2,000 engineers. Previously co‑founded GorgeousTV and published security research at NDSS.',
};

// Route under the hero, in order. The last entry is where I am now.
export const route = ['Sicily', 'Turin', 'Chicago', 'New York', 'Los Angeles', 'San Francisco'];

export const stats = [
  { value: '~1,600 h', label: 'saved per month across Oracle security teams' },
  { value: '1,000+', label: 'active users in two months at GorgeousTV' },
  { value: '6 CVEs', label: 'discovered in EV‑charging software' },
  { value: '3×', label: 'Oracle Spotlight Awards for high-impact delivery' },
];

export const paper = 'https://www.ndss-symposium.org/wp-content/uploads/vehiclesec2024-69-paper.pdf';

// `visual` picks the illustration in src/components/ProjectVisual.astro.
export const work = [
  {
    visual: 'oracle',
    meta: 'Oracle · Tech lead · 2025 —',
    title: 'An AI‑assisted vulnerability platform for 2,000 engineers',
    text: 'Built vulnerability intake and advisory-review workflows that consolidate researcher reports and patch data. LLM-agent workflows collect reports and attachments, generate technical summaries and initial severity assessments, and route each issue through a tailored path. AI validation of patch data automates ~95% of cases, with human review for ambiguous ones.',
    outcomes: [
      { value: '1.5M+', label: 'customers reached monthly by advisories' },
      { value: 'Quarterly → monthly', label: 'security release cadence' },
    ],
    tags: ['Node.js', 'Python', 'LLM agents', 'OCI', 'TypeScript'],
  },
  {
    visual: 'ads',
    meta: 'GorgeousTV · Co‑founder & CPO · 2023–25',
    title: 'Contextual AI advertising, from zero to 1,000 users',
    text: 'Owned product and full‑stack engineering. Embedding pipelines on GCP Dataflow + Pinecone matched ads to what’s on screen. SQS handled video processing in the background; Redis caching kept APIs at ~0.5s.',
    tags: ['Python', 'Node.js', 'Embeddings', 'GCP', 'TypeScript'],
  },
  {
    visual: 'fuzz',
    meta: 'UIC Security Lab · Research · 2023',
    title: 'OCPPStorm: fuzzing the software behind EV chargers',
    text: 'A language‑agnostic black‑box fuzzer with random, state‑machine and grammar‑based modules. Found six CVEs; first‑author paper at NDSS 2024.',
    link: { label: 'Read the paper', href: paper },
    tags: ['Python', 'Fuzzing', 'NDSS ’24'],
  },
];

export const experience = [
  {
    role: 'Software Engineer · Tech Lead',
    company: 'Oracle',
    place: 'San Francisco',
    dates: '2025 — Now',
    bullets: [
      'Technical lead for a full-stack Node.js enterprise product: requirements, architecture, cross-team rollout and mentoring.',
      'Built vulnerability intake and advisory-review workflows used by ~2,000 engineers, saving ~1,600 person-hours monthly.',
      'Designed LLM-agent workflows that summarize reports, propose severity and route issues through tailored paths.',
      'AI validation of patch data against historical records automates ~95% of cases, with human review for the rest.',
      'Helped move security releases from quarterly to monthly. Three Spotlight Awards.',
    ],
  },
  {
    role: 'Technical Co-Founder & CPO',
    company: 'GorgeousTV',
    place: 'Los Angeles',
    dates: '2023 — 2025',
    bullets: [
      'Owned 0-to-1 product and full-stack engineering for an AI advertising platform; 1,000+ active users in two months.',
      'GCP Dataflow pipelines for image embeddings in Pinecone, combined with text filters to select contextual ads.',
      'SQS for async video processing and Redis caching — ~0.5s average API response.',
      'Automated GCP deployments, cutting deploy time by 50%+.',
    ],
  },
  {
    role: 'Research Assistant',
    company: 'UIC Systems & Internet Security Lab',
    place: 'Chicago',
    dates: '2023',
    bullets: [
      'Built OCPPStorm, a language-agnostic black-box fuzzing platform tested against Java and .NET OCPP implementations.',
      'Discovered six CVEs in EV-charging software; first-author paper at NDSS 2024.',
    ],
  },
  {
    role: 'Software Engineering Intern',
    company: 'Feedback Italia',
    place: 'Turin',
    dates: '2021',
    bullets: [
      'Added 50+ automated Android UI tests (UI Automator, Espresso), cutting manual testing from three days to under an hour.',
    ],
  },
];

export const community = {
  meta: 'Founder · San Francisco chapter',
  title: 'Italian Tech',
  titleItalic: 'Club',
  text: 'I founded the San Francisco chapter of Italian Tech Club, a non‑profit community for Italians working in tech — meetups, introductions and a place to land when you move to the Bay Area.',
  value: '200',
  label: 'members in the first year',
};

// The about paragraph is split around the one italic word.
export const about = {
  before:
    'I grew up in Italy, studied computer engineering in Turin, and moved to Chicago for a second master’s. I like the part of engineering where a messy workflow becomes a',
  italic: 'simple',
  after: 'product — and I care as much about who uses it as how it’s built.',
};

export const education = [
  { degree: 'M.S. Computer Science', school: 'University of Illinois Chicago · GPA 4.0' },
  { degree: 'M.S. Computer Engineering', school: 'Politecnico di Torino · 110/110' },
  { degree: 'B.S. Computer Engineering', school: 'Politecnico di Torino' },
];

export const publication = {
  title: 'OCPPStorm: A Comprehensive Fuzzing Tool for OCPP Implementations',
  meta: 'First author · NDSS Symposium, Feb 2024',
  href: paper,
};

export const cves = {
  ids: [
    'CVE-2024-25407',
    'CVE-2023-52096',
    'CVE-2023-49958',
    'CVE-2023-49957',
    'CVE-2023-49956',
    'CVE-2023-49955',
  ],
  note: 'Found with OCPPStorm in STEVE and OCPP.Core; all fixed by maintainers.',
};

export const toolkit = [
  { group: 'Full stack', items: 'TypeScript, React, Node.js, Python, Java, SQL' },
  { group: 'AI & data', items: 'LLM agents, MCP, embeddings, Pinecone, Dataflow' },
  { group: 'Cloud', items: 'GCP, OCI, AWS, Kubernetes, Redis, CI/CD' },
  { group: 'Leadership', items: 'Product ownership, technical direction, mentoring' },
];
