// All site content lives here. Edit this file to update the page.
// Strings in `points` and `summary` may contain <b> tags for emphasis.

export const person = {
  name: 'Gaetano Coppoletta',
  role: 'Software Engineer at Oracle, building AI-powered security tools',
  location: 'San Francisco, CA',
  email: 'tano.coppoletta@gmail.com',
  linkedin: 'https://www.linkedin.com/in/gaetano-coppoletta/',
  github: 'https://github.com/Tano-Coppoletta',
  resume: '/Gaetano_Coppoletta_Resume.pdf',
  description:
    'Full-stack software engineer and technical lead who builds scalable, AI-enabled products and platforms. Technical lead at Oracle, previously co-founder of GorgeousTV.',
  summary:
    'I’m a full-stack software engineer and technical lead who builds scalable, AI-enabled products and platforms from architecture through production.',
};

export const facts = [
  { label: 'Now', value: 'Full-stack software engineer building AI tools at Oracle' },
  { label: 'Before', value: 'Technical Co-Founder and Chief Product Officer, GorgeousTV' },
  { label: 'Research', value: 'First author at NDSS 2024, six CVEs in EV-charging software' },
];

// Paragraphs may contain <b> tags.
export const about = [
  'At Oracle, I lead the engineering of critical internal platforms used by <b>~2,000 security engineers</b>. My work supports security advisories and patches delivered to <b>1.5M+ customers</b>, saves <b>1,600+ person-hours per month</b>, and helped enable a move from quarterly to monthly releases. I build with Java, Python, TypeScript/React, SQL, cloud infrastructure, and AI-assisted workflows.',
  'Previously, as Technical Co-Founder and CPO at GorgeousTV, I led development of a customer-facing AI-powered contextual advertising platform from scratch. The product reached <b>1,000+ active users in two months</b>; I owned full-stack development, backend APIs, performance work, and cloud delivery.',
  'I also conducted security research at the University of Illinois Chicago, where I built OCPPStorm, a Python fuzzing platform that identified <b>six CVEs</b> in electric-vehicle charging implementations. The work was published as a first-author paper at NDSS 2024.',
  'I was born and raised in Sicily. My journey took me from a small town in Southern Italy to studying computer engineering at the Politecnico di Torino, then completing a dual degree at the University of Illinois Chicago. Along the way I worked in Italy and the United States.',
  'I enjoy turning ambiguous problems into reliable products with measurable customer and business impact. Open to connecting with engineers and teams building high-impact software.',
];

export const experience = [
  {
    title: 'Software Engineer',
    org: 'Oracle',
    dates: 'Feb 2025 to present',
    place: 'San Francisco, CA',
    points: [
      'Serve as <b>technical lead</b> for a full-stack <b>Node.js</b> enterprise product: translate stakeholder pain points into requirements, set architecture and priorities, lead cross-team rollout, and mentor engineers.',
      'Built user-facing vulnerability intake and advisory-review workflows used by <b>~2,000 engineers</b> across Oracle; consolidated researcher reports and patch data, saving <b>~1,600 person-hours monthly</b> and supporting advisories to <b>1.5M+ customers</b>.',
      'Designed <b>LLM-agent</b> workflows that collect reports and attachments from internal sources, generate technical summaries and initial severity assessments, and route external, internal, and customer-reported issues through tailored paths.',
      'Built AI validation for patch data using historical product, component, and version records; handled renamed products and imperfect history with human review for ambiguous cases. The workflow automates validation for <b>~95% of cases</b>.',
      'Helped shift security releases from quarterly to monthly; separately owned a mission-critical Java application and improved its reliability through dependent-system integrations and managed database connections.',
      'Received <b>three Spotlight Awards</b> for high-impact delivery across the organization.',
    ],
  },
  {
    title: 'Technical Co-Founder and Chief Product Officer',
    org: 'GorgeousTV',
    dates: 'Sep 2023 to Jan 2025',
    place: 'Los Angeles, CA',
    points: [
      'Owned <b>0-to-1 product and full-stack engineering</b> for a customer-facing AI advertising platform; built React/TypeScript interfaces and Node.js APIs, launched contextual ads in video, and reached <b>1,000+ active users in two months</b>.',
      'Built <b>GCP Dataflow</b> pipelines to ingest images, create embeddings, and store them in <b>Pinecone</b>; combined vector retrieval with text filters to select contextual ad candidates.',
      'Used <b>Amazon SQS</b> for asynchronous video processing and Redis caching for performance-critical APIs, achieving an average API response time of <b>0.5 seconds</b>.',
      'Automated GCP deployments with cloud build triggers, reducing deployment time by <b>50%+</b> and improving reliability with monitoring and autoscaling.',
    ],
  },
  {
    title: 'Graduate Researcher',
    org: 'Discovery Partners Institute, UIC Systems and Internet Security Lab',
    dates: 'Jun 2023 to Dec 2023',
    place: 'Chicago, IL',
    points: [
      'Built OCPPStorm, a language-agnostic Python black-box fuzzing platform for EV charging software; tested it against Java and .NET OCPP implementations.',
      'Developed random, state-machine, and ISLa-based fuzzing modules and collaborated on vulnerability validation and disclosure.',
      'Identified vulnerabilities assigned <b>six CVEs</b> across OCPP implementations.',
      'First author of the OCPPStorm paper presented at VehicleSec 2024, <b>NDSS Symposium</b>.',
    ],
  },
  {
    title: 'Research Assistant',
    org: 'University of Illinois Chicago',
    dates: 'Jan 2023 to Aug 2023',
    place: 'Chicago, IL',
    points: [
      'Analyzed security vulnerabilities in Python web applications, including SQL injection and cross-site scripting cases in Django.',
      'Built Python and Java tooling to generate abstract syntax trees, control-flow graphs, data-dependency graphs, and call graphs for vulnerability analysis.',
    ],
  },
  {
    title: 'Software Engineering Intern',
    org: 'Feedback Italia',
    dates: 'Mar 2021 to Jul 2021',
    place: 'Turin, Italy',
    points: [
      'Designed and implemented Android UI tests with UI Automator and Espresso, focusing on critical user flows and regression coverage.',
      'Added <b>50+ automated tests</b>, reducing manual testing from three days to under one hour.',
    ],
  },
];

export const research = {
  title: 'OCPPStorm: A Comprehensive Fuzzing Tool for OCPP Implementations',
  meta: ['Feb 2024', 'VehicleSec, NDSS Symposium', 'First author'],
  paragraphs: [
    'Electric vehicles are the fastest-growing transportation sector, and the Open Charge Point Protocol (OCPP) manages communication between chargers and central systems. OCPPStorm is a black-box fuzzing tool that tests the security of OCPP implementations across platforms. It combines three fuzzing strategies (Random Fuzzer, State Machine Fuzzer and ISLa Fuzzer) and was tested against two open-source OCPP systems on Java and .NET.',
    'The vulnerabilities include improper handling of StartTransaction messages, predictable transaction IDs, and denial-of-service and data-integrity issues. All six were addressed and fixed by the OCPP implementers.',
  ],
  cves: [
    'CVE-2024-25407',
    'CVE-2023-52096',
    'CVE-2023-49958',
    'CVE-2023-49957',
    'CVE-2023-49955',
    'CVE-2023-49956',
  ],
  paper: 'https://www.ndss-symposium.org/wp-content/uploads/vehiclesec2024-69-paper.pdf',
};

export const education = [
  {
    degree: 'M.S. Computer Science',
    school: 'University of Illinois Chicago',
    dates: 'Mar 2022 to Dec 2023',
    place: 'Chicago, IL',
    note: 'GPA 4.0/4.0',
  },
  {
    degree: 'M.S. Computer Engineering',
    school: 'Polytechnic University of Turin',
    dates: 'Oct 2021 to Dec 2023',
    place: 'Turin, Italy',
    note: 'Final grade 110/110',
  },
  {
    degree: 'B.S. Computer Engineering',
    school: 'Polytechnic University of Turin',
    dates: 'Oct 2018 to Sep 2021',
    place: 'Turin, Italy',
    note: '',
  },
];

export const skills = [
  {
    group: 'Languages and full stack',
    items: 'TypeScript, JavaScript, Python, Java, SQL, React, Node.js, REST APIs, HTML/CSS',
  },
  {
    group: 'AI and data',
    items:
      'LLM agents, MCP integrations, workflow validation, human review, embeddings, Pinecone vector search, GCP Dataflow',
  },
  {
    group: 'Cloud and delivery',
    items: 'GCP, Kubernetes, Cloud Run, AWS (SQS), OCI, Redis, CI/CD, monitoring, autoscaling',
  },
  {
    group: 'Leadership',
    items: 'Product ownership, technical direction, code review, mentoring, cross-functional delivery',
  },
];
