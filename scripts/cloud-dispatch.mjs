#!/usr/bin/env node

/**
 * Autonomous Cloud & Local Dispatcher for Personal University
 *
 * Can be executed in:
 * 1. GitHub Actions (scheduled cloud cron without computer being on)
 * 2. Standalone Node.js process / cloud server / container
 * 3. Local CLI testing
 *
 * Usage:
 *   node scripts/cloud-dispatch.mjs           # Run standard scheduled check (checks day/duplicate)
 *   node scripts/cloud-dispatch.mjs --force   # Force run dispatch now (skip day/duplicate check)
 *   node scripts/cloud-dispatch.mjs --dry-run # Simulate generation & preview without sending/saving
 *   node scripts/cloud-dispatch.mjs --status  # Print current scheduler status
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import nodemailer from 'nodemailer';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const DATA_DIR = path.join(ROOT_DIR, 'data');

const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');
const COURSES_FILE = path.join(DATA_DIR, 'courses.json');
const HISTORY_FILE = path.join(DATA_DIR, 'dispatch_history.json');

// Command line arguments
const args = process.argv.slice(2);
const isForce = args.includes('--force');
const isDryRun = args.includes('--dry-run');
const isStatus = args.includes('--status');

function readJson(filePath, defaultValue) {
  try {
    if (!fs.existsSync(filePath)) {
      return defaultValue;
    }
    const content = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(content);
  } catch (err) {
    console.error(`Error reading ${filePath}:`, err.message);
    return defaultValue;
  }
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf-8');
}

function getZonedParts(timeZone = 'America/New_York', date = new Date()) {
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hour12: false,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });

    const parts = formatter.formatToParts(date);
    const get = (type) => parts.find((p) => p.type === type)?.value || '';

    const weekdayShort = get('weekday');
    const year = get('year');
    const month = get('month');
    const day = get('day');
    const hour = get('hour');
    const minute = get('minute');

    const weekdayMap = {
      Sun: 0,
      Mon: 1,
      Tue: 2,
      Wed: 3,
      Thu: 4,
      Fri: 5,
      Sat: 6,
    };

    const dayOfWeek = weekdayMap[weekdayShort] ?? date.getDay();
    const timeHHMM = `${hour.padStart(2, '0')}:${minute.padStart(2, '0')}`;
    const dateKey = `${year}-${month}-${day}`;

    const fullDateFormatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
    const fullDateStr = fullDateFormatter.format(date);

    return { dayOfWeek, timeHHMM, dateKey, fullDateStr };
  } catch {
    const dayOfWeek = date.getDay();
    const hour = String(date.getHours()).padStart(2, '0');
    const minute = String(date.getMinutes()).padStart(2, '0');
    return {
      dayOfWeek,
      timeHHMM: `${hour}:${minute}`,
      dateKey: date.toISOString().slice(0, 10),
      fullDateStr: date.toDateString(),
    };
  }
}

function normalizeSubject(text) {
  return (text || '')
    .toLowerCase()
    .replace(/[«»《》""'']/g, '')
    .replace(/^(today's poem|the artifact|the thought experiment|the paradox|the invention|the structure):\s*/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractSubjectFromSection(section) {
  if (section.subject && section.subject.trim()) {
    return section.subject.trim();
  }
  const text = `${section.topicTitle || ''}\n${section.content || ''}`;
  const tagMatch = text.match(/SUBJECT_ENTITY:\s*([^\n\r]+)/i);
  if (tagMatch) return tagMatch[1].trim();

  const headerMatch = text.match(/^###\s+([^\n\r]+)/m);
  if (headerMatch) {
    return headerMatch[1]
      .trim()
      .replace(/^(today's poem|the artifact|the thought experiment|the paradox|the invention|the structure):\s*/i, '')
      .trim();
  }
  return section.topicTitle || section.courseTitle || 'General Lesson';
}

function getPastSubjectsForCourse(history, courseId) {
  const subjectsSet = new Set();
  const keywordsSet = new Set();

  for (const issue of history) {
    const section = (issue.sections || []).find((s) => s.courseId === courseId);
    if (section) {
      const subject = extractSubjectFromSection(section);
      subjectsSet.add(subject);
      const cleaned = normalizeSubject(subject);
      const words = cleaned
        .split(/[^a-z0-9\u4e00-\u9fa5]+/)
        .filter((w) => w.length >= 3 && !['the', 'and', 'for', 'with', 'from', 'today', 'poem', 'artifact'].includes(w));
      for (const word of words) keywordsSet.add(word);

      if (Array.isArray(section.subjectKeywords)) {
        for (const kw of section.subjectKeywords) keywordsSet.add(kw.toLowerCase().trim());
      }
    }
  }

  return { subjects: Array.from(subjectsSet), keywords: Array.from(keywordsSet) };
}

function isSubjectDuplicate(history, courseId, candidateSubject, candidateContent = '') {
  const { subjects, keywords } = getPastSubjectsForCourse(history, courseId);
  const normCandidate = normalizeSubject(candidateSubject);
  const normContent = (candidateContent || '').toLowerCase();

  for (const past of subjects) {
    const normPast = normalizeSubject(past);
    if (normCandidate.includes(normPast) || normPast.includes(normCandidate)) {
      return { isDuplicate: true, matchedSubject: past };
    }
  }

  for (const kw of keywords) {
    if (kw.length >= 4) {
      if (normCandidate.includes(kw)) {
        return { isDuplicate: true, matchedSubject: `Keyword stem match: "${kw}"` };
      }
      const occurrences = (normContent.match(new RegExp(`\\b${kw}\\b`, 'gi')) || []).length;
      if (occurrences >= 3) {
        return { isDuplicate: true, matchedSubject: `Content recurrence: "${kw}"` };
      }
    }
  }

  return { isDuplicate: false };
}

// -----------------------------------------------------------------------------
// Curated Sequential Educational Libraries (Fallback & Zero-Repetition Engine)
// -----------------------------------------------------------------------------

const TANG_POETRY_LIBRARY = [
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
    sourceLinks: [{ title: 'Tang Poetry Digital Concordance', url: 'https://ctext.org' }],
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
    sourceLinks: [{ title: 'Wang Wei Selected Poems (Smithsonian)', url: 'https://asia.si.edu' }],
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
    sourceLinks: [{ title: 'Du Fu: China\'s Greatest Poet (BBC Archive)', url: 'https://www.bbc.co.uk' }],
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
    sourceLinks: [{ title: 'Classical Chinese Poetry Archive', url: 'https://ctext.org' }],
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
    sourceLinks: [{ title: 'Tang Literary Biographies', url: 'https://ctext.org' }],
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
    sourceLinks: [{ title: 'Hanshan Temple Historic Bells', url: 'https://ctext.org' }],
  },
];

const EVERYDAY_INVENTIONS_LIBRARY = [
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
    sourceLinks: [{ title: 'Smithsonian Lemelson Center for Study of Invention', url: 'https://invention.si.edu' }],
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
    sourceLinks: [{ title: 'National Inventors Hall of Fame: László Bíró', url: 'https://www.invent.org' }],
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
    sourceLinks: [{ title: '3M Innovation History: The Post-it Note', url: 'https://www.3m.com' }],
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
    sourceLinks: [{ title: 'Smithsonian National Museum of American History: First Barcode Scan', url: 'https://americanhistory.si.edu' }],
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
    sourceLinks: [{ title: 'USPTO Historic Patent Archives: Walter Hunt', url: 'https://www.uspto.gov' }],
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
Returning from a hunting trip in the Alps in 1941, Swiss electrical engineer George de Mestral found his socks and his Irish Pointer's fur covered in relentless burrs from the burdock plant (*Arctium lappa*). Picking them off took hours.

### The Eureka Spark: Burrs Under the Microscope
Instead of cursing the nuisance, de Mestral placed a burr under a microscope. He discovered hundreds of microscopic, stiff hooks that gripped the tiny fabric loops of his clothing and dog fur.

### The Engineering Challenge
It took fourteen years to reproduce the mechanism industrially using heat-treated nylon loops clipped under infrared light to form identical hooks. NASA adopted Velcro in Apollo missions to prevent tools from drifting away in zero gravity.`,
    keyTakeaways: [
      'Biomimicry: turning natural evolutionary adaptations into synthetic mechanical fastening.',
      'From Alpine burdock burrs to Apollo lunar modules and pediatric footwear.',
    ],
    sourceLinks: [{ title: 'NASA Spinoff: The Story of Hook and Loop Fasteners', url: 'https://spinoff.nasa.gov' }],
  },
];

const PHILOSOPHY_LIBRARY = [
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
    sourceLinks: [{ title: 'Stanford Encyclopedia of Philosophy: Qualia', url: 'https://plato.stanford.edu' }],
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
    sourceLinks: [{ title: 'Stanford Encyclopedia of Philosophy: Identity Over Time', url: 'https://plato.stanford.edu' }],
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
    sourceLinks: [{ title: 'Stanford Encyclopedia of Philosophy: The Chinese Room', url: 'https://plato.stanford.edu' }],
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
    sourceLinks: [{ title: 'Thomas Nagel: What Is It Like to Be a Bat?', url: 'https://philpapers.org' }],
  },
];

async function generateSectionContent({ course, date, editionNumber, history, apiKey }) {
  const effectiveKey = (apiKey || process.env.GEMINI_API_KEY || '').trim();

  // Try live Gemini API if key is available
  if (effectiveKey && effectiveKey.length > 5) {
    try {
      const { GoogleGenerativeAI } = await import('@google/generative-ai');
      const genAI = new GoogleGenerativeAI(effectiveKey);
      const model = genAI.getGenerativeModel({
        model: 'gemini-1.5-flash',
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

      const { subjects: pastSubjects } = getPastSubjectsForCourse(history, course.id);
      const forbiddenBlock = pastSubjects.length > 0
        ? `\n\nSTRICT FORBIDDEN REPEATED SUBJECTS:\n` +
          pastSubjects.map((s) => `❌ FORBIDDEN: "${s}"`).join('\n') +
          `\nYou MUST NOT write about any of the above subjects.\n`
        : '';

      const prompt = `Generate today's daily dispatch section for the following course:
Date: ${date}
Edition: #${editionNumber}
Course Title: ${course.title}
Course Description: ${course.description}
Course Blueprint:
${course.instructions || ''}
${forbiddenBlock}

Remember: First line MUST be "SUBJECT_ENTITY: [Subject Name]". Then provide the complete lesson. Do NOT choose any forbidden subject.`;

      const result = await model.generateContent(prompt);
      const rawText = result.response.text();

      let extractedSubject = '';
      const subjectMatch = rawText.match(/SUBJECT_ENTITY:\s*([^\n\r]+)/i);
      if (subjectMatch) {
        extractedSubject = subjectMatch[1].trim();
      } else {
        const titleMatch = rawText.match(/^###\s+([^\n\r]+)/m);
        extractedSubject = titleMatch ? titleMatch[1].trim() : course.title;
      }

      const cleanContent = rawText.replace(/SUBJECT_ENTITY:\s*[^\n\r]+\n*/i, '').trim();
      const dupCheck = isSubjectDuplicate(history, course.id, extractedSubject, cleanContent);

      if (!dupCheck.isDuplicate) {
        const titleMatch = cleanContent.match(/^###\s+([^\n\r]+)/m);
        const topicTitle = titleMatch ? titleMatch[1].trim() : `${course.title} — ${extractedSubject}`;

        const keywords = normalizeSubject(extractedSubject)
          .split(/[^a-z0-9\u4e00-\u9fa5]+/)
          .filter((w) => w.length >= 3);

        return {
          courseId: course.id,
          courseTitle: course.title,
          category: course.category || 'General',
          readingTimeMinutes: course.readingTimeMinutes || 3,
          topicTitle,
          subject: extractedSubject,
          subjectKeywords: keywords,
          content: cleanContent,
          keyTakeaways: [
            'Synthesized specifically for today\'s personal dispatch',
            'Follows your custom curriculum blueprint with guaranteed non-repeating focus',
          ],
          sourceLinks: [{ title: 'Personal University Syllabus Archive', url: '#' }],
        };
      }
      console.warn(`Gemini proposed duplicated subject "${extractedSubject}". Using curated library fallback.`);
    } catch (err) {
      console.warn('Gemini generation failed, falling back to curated curriculum library:', err.message);
    }
  }

  // Curated educational library fallback
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

  let library = [];
  if (isTang) library = TANG_POETRY_LIBRARY;
  else if (isInventions) library = EVERYDAY_INVENTIONS_LIBRARY;
  else if (isPhilosophy) library = PHILOSOPHY_LIBRARY;

  let selectedItem;
  for (const item of library) {
    const dupCheck = isSubjectDuplicate(history, course.id, item.subject, item.content);
    if (!dupCheck.isDuplicate) {
      selectedItem = item;
      break;
    }
  }

  if (!selectedItem && library.length > 0) {
    const cycleIndex = (history.length || 0) % library.length;
    selectedItem = library[cycleIndex];
  }

  if (selectedItem) {
    const keywords = normalizeSubject(selectedItem.subject)
      .split(/[^a-z0-9\u4e00-\u9fa5]+/)
      .filter((w) => w.length >= 3);

    return {
      courseId: course.id,
      courseTitle: course.title,
      category: selectedItem.category,
      readingTimeMinutes: selectedItem.readingTimeMinutes,
      topicTitle: selectedItem.title,
      subject: selectedItem.subject,
      subjectKeywords: keywords,
      content: selectedItem.content,
      keyTakeaways: selectedItem.keyTakeaways,
      sourceLinks: selectedItem.sourceLinks,
    };
  }

  // Fallback for custom user courses
  return {
    courseId: course.id,
    courseTitle: course.title,
    category: course.category || 'Curriculum',
    readingTimeMinutes: course.readingTimeMinutes || 3,
    topicTitle: `${course.title} — Installment #${editionNumber}`,
    subject: `${course.title} Concept #${editionNumber}`,
    subjectKeywords: [course.id],
    content: `### Today's Focus: ${course.title}\n\n${course.description}\n\nKey ongoing study concepts for today's syllabus session.`,
    keyTakeaways: ['Daily curriculum module for ' + course.title],
    sourceLinks: [{ title: 'Personal University Syllabus Archive', url: '#' }],
  };
}

// -----------------------------------------------------------------------------
// HTML Email Renderer
// -----------------------------------------------------------------------------

function escapeHtml(str) {
  return (str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatMarkdownToHtml(markdown) {
  if (!markdown) return '';
  let html = markdown;

  html = html.replace(/^### (.*$)/gim, '<h3 style="font-family: \'Newsreader\', Georgia, serif; font-size: 19px; color: #1C1917; margin: 20px 0 8px 0; font-weight: 600;">$1</h3>');
  html = html.replace(/^## (.*$)/gim, '<h2 style="font-family: \'Newsreader\', Georgia, serif; font-size: 21px; color: #1C1917; margin: 22px 0 10px 0; font-weight: 600;">$1</h2>');
  html = html.replace(/^# (.*$)/gim, '<h1 style="font-family: \'Newsreader\', Georgia, serif; font-size: 24px; color: #1C1917; margin: 24px 0 12px 0; font-weight: 600;">$1</h1>');
  html = html.replace(/^\> (.*$)/gim, '<blockquote style="border-left: 3px solid #C4B5A5; margin: 16px 0; padding: 6px 0 6px 16px; color: #57524C; font-style: italic; background: #F8F6F2;">$1</blockquote>');
  html = html.replace(/\*\*\*(.*?)\*\*\*/g, '<strong><em>$1</em></strong>');
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong style="color: #1C1917;">$1</strong>');
  html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
  html = html.replace(/^\s*-\s+(.*$)/gim, '<li style="margin-bottom: 6px;">$1</li>');
  html = html.replace(/(<li[\s\S]*?<\/li>)/g, '<ul style="margin: 12px 0; padding-left: 20px;">$1</ul>');

  const paragraphs = html.split(/\n\n+/);
  html = paragraphs
    .map((p) => {
      const trimmed = p.trim();
      if (!trimmed) return '';
      if (
        trimmed.startsWith('<h') ||
        trimmed.startsWith('<blockquote') ||
        trimmed.startsWith('<ul') ||
        trimmed.startsWith('<ol') ||
        trimmed.startsWith('<div')
      ) {
        return trimmed;
      }
      return `<p style="margin: 0 0 14px 0; line-height: 1.75; color: #292524;">${trimmed}</p>`;
    })
    .join('\n');

  return html;
}

function renderEmailHtml(issue, settings) {
  const tocItems = issue.sections
    .map(
      (sec, idx) => `
      <li style="margin-bottom: 8px; font-size: 15px; color: #44403C;">
        <a href="#section-${sec.courseId}" style="color: #78350F; text-decoration: none; font-weight: 500;">
          ${idx + 1}. ${escapeHtml(sec.courseTitle)}
        </a>
        <span style="color: #78716C; font-size: 13px; margin-left: 6px;">(${sec.readingTimeMinutes || 3} min read)</span>
      </li>
    `
    )
    .join('');

  const sectionsHtml = issue.sections
    .map(
      (sec, idx) => `
      <div id="section-${sec.courseId}" style="margin-top: 40px; padding-top: 32px; border-top: 1px solid #E7E2DA;">
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px;">
          <span style="display: inline-block; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.1em; color: #9E5A38; background: #FDF4E7; padding: 4px 10px; border-radius: 9999px;">
            Course 0${idx + 1} &bull; ${escapeHtml(sec.category || 'Curriculum')}
          </span>
          <span style="font-size: 13px; color: #78716C;">${sec.readingTimeMinutes || 3} min read</span>
        </div>

        <h2 style="font-family: 'Newsreader', Georgia, Cambria, serif; font-size: 24px; line-height: 1.3; color: #1C1917; margin: 8px 0 20px 0; font-weight: 600;">
          ${escapeHtml(sec.courseTitle)}
        </h2>

        <div style="font-size: 16px; line-height: 1.75; color: #292524; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
          ${formatMarkdownToHtml(sec.content)}
        </div>

        ${
          sec.keyTakeaways && sec.keyTakeaways.length > 0
            ? `
          <div style="margin-top: 24px; padding: 16px 20px; background-color: #F7F5F0; border-radius: 8px; border-left: 3px solid #78350F;">
            <p style="margin: 0 0 8px 0; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #78350F;">
              Key Takeaways
            </p>
            <ul style="margin: 0; padding-left: 18px; font-size: 14px; color: #44403C; line-height: 1.6;">
              ${sec.keyTakeaways.map((t) => `<li style="margin-bottom: 4px;">${escapeHtml(t)}</li>`).join('')}
            </ul>
          </div>
        `
            : ''
        }

        ${
          sec.sourceLinks && sec.sourceLinks.length > 0
            ? `
          <div style="margin-top: 16px; font-size: 13px; color: #78716C;">
            <strong style="color: #44403C;">Further Exploration:</strong>
            ${sec.sourceLinks
              .map(
                (link) => `
                <a href="${escapeHtml(link.url)}" target="_blank" style="color: #9E5A38; text-decoration: underline; margin-left: 6px;">
                  ${escapeHtml(link.title)} &rarr;
                </a>
              `
              )
              .join(', ')}
          </div>
        `
            : ''
        }
      </div>
    `
    )
    .join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(issue.title)}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #FAF8F5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased; color: #1F1E1D;">
  <div style="max-width: 640px; margin: 0 auto; padding: 40px 20px;">
    
    <!-- Masthead -->
    <header style="text-align: center; margin-bottom: 36px; padding-bottom: 24px; border-bottom: 2px solid #E7E2DA;">
      <p style="margin: 0 0 6px 0; font-size: 11px; text-transform: uppercase; letter-spacing: 0.2em; color: #78716C; font-weight: 600;">
        Personal University Dispatch &bull; Edition #${issue.editionNumber}
      </p>
      <h1 style="font-family: 'Newsreader', Georgia, Cambria, serif; font-size: 32px; line-height: 1.2; color: #1C1917; margin: 8px 0; font-weight: 600; letter-spacing: -0.02em;">
        ${escapeHtml(settings.title || 'Personal University')}
      </h1>
      <p style="margin: 6px 0 0 0; font-size: 14px; color: #78716C; font-style: italic;">
        ${escapeHtml(issue.date)} &bull; Prepared for ${escapeHtml(settings.recipientName || 'Scholar')}
      </p>
    </header>

    <!-- Table of Contents -->
    <div style="background-color: #FFFFFF; border: 1px solid #E7E2DA; border-radius: 12px; padding: 24px; margin-bottom: 32px; box-shadow: 0 1px 3px rgba(0,0,0,0.03);">
      <h3 style="font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: #1C1917; margin: 0 0 14px 0;">
        Today's Curriculum Syllabus
      </h3>
      <ol style="margin: 0; padding-left: 20px;">
        ${tocItems}
      </ol>
    </div>

    <!-- Course Sections -->
    <main>
      ${sectionsHtml}
    </main>

    <!-- Footer -->
    <footer style="margin-top: 56px; padding-top: 24px; border-top: 1px solid #E7E2DA; text-align: center; font-size: 12px; color: #A8A29E; line-height: 1.6;">
      <p style="margin: 0 0 6px 0;">
        You are receiving this because you enrolled in <strong>Personal University</strong>.
      </p>
      <p style="margin: 0;">
        Curriculum configured to your personal lifelong learning goals &bull; Autonomous Dispatcher
      </p>
    </footer>

  </div>
</body>
</html>`;
}

// -----------------------------------------------------------------------------
// Main Execution Routine
// -----------------------------------------------------------------------------

async function main() {
  console.log('====================================================');
  console.log('🎓 Personal University — Autonomous Dispatch Engine');
  console.log('====================================================');

  const settings = readJson(SETTINGS_FILE, {});
  const courses = readJson(COURSES_FILE, []);
  const history = readJson(HISTORY_FILE, []);

  const tz = settings.timezone || 'America/New_York';
  const { dayOfWeek, timeHHMM, fullDateStr } = getZonedParts(tz);

  if (isStatus) {
    console.log(`Current Time:     ${timeHHMM} (${tz})`);
    console.log(`Date:             ${fullDateStr}`);
    console.log(`Day of week:      ${dayOfWeek} (0=Sun, 1=Mon...6=Sat)`);
    console.log(`Delivery Days:    ${JSON.stringify(settings.deliveryDays || [])}`);
    console.log(`Delivery Time:    ${settings.deliveryTime || '07:00'}`);
    console.log(`Recipient:        ${settings.recipientEmail}`);
    console.log(`Total Dispatches: ${history.length}`);
    const last = history[history.length - 1];
    if (last) {
      console.log(`Last Dispatch:    Edition #${last.editionNumber} on ${last.date}`);
    }
    return;
  }

  // Verify delivery schedule unless forced
  const isDeliveryDay = Array.isArray(settings.deliveryDays) && settings.deliveryDays.includes(dayOfWeek);
  const alreadyDispatchedToday = history.some((issue) => issue.date.trim() === fullDateStr.trim());

  console.log(`Date:             ${fullDateStr}`);
  console.log(`Time:             ${timeHHMM} (${tz})`);
  console.log(`Scheduled Days:   ${JSON.stringify(settings.deliveryDays || [])}`);
  console.log(`Is Delivery Day:  ${isDeliveryDay ? 'YES' : 'NO'}`);
  console.log(`Already Sent:     ${alreadyDispatchedToday ? 'YES' : 'NO'}`);

  if (!isForce) {
    if (!isDeliveryDay) {
      console.log(`ℹ️  Today is not a scheduled delivery day. Exiting cleanly.`);
      return;
    }
    if (alreadyDispatchedToday) {
      console.log(`ℹ️  Dispatch for ${fullDateStr} has already been sent. Exiting cleanly.`);
      return;
    }
  } else {
    console.log(`⚡ Force mode active: Bypassing day-of-week and already-sent checks.`);
  }

  const enabledCourses = courses.filter((c) => c.enabled);
  if (enabledCourses.length === 0) {
    console.warn('⚠️  No active courses enabled. Please enable courses in data/courses.json.');
    return;
  }

  const editionNumber = history.length + 1;
  console.log(`\n📚 Generating Edition #${editionNumber} with ${enabledCourses.length} course(s)...`);

  const sections = [];
  for (const course of enabledCourses) {
    console.log(`   - Generating: ${course.title}...`);
    const section = await generateSectionContent({
      course,
      date: fullDateStr,
      editionNumber,
      history,
      apiKey: process.env.GEMINI_API_KEY,
    });
    console.log(`     ✓ Subject: "${section.subject || section.topicTitle}"`);
    sections.push(section);
  }

  const issue = {
    id: `dispatch-${Date.now()}`,
    date: fullDateStr,
    editionNumber,
    title: settings.title || 'The Personal University Dispatch',
    sections,
    generatedAt: new Date().toISOString(),
  };

  const htmlContent = renderEmailHtml(issue, settings);

  if (isDryRun) {
    console.log(`\n🔍 [Dry Run] Edition #${editionNumber} generated successfully!`);
    console.log(`   Title:    ${issue.title}`);
    console.log(`   Date:     ${issue.date}`);
    console.log(`   HTML Len: ${htmlContent.length} characters`);
    console.log(`   Sections: ${sections.map((s) => s.subject).join(', ')}`);
    console.log('\n[Dry Run complete — no email sent and history not modified]');
    return;
  }

  // Delivery credentials
  const effectiveGmailUser = (
    process.env.GMAIL_USER ||
    settings.gmailUser ||
    settings.recipientEmail ||
    ''
  ).trim();

  const effectiveGmailPassword = (
    process.env.GMAIL_APP_PASSWORD ||
    settings.gmailAppPassword ||
    ''
  ).trim().replace(/\s+/g, '');

  const effectiveRecipient = (
    process.env.RECIPIENT_EMAIL ||
    settings.recipientEmail ||
    ''
  ).trim();

  if (!effectiveGmailUser || !effectiveGmailPassword) {
    throw new Error('Gmail username or 16-character App Password missing. Check data/settings.json or GMAIL_USER/GMAIL_APP_PASSWORD.');
  }

  console.log(`\n✉️  Delivering Edition #${editionNumber} to ${effectiveRecipient}...`);

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: effectiveGmailUser,
      pass: effectiveGmailPassword,
    },
  });

  const senderTitle = settings.title || 'Personal University';
  const info = await transporter.sendMail({
    from: `"${senderTitle}" <${effectiveGmailUser}>`,
    to: effectiveRecipient,
    subject: `${issue.title} — ${issue.date} (Edition #${issue.editionNumber})`,
    html: htmlContent,
  });

  console.log(`✅ Email sent successfully! Message ID: ${info.messageId}`);

  // Record dispatch in history archive
  history.push(issue);
  writeJson(HISTORY_FILE, history);
  console.log(`💾 Recorded Edition #${editionNumber} to data/dispatch_history.json (Total archived: ${history.length})`);
  console.log('\n✨ Dispatch cycle completed successfully.');
}

main().catch((err) => {
  console.error('\n❌ Dispatch Error:', err.message);
  process.exit(1);
});
