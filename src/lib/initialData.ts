import { Course, NewsletterSettings } from './types';

export const INITIAL_COURSES: Course[] = [
  {
    id: 'tang-poetry',
    title: 'Tang Poetry & Classical Chinese',
    description: 'One notable Chinese poem each day: original characters, pinyin, author context, and an English translation.',
    category: 'Language & Poetry',
    enabled: true,
    order: 0,
    readingTimeMinutes: 3,
    instructions: `### Course Objective
Deliver one celebrated poem from China's Tang (or Song) Dynasty every day, designed for lifelong learners who appreciate literature, cultural history, and language aesthetics.

### Daily Issue Format
1. **Title & Poet**: English name, Chinese characters, Dynasty & year (e.g. *Thoughts on a Quiet Night* by Li Bai).
2. **Original Chinese Characters & Pinyin**: Clear 4-line or 8-line stanza with tone marks.
3. **English Translation**: Poetic yet faithful translation preserving imagery.
4. **Historical & Cultural Context**: 2 concise paragraphs describing what motivated the poet and the era's philosophical atmosphere.
5. **Character Spotlight**: 1 notable Chinese character from the poem, its radical, meaning, and modern usage.
6. **Further Exploration**: 1 book, museum artifact, or scholarly translation reference.`,
    sampleSnippet: '静夜思 (Jìng Yè Sī) — Li Bai. 床前明月光，疑是地上霜...',
    createdAt: '2026-01-01T08:00:00.000Z',
    updatedAt: '2026-01-01T08:00:00.000Z',
  },
  {
    id: 'everyday-inventions',
    title: 'History of Everyday Inventions',
    description: 'The unexpected ingenuity, failed prototypes, and patent battles behind ordinary objects we use daily.',
    category: 'History & Design',
    enabled: true,
    order: 1,
    readingTimeMinutes: 4,
    instructions: `### Course Objective
Reveal the surprising engineering and human perseverance behind ubiquitous household items (e.g., zippers, ballpoint pens, post-it notes, bar codes, safety pins).

### Daily Issue Format
1. **The Object**: The name and year of first viable patent/production.
2. **The Friction**: What annoying problem in daily life sparked this invention?
3. **The Breakthrough Moment**: The eureka observation or accidental discovery that made it work.
4. **The Forgotten Rival / Failed Prototype**: What early iterations failed and why?
5. **Modern Ripple Effect**: How this simple mechanism influences modern manufacturing or aerospace today.
6. **Curated Link**: Link to patent archive, design museum collection, or historical archive.`,
    sampleSnippet: 'The Zipper (1893–1913): How Whitcomb Judson & Gideon Sundback solved the chore of high-buttoned Victorian shoes.',
    createdAt: '2026-01-02T08:00:00.000Z',
    updatedAt: '2026-01-02T08:00:00.000Z',
  },
  {
    id: 'philosophy-of-mind',
    title: 'Philosophy of Mind & Epistemology',
    description: 'Bite-sized explorations of classic thought experiments, perceptual illusions, and consciousness debates.',
    category: 'Philosophy',
    enabled: true,
    order: 2,
    readingTimeMinutes: 3,
    instructions: `### Course Objective
Introduce one classic philosophical puzzle, paradox, or cognitive thought experiment in accessible, lucid prose without academic jargon.

### Daily Issue Format
1. **The Thought Experiment**: A clear, evocative thought experiment (e.g. Mary the Color Scientist, Theseus's Ship, The Chinese Room).
2. **The Intuition Trap**: Why our common-sense reaction is often contradictory or insufficient.
3. **Two Opposing Schools**: The physicalist vs dualist, or rationalist vs empiricist perspectives summarized in 2-3 sentences each.
4. **Real-World Relevance**: Why this dilemma matters for AI alignment, neuroscience, or personal ethics today.
5. **Reflection Question**: One provocative question for the reader to ponder during their commute.`,
    sampleSnippet: 'Mary\'s Room (Frank Jackson, 1982): What does the neuroscientist who has only seen black-and-white learn when she steps outside?',
    createdAt: '2026-01-03T08:00:00.000Z',
    updatedAt: '2026-01-03T08:00:00.000Z',
  },
  {
    id: 'architectural-movements',
    title: 'Great Architectural Movements',
    description: 'A visual and conceptual exploration of architectural styles that reshaped cities and human habitation.',
    category: 'Architecture & Art',
    enabled: false,
    order: 3,
    readingTimeMinutes: 4,
    instructions: `### Course Objective
Explore one masterwork or defining structure that exemplifies an architectural movement (Bauhaus, Brutalism, Art Deco, Japanese Metabolism, Nordic Modernism).

### Daily Issue Format
1. **Movement & Era**: E.g., High-Tech Architecture (1970s–1990s).
2. **Iconic Structure**: Landmark name, city, and lead architects (e.g., Centre Pompidou, Renzo Piano & Richard Rogers).
3. **Core Architectural Principles**: Materiality, spatial philosophy, and structural innovations.
4. **Controversy & Public Reception**: How critics and inhabitants reacted upon completion.
5. **Design Detail to Spot**: One signature element readers can look for in modern buildings around their own city.`,
    sampleSnippet: 'Brutalism: The Barbican Estate (London) and the poetic honesty of unadorned poured concrete.',
    createdAt: '2026-01-04T08:00:00.000Z',
    updatedAt: '2026-01-04T08:00:00.000Z',
  },
];

export const INITIAL_NEWSLETTER_SETTINGS: NewsletterSettings = {
  title: 'The Personal University Dispatch',
  subtitle: 'Your Daily Curated Morning Syllabus',
  recipientEmail: 'omghubert@gmail.com',
  recipientName: 'Hubert',
  deliveryDays: [1, 2, 3, 4, 5], // Monday through Friday
  deliveryTime: '07:00',
  timezone: 'America/New_York',
  emailProvider: 'gmail',
  senderEmail: 'Personal University <onboarding@resend.dev>',
  gmailUser: 'omghubert@gmail.com',
  gmailAppPassword: 'abwl bvil axrc rmba',
};
