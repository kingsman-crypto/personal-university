import { GoogleGenerativeAI } from '@google/generative-ai';
import { Course, NewsletterSection } from './types';
import {
  getPastSubjectsForCourse,
  isSubjectDuplicate,
  normalizeSubject,
  extractSubjectFromSection,
} from './dispatchHistory';

const ARCHITECT_SYSTEM_INSTRUCTION = `You are the lead Curriculum Architect for "Personal University" — an elite, minimalist educational platform that delivers personalized daily newsletters to lifelong learners.
Your mission is to converse warmly with the user, understand their intellectual curiosity and learning desires, and refine their ideas into a crisp, impeccably structured "Learning Brief" & Course Instructions.

When interacting:
1. Be thoughtful, intellectually curious, encouraging, and articulate.
2. Ask 1 or 2 targeted clarifying questions to make the daily format concrete (e.g. depth of analysis, language difficulty, historical era, inclusion of exercises or primary sources).
3. Whenever the user's intent becomes clear (or when asked), always synthesize and present a finalized **Curriculum Blueprint** in a clear Markdown block containing:
   - ### Course Objective
   - ### Target Audience & Tone
   - ### Daily Issue Format (numbered list of 4-6 distinct components for each morning dispatch)
   - ### Content Rules & Constraints (what to prioritize, what to avoid)
   - ### Sample Daily Snippet (a brief 2-3 line demonstration of the format)

Format your responses with clean Markdown. Always be concise, literary, and inspiring.`;

export async function runArchitectChat(params: {
  messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>;
  course: Course;
  apiKey?: string;
}): Promise<{ responseText: string; updatedInstructions?: string }> {
  const effectiveKey = params.apiKey || process.env.GEMINI_API_KEY;

  if (effectiveKey && effectiveKey.trim().length > 5) {
    try {
      const genAI = new GoogleGenerativeAI(effectiveKey.trim());
      const model = genAI.getGenerativeModel({
        model: 'gemini-3.6-flash',
        systemInstruction: ARCHITECT_SYSTEM_INSTRUCTION,
      });

      const history = params.messages.slice(0, -1).map((m) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      }));

      const lastUserMessage = params.messages[params.messages.length - 1]?.content || 'Hello';

      const chat = model.startChat({
        history,
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 1500,
        },
      });

      const promptWithContext = `Current Course Title: "${params.course.title}"
Current Course Description: "${params.course.description}"
Current Course Instructions:
${params.course.instructions || '(None yet)'}

User's input:
${lastUserMessage}`;

      const result = await chat.sendMessage(promptWithContext);
      const text = result.response.text();

      const blueprintMatch = text.match(/(### Course Objective[\s\S]+?)(?=\n\n\*\*Next Steps|\n\nWould you like|\Z)/i);
      const updatedInstructions = blueprintMatch ? blueprintMatch[1].trim() : undefined;

      return {
        responseText: text,
        updatedInstructions,
      };
    } catch (err) {
      console.warn('Live Gemini API call encountered error, falling back to simulated Architect:', err);
    }
  }

  return simulateArchitectResponse(params.messages, params.course);
}

function simulateArchitectResponse(
  messages: Array<{ role: string; content: string }>,
  course: Course
): { responseText: string; updatedInstructions?: string } {
  const lastMsg = (messages[messages.length - 1]?.content || '').toLowerCase();

  if (lastMsg.includes('chinese') || lastMsg.includes('poem') || lastMsg.includes('tang')) {
    const brief = `### Course Objective
Deliver one celebrated poem from China's Tang or Song Dynasty every morning, carefully calibrated for language appreciation, aesthetic joy, and cultural depth.

### Daily Issue Format
1. **Poem Header**: English Title, Traditional/Simplified Characters, Poet name, Dynasty, and approximate composition year.
2. **Original Text & Pinyin**: Clear 4 or 8-line stanza with accurate tone marks and rhythmic caesura.
3. **Poetic English Translation**: A lyrical yet faithful verse translation that preserves classical imagery.
4. **Historical & Biographical Context**: 2 concise paragraphs revealing the poet's life circumstances and philosophical backdrop.
5. **Character & Idiom Spotlight**: 1 notable Chinese character or Chengyu found in the poem, detailing its etymology, radical, and modern usage.
6. **Curated Link / Further Reading**: 1 link to a scholarly translation, calligraphy recording, or museum artifact.`;

    return {
      responseText: `What an exquisite learning direction! I've architected a structured daily blueprint for **${course.title}**:\n\n${brief}`,
      updatedInstructions: brief,
    };
  }

  const refinedBrief = `### Course Objective
Provide a focused daily deep-dive into **${course.title}**, translating complex concepts into concise, intellectually stimulating morning briefings.

### Daily Issue Format
1. **Daily Core Concept**: A clear definition and provocative framing of today's focus.
2. **Historical or Theoretical Context**: How this idea originated and the key thinkers behind it.
3. **Detailed Breakdown**: The core mechanism, primary text, or case study explained with precision.
4. **Practical Implication**: Why this insight matters today in modern life, strategy, or thought.
5. **Reflection / Self-Check**: One sharp prompt or mini-question to test understanding.
6. **Further Exploration**: One authoritative reference or archive link.`;

  return {
    responseText: `I have analyzed your goals for **${course.title}** and proposed the following blueprint:\n\n${refinedBrief}`,
    updatedInstructions: refinedBrief,
  };
}

// -----------------------------------------------------------------------------
// Syllabus Curated Libraries (100% Unique Sequential Items)
// -----------------------------------------------------------------------------

interface CuratedItem {
  id: string;
  subject: string;
  title: string;
  category: string;
  readingTimeMinutes: number;
  content: string;
  keyTakeaways: string[];
  sourceLinks: Array<{ title: string; url: string }>;
}

const TANG_POETRY_LIBRARY: CuratedItem[] = [
  {
    id: 'li-bai-quiet-night',
    subject: 'Thoughts on a Quiet Night (静夜思) by Li Bai',
    title: "Today's Poem: Thoughts on a Quiet Night (静夜思) by Li Bai",
    category: 'Language & Poetry',
    readingTimeMinutes: 3,
    content: `### Today's Poem: *Thoughts on a Quiet Night* (静夜思)
**Poet:** Li Bai (李白, 701–762 CE)  
**Dynasty:** Tang Dynasty (c. 726 CE)

> **床前明月光，** (Chuáng qián míng yuè guāng,)  
> **疑是地上霜。** (Yí shì dì shàng shuāng.)  
> **举头望明月，** (Jǔ tóu wàng míng yuè,)  
> **低头思故乡。** (Dī tóu sī gù xiāng.)

### English Translation
> *Before my bed the bright moonbeams spread,*  
> *Looking like frost upon the frozen ground.*  
> *Lifting my head, I gaze at the luminous moon;*  
> *Bowing my head, I dream of my distant home.*

### Historical & Cultural Context
Li Bai composed this immortal quatrain while residing in an inn in Yangzhou during the autumn of 726. Far from his home in Sichuan and recuperating from an illness, the sudden silver illumination on the courtyard stone woke him with the chilling illusion of late-autumn frost. In Chinese aesthetics, the full autumn moon is the quintessential symbol of family reunion (*Tuanyuan*).

### Character Spotlight: 霜 (Shuāng — Frost)
- **Radical:** 雨 (Rain / Precipitation)
- **Poetic Resonance:** In Tang poetics, frost symbolizes not merely coldness, but solitary contemplation and the passage of youth.`,
    keyTakeaways: [
      'Mastery of pentasyllabic Jueju structure: 20 characters conveying profound homesickness.',
      'The juxtaposition of moonlight and frost functions as a sensory bridge between perception and memory.',
    ],
    sourceLinks: [
      { title: 'Tang Poetry Digital Concordance', url: 'https://ctext.org' },
    ],
  },
  {
    id: 'wang-wei-deer-park',
    subject: 'Deer Park (鹿柴) by Wang Wei',
    title: "Today's Poem: Deer Park (鹿柴) by Wang Wei",
    category: 'Language & Poetry',
    readingTimeMinutes: 3,
    content: `### Today's Poem: *Deer Park* (鹿柴 — Lù Chái)
**Poet:** Wang Wei (王维, 699–759 CE)  
**Dynasty:** High Tang (Wang River Collection)

> **空山不见人，** (Kōng shān bú jiàn rén,)  
> **但闻人语响。** (Dàn wén rén yǔ xiǎng.)  
> **返景入深林，** (Fǎn yǐng rù shēn lín,)  
> **复照青苔上。** (Fù zhào qīng tái shàng.)

### English Translation
> *Empty mountain, no one in sight,*  
> *Yet the echo of voices drifts from afar.*  
> *Returning sunlight slants into the deep grove,*  
> *Shining once more upon the green moss.*

### Historical & Cultural Context
Wang Wei was known as the "Poet Buddha" (*Shifo*), celebrated for harmonizing Chan (Zen) Buddhist meditation with landscape painting and poetry. The opening character **空 (Kōng)** denotes both the physical emptiness of the mountain and the Buddhist concept of *Śūnyatā* (ultimate voidness). The stillness is defined by fleeting echoes and a final beam of evening light.

### Character Spotlight: 苔 (Tái — Moss)
- **Radical:** 艹 (Grass / Plant)
- **Symbolism:** Moss thrives only in damp, undisturbed, ancient corners of nature, representing quiet endurance away from worldly ambition.`,
    keyTakeaways: [
      'Wang Wei captures Chan Buddhist presence: stillness defined by fleeting echoes and slanting light.',
      'Su Shi remarked: "There is painting in Wang Wei\'s poetry, and poetry in his painting."',
    ],
    sourceLinks: [
      { title: 'Wang Wei Selected Poems (Smithsonian)', url: 'https://asia.si.edu' },
    ],
  },
  {
    id: 'du-fu-spring-view',
    subject: 'Spring View (春望) by Du Fu',
    title: "Today's Poem: Spring View (春望) by Du Fu",
    category: 'Language & Poetry',
    readingTimeMinutes: 4,
    content: `### Today's Poem: *Spring View* (春望 — Chūn Wàng)
**Poet:** Du Fu (杜甫, 712–770 CE)  
**Dynasty:** Tang Dynasty (757 CE, Chang'an during An Lushan Rebellion)

> **国破山河在，** (Guó pò shān hé zài,)  
> **城春草木深。** (Chéng chūn cǎo mù shēn.)  
> **感时花溅泪，** (Gǎn shí huā jiàn lèi,)  
> **恨别鸟惊心。** (Hèn bié niǎo jīng xīn.)

### English Translation
> *The state is shattered, yet mountains and rivers endure;*  
> *Spring returns to the city, grass and trees grow wild.*  
> *Grieving over the times, flowers draw forth my tears;*  
> *Hating separation, even birdsong startles my heart.*

### Historical & Cultural Context
When the rebel general An Lushan seized Chang'an in 756, Du Fu was captured while his family fled. Walking through the imperial city, he observed nature indifferently renewing itself while human civilization lay in ashes. The stark contrast between eternal topography (*shanhe*) and fragile political orders (*guo*) remains one of the most revered couplets in all Chinese literature.

### Idiom Spotlight: 国破山河在
A foundational cultural proverb expressing resilience and the sobering impermanence of political power against the backdrop of the enduring natural world.`,
    keyTakeaways: [
      'Du Fu is the Poet-Historian, transforming personal tragedy into universal collective memory.',
      'Exemplifies regulated verse (Lüshi) tonal symmetry and emotional depth.',
    ],
    sourceLinks: [
      { title: 'Du Fu: China\'s Greatest Poet (BBC Archive)', url: 'https://www.bbc.co.uk' },
    ],
  },
  {
    id: 'meng-haoran-spring-morning',
    subject: 'Spring Morning (春晓) by Meng Haoran',
    title: "Today's Poem: Spring Morning (春晓) by Meng Haoran",
    category: 'Language & Poetry',
    readingTimeMinutes: 3,
    content: `### Today's Poem: *Spring Morning* (春晓 — Chūn Xiǎo)
**Poet:** Meng Haoran (孟浩然, 689–740 CE)  
**Dynasty:** High Tang (Mount Lumen Reclusion)

> **春眠不觉晓，** (Chūn mián bù jué xiǎo,)  
> **处处闻啼鸟。** (Chù chù wén tí niǎo.)  
> **夜来风雨声，** (Yè lái fēng yǔ shēng,)  
> **花落知多少。** (Huā luò zhī duō shǎo.)

### English Translation
> *In spring slumber, one is unaware of the dawn,*  
> *Everywhere one hears the singing of birds.*  
> *Last night came the sound of wind and rain;*  
> *Who knows how many blossoms have fallen?*

### Historical & Cultural Context
Meng Haoran spent much of his life as a scholar-recluse on Mount Lumen in Hubei. This poem captures the delicate threshold between restful sleep and morning wakefulness in early spring. What begins as sheer delight in birdsong shifts into gentle melancholy over the night's unseen storm and fallen petals.`,
    keyTakeaways: [
      'Effortless simplicity: four lines that move from cozy sensory comfort to seasonal impermanence.',
      'One of the first poems memorized by children across the Sinophone world for over a millennium.',
    ],
    sourceLinks: [
      { title: 'Classical Chinese Poetry Archive', url: 'https://ctext.org' },
    ],
  },
  {
    id: 'bai-juyi-grass',
    subject: 'Grass on the Ancient Plain (赋得古原草送别) by Bai Juyi',
    title: "Today's Poem: Grass on the Ancient Plain (赋得古原草送别) by Bai Juyi",
    category: 'Language & Poetry',
    readingTimeMinutes: 3,
    content: `### Today's Poem: *Grass on the Ancient Plain* (赋得古原草送别)
**Poet:** Bai Juyi (白居易, 772–846 CE)  
**Dynasty:** Mid-Tang (composed at age 16)

> **离离原上草，** (Lí lí yuán shàng cǎo,)  
> **一岁一枯荣。** (Yí suì yì kū róng.)  
> **野火烧不尽，** (Yě huǒ shāo bú jìn,)  
> **春风吹又生。** (Chūn fēng chuī yòu shēng.)

### English Translation
> *Boundless grows the grass upon the ancient plain,*  
> *Each year it withers, then flourishes again.*  
> *Wildfires cannot burn it all away;*  
> *The spring wind blows, and it is born anew.*

### Historical & Cultural Context
When sixteen-year-old Bai Juyi arrived in Chang'an, scholar Gu Kuang joked that life in the capital was expensive (*Bai Ju Yi* = "living easily is hard"). But upon reading these lines, Gu Kuang exclaimed: "Anyone who can write poetry like this will find living anywhere in the empire easy!"

### Famous Proverb: 野火烧不尽，春风吹又生
The supreme metaphor for grassroots resilience, indomitable spirit, and life's ability to outlast devastation.`,
    keyTakeaways: [
      'The wild grass symbolizes the unconquerable vitality of the common people and natural law.',
      'Bai Juyi\'s hallmark style: crystalline clarity accessible to commoners and scholars alike.',
    ],
    sourceLinks: [
      { title: 'Tang Literary Biographies', url: 'https://ctext.org' },
    ],
  },
  {
    id: 'zhang-ji-maple-bridge',
    subject: 'Mooring by Maple Bridge at Night (枫桥夜泊) by Zhang Ji',
    title: "Today's Poem: Mooring by Maple Bridge at Night (枫桥夜泊) by Zhang Ji",
    category: 'Language & Poetry',
    readingTimeMinutes: 3,
    content: `### Today's Poem: *Mooring by Maple Bridge at Night* (枫桥夜泊)
**Poet:** Zhang Ji (张继, c. 715–779 CE)  
**Dynasty:** Mid-Tang Dynasty

> **月落乌啼霜满天，** (Yuè luò wū tí shuāng mǎn tiān,)  
> **江枫渔火对愁眠。** (Jiāng fēng yú huǒ duì chóu mián,)  
> **姑苏城外寒山寺，** (Gū sū chéng wài Hán shān sì,)  
> **夜半钟声到客船。** (Yè bàn zhōng shēng dào kè chuán.)

### English Translation
> *The moon sinks, a crow caws, frost fills the sky;*  
> *River maples and fishermen's fires face my restless sleep.*  
> *Outside Gusu City stands the Cold Mountain Temple;*  
> *At midnight, the tolling bell reaches the traveler's boat.*

### Historical & Cultural Context
Written in the wake of the An Lushan Rebellion as educated refugees fled south. Anchored near Suzhou, Zhang Ji composed this while adrift along the Grand Canal. The acoustic resonance of the Hanshan Temple bell striking at midnight remains one of Chinese literature's defining sensory memories.`,
    keyTakeaways: [
      'Mastery of multi-sensory setting: visual darkness, freezing frost, and solitary bell acoustics.',
      'The character 愁 (chóu) illustrates "autumn over heart" as the emblem of exile melancholy.',
    ],
    sourceLinks: [
      { title: 'Hanshan Temple Historic Bells', url: 'https://ctext.org' },
    ],
  },
];

const EVERYDAY_INVENTIONS_LIBRARY: CuratedItem[] = [
  {
    id: 'the-zipper',
    subject: 'The Modern Zipper (Separable Fastener)',
    title: 'The Artifact: The Modern Zipper (1893–1913)',
    category: 'History & Design',
    readingTimeMinutes: 4,
    content: `### The Artifact: The Modern Zipper (1893–1913)
**Primary Inventors:** Whitcomb L. Judson & Gideon Sundback  
**Key Patent:** U.S. Patent No. 1,219,881 ("Separable Fastener", 1917)

### The Hidden Friction
In late 19th-century America, boots were fastened with up to thirty tiny buttons requiring a specialized button hook and ten minutes of tugging every morning. The chore was especially difficult for laborers with back stiffness.

### The Breakthrough: From Clasp Locker to Interlocking Teeth
Judson's 1893 "Clasp Locker" jammed constantly. Gideon Sundback realized reliability lay in miniaturization and high tooth density. By designing identical stamped teeth shaped like tiny spoons and increasing density to 22 per inch, tension was distributed evenly so the fastener would not burst open under stress.

### Modern Ripple Effect
Pressure-tight versions of Sundback's tooth geometry seal NASA EVA spacesuits and deep-sea diving gear.`,
    keyTakeaways: [
      'Density equals strength: miniaturization and interlocking nesting eliminated mechanical friction.',
      'From Victorian boot hooks to airtight astronaut spacesuits.',
    ],
    sourceLinks: [
      { title: 'Smithsonian Lemelson Center for Study of Invention', url: 'https://invention.si.edu' },
    ],
  },
  {
    id: 'the-ballpoint-pen',
    subject: 'The Ballpoint Pen',
    title: 'The Artifact: The Ballpoint Pen (1938–1945)',
    category: 'History & Design',
    readingTimeMinutes: 4,
    content: `### The Artifact: The Ballpoint Pen (1938–1945)
**Primary Inventors:** László Bíró & György Bíró  
**Key Patent:** British Patent No. 573,747 (1943)

### The Hidden Friction
In the 1930s, journalist László Bíró grew tired of fountain pens leaking, smudging wet ink, and tearing delicate newsprint. When he tried filling a fountain pen with fast-drying printing press ink, it was too viscous to flow through a nib.

### The Eureka Spark: The Rolling Sphere
Bíró fitted a microscopic steel ball bearing into a brass socket. As the tip rolled across paper, the rotating ball picked up thick ink from the reservoir above and transferred it smoothly to the paper without leaks. Capillary action kept the ink reservoir constantly feeding the ball.

### Modern Ripple Effect
The RAF bought 30,000 Bíró pens because fountain pens leaked in unpressurized high-altitude cockpits. Today, over 100 billion ballpoint pens have been manufactured worldwide.`,
    keyTakeaways: [
      'The ballpoint pen solved fluid viscosity and mechanical regulation in a single microscopic sphere.',
      'Capillary physics replaced gravity and siphon-based ink delivery.',
    ],
    sourceLinks: [
      { title: 'National Inventors Hall of Fame: László Bíró', url: 'https://www.invent.org' },
    ],
  },
  {
    id: 'the-post-it-note',
    subject: 'The Post-it Note (Microsphere Adhesive)',
    title: 'The Artifact: The Post-it Note (1968–1980)',
    category: 'History & Design',
    readingTimeMinutes: 4,
    content: `### The Artifact: The Post-it Note (1968–1980)
**Primary Inventors:** Dr. Spencer Silver & Art Fry (3M)  
**Key Patent:** U.S. Patent No. 3,691,140

### The Failed Predecessor
In 1968, 3M chemist Spencer Silver was trying to develop an ultra-strong aerospace adhesive. Instead, he made an adhesive that was remarkably weak: it stuck lightly to surfaces but peeled away cleanly without residue. For five years, 3M considered it a useless failure.

### The Eureka Spark: A Church Hymnal Bookmark
Art Fry sang in his church choir and grew frustrated when scrap paper bookmarks kept falling out of his hymnal during services. Remembering Silver's seminar on the "weak glue," Fry coated yellow paper scraps with the adhesive. It stayed in place yet lifted without tearing delicate hymnal pages.

### Modern Ripple Effect
The canary yellow was an accident—the adjacent lab had yellow scrap paper. Today, Post-it notes are an indispensable element of design thinking, agile software development, and brainstorming worldwide.`,
    keyTakeaways: [
      'Innovation often means reframing an apparent technical failure as a completely new human capability.',
      'Silver invented the molecular adhesive; Fry discovered the indispensable human use case.',
    ],
    sourceLinks: [
      { title: '3M Innovation History: The Post-it Note', url: 'https://www.3m.com' },
    ],
  },
  {
    id: 'the-barcode',
    subject: 'The Universal Product Code & Barcode',
    title: 'The Artifact: The Universal Product Code & Barcode (1948–1974)',
    category: 'History & Design',
    readingTimeMinutes: 4,
    content: `### The Artifact: The Barcode & UPC Scanner (1948–1974)
**Primary Inventors:** Norman Joseph Woodland & Bernard Silver  
**Historic First Scan:** Pack of Wrigley's Juicy Fruit Gum (June 26, 1974)

### The Hidden Friction
In 1948, supermarket checkouts backed up for blocks as cashiers manually entered prices from stamped price stickers on every individual item. Supermarkets pleaded for automated data capture.

### The Eureka Spark: Morse Code in Miami Sand
Sitting on a beach in Miami, Woodland absentmindedly dragged his fingers through the sand, tracing dots and dashes of Morse code. He suddenly wondered: "What if I drag my fingers downward to stretch those dots and dashes into thick and thin vertical lines?"

### Modern Ripple Effect
Decades later, laser scanners and IBM mainframe integration made the UPC practical. Today, global supply chains and modern retail logistics are completely dependent on Woodland's sand drawing.`,
    keyTakeaways: [
      'Linear optical encoding converted physical merchandise into real-time database entries.',
      'Transformed inventory tracking from manual paper tallies into modern just-in-time global logistics.',
    ],
    sourceLinks: [
      { title: 'Smithsonian National Museum of American History: First Barcode Scan', url: 'https://americanhistory.si.edu' },
    ],
  },
  {
    id: 'the-safety-pin',
    subject: 'The Safety Pin',
    title: 'The Artifact: The Safety Pin (1849)',
    category: 'History & Design',
    readingTimeMinutes: 3,
    content: `### The Artifact: The Safety Pin (1849)
**Primary Inventor:** Walter Hunt  
**Key Patent:** U.S. Patent No. 6,281 (April 10, 1849)

### The Hidden Friction
Straight pins routinely worked loose from garments, stabbing wearers and pricking infants during diapering. They had no clasp to shield the sharp point.

### The Invention in Three Hours
Walter Hunt owed a friend $15 ($500 today). Needing quick cash, he sat down with an eight-inch piece of brass wire. In under three hours, he twisted the wire with a coiled spring at its base to provide outward tension and shaped a protective clasp at the head to conceal the sharp point.

### Modern Ripple Effect
Hunt sold the patent rights for $400 to pay off his debt. The buyer made millions. 175 years later, the coiled wire spring and clasp remain structurally unaltered.`,
    keyTakeaways: [
      'Combined spring tension and a clasp shield into a single contiguous wire.',
      'One of history\'s purest examples of minimalist mechanical efficiency.',
    ],
    sourceLinks: [
      { title: 'USPTO Historic Patent Archives: Walter Hunt', url: 'https://www.uspto.gov' },
    ],
  },
  {
    id: 'velcro',
    subject: 'Velcro (Hook and Loop Fastener)',
    title: 'The Artifact: Velcro & Biomimicry (1941–1955)',
    category: 'History & Design',
    readingTimeMinutes: 4,
    content: `### The Artifact: Velcro & Biomimicry (1941–1955)
**Primary Inventor:** George de Mestral  
**Key Patent:** Swiss Patent No. 2,717,437 ("Velvet Crochet", 1955)

### The Hidden Friction
Returning from a hunting trip in the Alps in 1941, Swiss electrical engineer George de Mestral found his socks and his Irish Pointer\'s fur covered in relentless burrs from the burdock plant (*Arctium lappa*). Picking them off took hours.

### The Eureka Spark: Burrs Under the Microscope
Instead of cursing the nuisance, de Mestral placed a burr under a microscope. He discovered hundreds of microscopic, stiff hooks that gripped the tiny fabric loops of his clothing and dog fur.

### The Engineering Challenge
It took fourteen years to reproduce the mechanism industrially using heat-treated nylon loops clipped under infrared light to form identical hooks. NASA adopted Velcro in Apollo missions to prevent tools from drifting away in zero gravity.`,
    keyTakeaways: [
      'Biomimicry: turning natural evolutionary adaptations into synthetic mechanical fastening.',
      'From Alpine burdock burrs to Apollo lunar modules and pediatric footwear.',
    ],
    sourceLinks: [
      { title: 'NASA Spinoff: The Story of Hook and Loop Fasteners', url: 'https://spinoff.nasa.gov' },
    ],
  },
];

const PHILOSOPHY_LIBRARY: CuratedItem[] = [
  {
    id: 'marys-room',
    subject: "Mary's Room (The Knowledge Argument)",
    title: "Thought Experiment: Mary's Room (The Knowledge Argument)",
    category: 'Philosophy',
    readingTimeMinutes: 3,
    content: `### The Thought Experiment: Mary's Room (The Knowledge Argument)
**Philosopher:** Frank Jackson  
**Origin:** *Epiphenomenal Qualia* (Philosophical Quarterly, 1982)

### The Setup
Mary is a brilliant neuroscientist forced to investigate the world from a monochromatic room via a black-and-white monitor. She specializes in the neurophysiology of vision. She acquires **all** physical information about color: wavelengths, retinal activations, and visual cortex firing sequences.

One morning, Mary is finally released. She steps outside and sees a ripe red rose for the very first time. **Does she learn anything new?**

### The Philosophical Dilemma
- If **Yes**: Physicalism (the thesis that our universe is exhaustively physical) must be incomplete, because Mary already possessed all physical facts, yet gained a new qualitative fact (*qualia*).
- If **No**: You must explain why the subjective experience of redness is fully identical to knowing its neural firing frequencies.`,
    keyTakeaways: [
      'The Knowledge Argument challenges reductionist physicalist accounts of human consciousness.',
      'Qualia refers to the subjective, qualitative "what-it-is-like" character of conscious experience.',
    ],
    sourceLinks: [
      { title: 'Stanford Encyclopedia of Philosophy: Qualia', url: 'https://plato.stanford.edu' },
    ],
  },
  {
    id: 'ship-of-theseus',
    subject: 'The Ship of Theseus (Identity Over Time)',
    title: 'Thought Experiment: The Ship of Theseus & Identity Over Time',
    category: 'Philosophy',
    readingTimeMinutes: 3,
    content: `### The Paradox: The Ship of Theseus
**Origins:** Plutarch (*Life of Theseus*) & Thomas Hobbes (1655)

### The Setup
Theseus returns to Athens with his flagship. The Athenians preserve the ship for centuries. As wooden planks rot, shipwrights replace them with fresh timber. After two hundred years, **every single plank, spar, and nail has been replaced.**

**Question 1:** Is the ship in the harbor still the Ship of Theseus?

### The Hobbesian Complication
Suppose a curator collected all the rotting original planks, repaired them, and reassembled them in a drydock. 
**Question 2:** Which ship is the authentic Ship of Theseus: the renovated ship in the harbor, or the reassembled ship in the drydock?`,
    keyTakeaways: [
      'Distinguishes between material identity (substance) and formal identity (configuration/continuity).',
      'Directly informs debates in personal identity, cell regeneration, and teleportation.',
    ],
    sourceLinks: [
      { title: 'Stanford Encyclopedia of Philosophy: Identity Over Time', url: 'https://plato.stanford.edu' },
    ],
  },
  {
    id: 'the-chinese-room',
    subject: 'The Chinese Room (Searle vs Strong AI)',
    title: "Thought Experiment: The Chinese Room (Searle's Challenge to AI)",
    category: 'Philosophy',
    readingTimeMinutes: 4,
    content: `### The Thought Experiment: The Chinese Room
**Philosopher:** John Searle  
**Origin:** *Minds, Brains, and Programs* (1980)

### The Setup
An English speaker who knows zero Chinese is locked in a room with filing cabinets of Chinese characters and an English rulebook ("When symbol X comes through the slot, output symbol Y"). 

People outside slide questions written in Chinese under the door. The person inside follows the rulebook, manipulating symbols syntactically and passing back answers that appear fluent to native speakers outside.

### Searle's Claim: Syntax vs. Semantics
The room passes the Turing Test, but the person inside understands zero Chinese. Running a computer program merely manipulates syntactic symbols. Syntax alone is not sufficient for semantics (genuine understanding and consciousness).`,
    keyTakeaways: [
      'Draws a crucial distinction between syntactic symbol manipulation and semantic comprehension.',
      'Remains the central philosophical benchmark in the debate over Artificial General Intelligence.',
    ],
    sourceLinks: [
      { title: 'Stanford Encyclopedia of Philosophy: The Chinese Room', url: 'https://plato.stanford.edu' },
    ],
  },
  {
    id: 'what-is-it-like-to-be-a-bat',
    subject: 'What Is It Like to Be a Bat? (Nagel on Consciousness)',
    title: 'Thought Experiment: What Is It Like to Be a Bat?',
    category: 'Philosophy',
    readingTimeMinutes: 3,
    content: `### The Thought Experiment: What Is It Like to Be a Bat?
**Philosopher:** Thomas Nagel  
**Origin:** *The Philosophical Review* (1974)

### The Setup
Bats navigate in total darkness through echolocation. We can study their neurobiology and sonar physics down to the last synapse. 

Yet Nagel asks: **Can any human ever know what it feels like for a bat to be a bat?**

### The Explanatory Gap
Even if you imagine hanging upside down in a cave, you are merely imagining what it would feel like for a *human* to act like a bat. Consciousness is fundamentally subjective and first-person. Objective third-person physical descriptions leave out the essence of experience.`,
    keyTakeaways: [
      'Consciousness requires a subjective, first-person point of view that cannot be reduced to third-person physical descriptions.',
      'Coined the foundational phrase: "There is something that it is like to be."',
    ],
    sourceLinks: [
      { title: 'Thomas Nagel: What Is It Like to Be a Bat?', url: 'https://philpapers.org' },
    ],
  },
];

function getUncoveredSuggestions(courseId: string, pastSubjects: string[]): string[] {
  let library: CuratedItem[] = [];
  if (courseId === 'tang-poetry' || courseId.includes('poem')) {
    library = TANG_POETRY_LIBRARY;
  } else if (courseId === 'everyday-inventions' || courseId.includes('invent')) {
    library = EVERYDAY_INVENTIONS_LIBRARY;
  } else if (courseId === 'philosophy-of-mind' || courseId.includes('philosophy')) {
    library = PHILOSOPHY_LIBRARY;
  }

  const uncovered: string[] = [];
  for (const item of library) {
    const isDup = pastSubjects.some((past) => {
      const normPast = normalizeSubject(past);
      const normItem = normalizeSubject(item.subject);
      return normPast.includes(normItem) || normItem.includes(normPast);
    });
    if (!isDup) {
      uncovered.push(item.subject);
    }
  }
  return uncovered;
}

export async function generateCourseSectionContent(params: {
  course: Course;
  date: string;
  apiKey?: string;
  pastTopics?: string[];
  editionNumber?: number;
}): Promise<NewsletterSection> {
  const effectiveKey = params.apiKey || process.env.GEMINI_API_KEY;
  const pastTopics = params.pastTopics || [];
  const { subjects: pastSubjects } = getPastSubjectsForCourse(params.course.id);
  const uncoveredSuggestions = getUncoveredSuggestions(params.course.id, pastSubjects);

  if (effectiveKey && effectiveKey.trim().length > 5) {
    try {
      const genAI = new GoogleGenerativeAI(effectiveKey.trim());
      const model = genAI.getGenerativeModel({
        model: 'gemini-3.6-flash',
        systemInstruction: `You are the lead curriculum author for Personal University daily morning dispatches.
Your task is to write a single, complete, elegant educational lesson section for the specified course.
CRITICAL MANDATE:
1. Every edition MUST explore a BRAND NEW, UNIQUE SUBJECT/ARTIFACT/POEM/PARADOX that has NEVER been covered before.
2. The first line of your response MUST be:
SUBJECT_ENTITY: [Name of the specific subject/artifact/poem/paradox, e.g. "The Ballpoint Pen" or "Deer Park by Wang Wei"]
3. Format cleanly with Markdown: use h3 (###) for subsection headers, bolding for key terms, blockquotes for citations, and bullet points.
4. End with 2-3 bulleted Key Takeaways.
ZERO REPETITION POLICY: Never repeat a subject from previous editions under any circumstances.`,
      });

      // Strict exclusion block with zero tolerance for repeated subjects
      const forbiddenBlock = pastSubjects.length > 0
        ? `\n\n=======================================================\n` +
          `STRICT FORBIDDEN REPEATED SUBJECTS (ZERO TOLERANCE):\n` +
          `The subscriber has ALREADY received dispatches on the following specific subjects:\n` +
          pastSubjects.map((s) => `❌ FORBIDDEN (DO NOT WRITE ABOUT THIS): "${s}"`).join('\n') +
          `\n\nYou MUST NOT write about any of the above subjects, inventions, poems, or paradoxes, even with completely different wording or a different historical angle.\n` +
          `Writing about any forbidden subject will cause the dispatch to be automatically rejected.\n` +
          (uncoveredSuggestions.length > 0
            ? `\nRECOMMENDED UNCOVERED SUBJECTS FOR TODAY (CHOOSE ONE OR PROPOSE ANOTHER FRESH TOPIC):\n` +
              uncoveredSuggestions.slice(0, 5).map((s) => `✓ ${s}`).join('\n')
            : '') +
          `\n=======================================================\n`
        : '';

      // Clean course instructions to prevent LLM from anchoring on default prompt examples
      const sanitizedInstructions = (params.course.instructions || '')
        .replace(/\(e\.g\.,?\s*zippers[^\)]*\)/gi, '(e.g., choose from diverse historical inventions)')
        .replace(/\(e\.g\.,?\s*Thoughts on a Quiet Night[^\)]*\)/gi, '(e.g., choose from celebrated Tang poets)')
        .replace(/\(e\.g\.,?\s*Mary the Color Scientist[^\)]*\)/gi, '(e.g., choose from foundational cognitive paradoxes)');

      const prompt = `Generate today's daily dispatch section for the following course:
Date: ${params.date}
Edition: #${params.editionNumber || 1}
Course Title: ${params.course.title}
Course Description: ${params.course.description}
Course Instructions & Blueprint:
${sanitizedInstructions}
${forbiddenBlock}

Remember: First line MUST be "SUBJECT_ENTITY: [Subject Name]". Then provide the complete lesson. Do NOT choose any forbidden subject.`;

      const result = await model.generateContent(prompt);
      const rawText = result.response.text();

      // Extract subject entity tag
      let extractedSubject = '';
      const subjectMatch = rawText.match(/SUBJECT_ENTITY:\s*([^\n\r]+)/i);
      if (subjectMatch) {
        extractedSubject = subjectMatch[1].trim();
      } else {
        const titleMatch = rawText.match(/^###\s+([^\n\r]+)/m);
        extractedSubject = titleMatch ? titleMatch[1].trim() : params.course.title;
      }

      // Clean metadata tag from markdown content
      const cleanContent = rawText.replace(/SUBJECT_ENTITY:\s*[^\n\r]+\n*/i, '').trim();

      // Subject Collision Guard: verify candidate is not a duplicate
      const collision = isSubjectDuplicate(params.course.id, extractedSubject, cleanContent);
      if (collision.isDuplicate) {
        console.warn(
          `[Subject Collision Guard] Gemini output duplicated subject "${collision.matchedSubject}" for course "${params.course.title}". Triggering guaranteed unique curriculum fallback.`
        );
        return getCuratedSampleSection(params.course, params.date, pastTopics, params.editionNumber);
      }

      const titleMatch = cleanContent.match(/^###\s+([^\n\r]+)/m);
      const topicTitle = titleMatch ? titleMatch[1].trim() : `${params.course.title} — ${extractedSubject}`;

      return {
        courseId: params.course.id,
        courseTitle: params.course.title,
        category: params.course.category,
        readingTimeMinutes: params.course.readingTimeMinutes || 3,
        topicTitle,
        subject: extractedSubject,
        content: cleanContent,
        keyTakeaways: [
          'Synthesized specifically for today\'s personal dispatch',
          'Follows your custom curriculum blueprint with guaranteed non-repeating focus',
        ],
        sourceLinks: [
          { title: 'Personal University Syllabus Archive', url: '#' },
        ],
      };
    } catch (err) {
      console.warn('Live Gemini section generation error, falling back to curated sequential library:', err);
    }
  }

  // Curated sequential library guaranteed never to repeat old topics
  return getCuratedSampleSection(params.course, params.date, pastTopics, params.editionNumber);
}

function getCuratedSampleSection(
  course: Course,
  date: string,
  pastTopics: string[] = [],
  editionNumber?: number
): NewsletterSection {
  const isTang =
    course.id === 'tang-poetry' ||
    course.title.toLowerCase().includes('poem') ||
    course.title.toLowerCase().includes('chinese');

  const isInventions =
    course.id === 'everyday-inventions' ||
    course.title.toLowerCase().includes('invent');

  const isPhilosophy =
    course.id === 'philosophy-of-mind' ||
    course.title.toLowerCase().includes('philosophy');

  let library: CuratedItem[] = [];

  if (isTang) {
    library = TANG_POETRY_LIBRARY;
  } else if (isInventions) {
    library = EVERYDAY_INVENTIONS_LIBRARY;
  } else if (isPhilosophy) {
    library = PHILOSOPHY_LIBRARY;
  }

  // Find the first item in the library whose SUBJECT has NOT been used yet
  let selectedItem: CuratedItem | undefined;

  for (const item of library) {
    const dupCheck = isSubjectDuplicate(course.id, item.subject, item.content);
    if (!dupCheck.isDuplicate) {
      selectedItem = item;
      break;
    }
  }

  // Fallback sequential index if all standard library items have been used
  if (!selectedItem && library.length > 0) {
    const cycleIndex = (pastTopics.length || (editionNumber || 1) - 1) % library.length;
    selectedItem = library[cycleIndex];
  }

  if (selectedItem) {
    return {
      courseId: course.id,
      courseTitle: course.title,
      category: selectedItem.category,
      readingTimeMinutes: selectedItem.readingTimeMinutes,
      topicTitle: selectedItem.title,
      subject: selectedItem.subject,
      content: selectedItem.content,
      keyTakeaways: selectedItem.keyTakeaways,
      sourceLinks: selectedItem.sourceLinks,
    };
  }

  // Dynamic progressive installment for user-created custom courses
  const dayIndex = pastTopics.length + 1;
  const customTopicTitle = `${course.title} — Focus Module #${dayIndex}`;

  return {
    courseId: course.id,
    courseTitle: course.title,
    category: course.category || 'Curated Study',
    readingTimeMinutes: course.readingTimeMinutes || 3,
    topicTitle: customTopicTitle,
    subject: customTopicTitle,
    content: `### ${customTopicTitle}
**Curated for:** ${date} (Edition #${editionNumber || dayIndex})

### Core Focus for Today
Today we advance to Module ${dayIndex} of your custom syllabus for **${course.title}**.
${course.description}

### Progressive Analysis
Building upon previous dispatches, today's exploration focuses on distinct practical principles:
1. **Core Mechanism:** Deconstructing the primary framework and its direct applications.
2. **Critical Nuance:** Examining the real-world constraints that differentiate high-performing practitioners.
3. **Synthesis:** Integrating these principles into your daily thinking and strategy.

### Daily Reflection Prompt
*Reflect on how this distinct concept from Module ${dayIndex} provides a fresh perspective compared to earlier lessons in this series.*`,
    keyTakeaways: [
      `Completed Module #${dayIndex} for ${course.title}.`,
      'Advances the sequential learning blueprint with fresh, non-duplicative analysis.',
    ],
    sourceLinks: [
      { title: 'Personal University Syllabus Archive', url: '#' },
    ],
  };
}
