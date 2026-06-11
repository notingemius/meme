// ============================================================================
// Deck store — persistent deck on /data volume.
// ----------------------------------------------------------------------------
// On first start seeds from the hardcoded deck.ts + expanded content.
// Stores as /data/deck.json. Provides CRUD + the getDeck() accessor used by
// the room manager and the /api/deck endpoint.
// ============================================================================

import fs from 'node:fs';
import path from 'node:path';
import { MEME_CARDS, SITUATIONS, type MemeCard, type Situation } from './engine';

export type Category = {
  id: string;
  name_ua: string;
  name_ru: string;
};

export type SituationWithCategory = Situation & { category?: string };

export type DeckFile = {
  memes: MemeCard[];
  situations: SituationWithCategory[];
  categories: Category[];
};

const DATA_DIR = process.env.DATA_DIR || '/data';
const DECK_PATH = path.join(DATA_DIR, 'deck.json');

// In-memory cache (loaded once on startup, mutated by admin endpoints).
let deckCache: DeckFile | null = null;

// --- Categories -------------------------------------------------------------
const CATEGORIES: Category[] = [
  { id: 'general', name_ua: 'Загальне', name_ru: 'Общее' },
  { id: 'films', name_ua: 'Фільми', name_ru: 'Фильмы' },
  { id: 'work', name_ua: 'Робота', name_ru: 'Работа' },
  { id: 'absurd', name_ua: 'Абсурд', name_ru: 'Абсурд' },
];

// --- New memes (single-image emotion/reaction memes from imgflip) -----------
const NEW_MEMES: MemeCard[] = [
  { id: 201, title: "Sad Pablo Escobar", image_url: "https://i.imgflip.com/27fna4.jpg" },
  { id: 202, title: "Surprised Pikachu", image_url: "https://i.imgflip.com/2kbn1e.jpg" },
  { id: 203, title: "Kombucha Girl", image_url: "https://i.imgflip.com/3l46i9.jpg" },
  { id: 204, title: "Side Eyeing Chloe", image_url: "https://i.imgflip.com/1mw9lv.jpg" },
  { id: 205, title: "Blinking Guy (Drew Scanlon)", image_url: "https://i.imgflip.com/1w7yia.jpg" },
  { id: 206, title: "Awkward Look Monkey Puppet", image_url: "https://i.imgflip.com/2gnnjh.jpg" },
  { id: 207, title: "Screaming Woman (Real Housewives)", image_url: "https://i.imgflip.com/3lk1em.jpg" },
  { id: 208, title: "Man Looking Back (Distracted)", image_url: "https://i.imgflip.com/1ur9b0.jpg" },
  { id: 209, title: "Thumbs Up Crying Cat", image_url: "https://i.imgflip.com/3b72w.jpg" },
  { id: 210, title: "Math Lady / Confused Woman", image_url: "https://i.imgflip.com/1pnlxf.jpg" },
  { id: 211, title: "John Cena Are You Sure", image_url: "https://i.imgflip.com/52l9eq.jpg" },
  { id: 212, title: "Thanos Impossible", image_url: "https://i.imgflip.com/39dy1w.jpg" },
  { id: 213, title: "Oprah Giving Away", image_url: "https://i.imgflip.com/pfmz4.jpg" },
  { id: 214, title: "Baby Yoda (Grogu)", image_url: "https://i.imgflip.com/3si4fk.jpg" },
  { id: 215, title: "Kevin Hart Face", image_url: "https://i.imgflip.com/1bfuu.jpg" },
  { id: 216, title: "Dog In Fire (This Is Fine Dog)", image_url: "https://i.imgflip.com/4acd7j.png" },
  { id: 217, title: "Michael Scott No", image_url: "https://i.imgflip.com/t4m1s.jpg" },
  { id: 218, title: "Cat Vibing", image_url: "https://i.imgflip.com/4dw5fc.jpg" },
  { id: 219, title: "Pedro Pascal Crying/Laughing", image_url: "https://i.imgflip.com/7sin2x.jpg" },
  { id: 220, title: "Mr Incredible Becoming Uncanny", image_url: "https://i.imgflip.com/5vlgbc.jpg" },
  { id: 221, title: "Doge Bonk", image_url: "https://i.imgflip.com/4ps33l.jpg" },
  { id: 222, title: "Dog Side Eye", image_url: "https://i.imgflip.com/7fhfwi.png" },
  { id: 223, title: "Sleeping Shaq", image_url: "https://i.imgflip.com/29e5c1.jpg" },
  { id: 224, title: "Old Man Yells At Cloud (Simpsons)", image_url: "https://i.imgflip.com/2044sa.jpg" },
  { id: 225, title: "All My Homies Hate", image_url: "https://i.imgflip.com/3ykkjc.jpg" },
  { id: 226, title: "Spider-Man Desk (Bored)", image_url: "https://i.imgflip.com/3bbhbr.jpg" },
  { id: 227, title: "Markiplier E", image_url: "https://i.imgflip.com/2dtx93.jpg" },
  { id: 228, title: "Panik Kalm Panik Guy", image_url: "https://i.imgflip.com/3qqcim.png" },
  { id: 229, title: "Jojo To Be Continued", image_url: "https://i.imgflip.com/1x85k3.jpg" },
  { id: 230, title: "Tom and Jerry Sneaking", image_url: "https://i.imgflip.com/3t0q3l.jpg" },
  { id: 231, title: "Cat Newspaper (I Should Buy A Boat)", image_url: "https://i.imgflip.com/c7e.jpg" },
  { id: 232, title: "Patrick Smart Dumb", image_url: "https://i.imgflip.com/1hc3ij.jpg" },
  { id: 233, title: "John Travolta Confused (Pulp Fiction)", image_url: "https://i.imgflip.com/12k4g0.jpg" },
  { id: 234, title: "Its Evolving Just Backwards", image_url: "https://i.imgflip.com/3k4w1z.jpg" },
  { id: 235, title: "Woman Math (Calculating)", image_url: "https://i.imgflip.com/56v311.jpg" },
  { id: 236, title: "Will Smith Slap", image_url: "https://i.imgflip.com/6e69tg.jpg" },
  { id: 237, title: "Sad Hamster", image_url: "https://i.imgflip.com/7yk49q.jpg" },
  { id: 238, title: "SpongeBob Confident (Smirk)", image_url: "https://i.imgflip.com/1q1eui.jpg" },
  { id: 239, title: "Pepe Silvia (Charlie Day)", image_url: "https://i.imgflip.com/2by8z8.jpg" },
  { id: 240, title: "Disappointed Cricket Fan", image_url: "https://i.imgflip.com/3mkotw.jpg" },
  { id: 241, title: "Disaster Girl (Fire)", image_url: "https://i.imgflip.com/23ls.jpg" },
  { id: 242, title: "White Cat Table", image_url: "https://i.imgflip.com/3vfrmx.jpg" },
  { id: 243, title: "Tom (Jerry) Reading Newspaper", image_url: "https://i.imgflip.com/2kk0qd.jpg" },
  { id: 244, title: "Distressed Fumino", image_url: "https://i.imgflip.com/3e0e3p.jpg" },
  { id: 245, title: "Mike Wazowski Face Swap", image_url: "https://i.imgflip.com/3rz3r8.jpg" },
  { id: 246, title: "Dog Flashbacks (PTSD)", image_url: "https://i.imgflip.com/39791a.jpg" },
  { id: 247, title: "Elmo Nuclear", image_url: "https://i.imgflip.com/7nnpqf.jpg" },
  { id: 248, title: "Squidward Looking Out Window", image_url: "https://i.imgflip.com/145qvv.jpg" },
  { id: 249, title: "Pingu Noot Noot", image_url: "https://i.imgflip.com/2qmjxs.jpg" },
  { id: 250, title: "Fine I'll Do It Myself (Thanos)", image_url: "https://i.imgflip.com/2c9epi.jpg" },
  { id: 251, title: "Crying Jordan", image_url: "https://i.imgflip.com/3umls.jpg" },
  { id: 252, title: "Monkey Looking Away", image_url: "https://i.imgflip.com/5c7lwq.png" },
  { id: 253, title: "Patrick Star Shocked", image_url: "https://i.imgflip.com/4nfrhf.jpg" },
  { id: 254, title: "Cat Banana", image_url: "https://i.imgflip.com/3px72q.jpg" },
  { id: 255, title: "Yelling At Phone (Shrek)", image_url: "https://i.imgflip.com/4b3bkr.jpg" },
];

// --- New situations with categories -----------------------------------------
const NEW_SITUATIONS: SituationWithCategory[] = [
  // Films category
  { id: 121, text_ua: "Коли дивишся фільм і вже з перших хвилин знаєш хто вбивця", text_ru: "Когда смотришь фильм и с первых минут знаешь кто убийца", category: "films" },
  { id: 122, text_ua: "Моя реакція коли в фільмі кажуть 'розділимось'", text_ru: "Моя реакция когда в фильме говорят 'разделимся'", category: "films" },
  { id: 123, text_ua: "Коли герой фільму не чує вбивцю за спиною", text_ru: "Когда герой фильма не слышит убийцу за спиной", category: "films" },
  { id: 124, text_ua: "Я дивлюсь трейлер нового сіквелу моєї улюбленої франшизи", text_ru: "Я смотрю трейлер нового сиквела моей любимой франшизы", category: "films" },
  { id: 125, text_ua: "Коли персонаж серіалу помирає а потім повертається", text_ru: "Когда персонаж сериала умирает а потом возвращается", category: "films" },
  { id: 126, text_ua: "Моя реакція на пост-кредитну сцену Marvel", text_ru: "Моя реакция на пост-кредитную сцену Marvel", category: "films" },
  { id: 127, text_ua: "Коли в фільмі жахів дівчина біжить і падає", text_ru: "Когда в фильме ужасов девушка бежит и падает", category: "films" },
  { id: 128, text_ua: "Я пояснюю друзям хронологію всесвіту Marvel", text_ru: "Я объясняю друзьям хронологию вселенной Marvel", category: "films" },
  { id: 129, text_ua: "Коли в кіно поруч хтось коментує кожну сцену", text_ru: "Когда в кино рядом кто-то комментирует каждую сцену", category: "films" },
  { id: 130, text_ua: "Моя реакція коли улюблений серіал скасували", text_ru: "Моя реакция когда любимый сериал отменили", category: "films" },
  { id: 131, text_ua: "Коли намагаєшся не заплакати на фіналі фільму в кінотеатрі", text_ru: "Когда пытаешься не заплакать на финале фильма в кинотеатре", category: "films" },
  { id: 132, text_ua: "Я після марафону з 8 годин серіалу о 4 ранку", text_ru: "Я после марафона из 8 часов сериала в 4 утра", category: "films" },
  // Work category
  { id: 133, text_ua: "Коли на зустрічі кажуть 'це можна було б написати в листі'", text_ru: "Когда на встрече говорят 'это можно было написать в письме'", category: "work" },
  { id: 134, text_ua: "Моя реакція на 'у нас тут невеличка зміна в ТЗ'", text_ru: "Моя реакция на 'у нас тут небольшое изменение в ТЗ'", category: "work" },
  { id: 135, text_ua: "Коли колега каже 'я зараз поділюсь екраном' і у нього відкритий тіндер", text_ru: "Когда коллега говорит 'я сейчас поделюсь экраном' и у него открыт тиндер", category: "work" },
  { id: 136, text_ua: "Я на робочому зумі коли мене питають 'а ти що думаєш?'", text_ru: "Я на рабочем зуме когда меня спрашивают 'а ты что думаешь?'", category: "work" },
  { id: 137, text_ua: "Коли бос каже 'нам треба поговорити' без контексту", text_ru: "Когда босс говорит 'нам надо поговорить' без контекста", category: "work" },
  { id: 138, text_ua: "Моє обличчя на ранковому стендапі в понеділок", text_ru: "Моё лицо на утреннем стендапе в понедельник", category: "work" },
  { id: 139, text_ua: "Коли дедлайн був вчора а ти дізнаєшся сьогодні", text_ru: "Когда дедлайн был вчера а ты узнаёшь сегодня", category: "work" },
  { id: 140, text_ua: "Я відповідаю 'все добре' на питання як справи на роботі", text_ru: "Я отвечаю 'всё хорошо' на вопрос как дела на работе", category: "work" },
  { id: 141, text_ua: "Коли п'ятничний деплой зламав продакшн", text_ru: "Когда пятничный деплой сломал продакшн", category: "work" },
  { id: 142, text_ua: "Моя продуктивність в останній день перед відпусткою", text_ru: "Моя продуктивность в последний день перед отпуском", category: "work" },
  { id: 143, text_ua: "Коли менеджер каже 'це на 5 хвилин' а робиш 3 дні", text_ru: "Когда менеджер говорит 'это на 5 минут' а делаешь 3 дня", category: "work" },
  { id: 144, text_ua: "Я перед тим як написати 'з повагою' в злому листі", text_ru: "Я перед тем как написать 'с уважением' в злом письме", category: "work" },
  // Absurd category
  { id: 145, text_ua: "Коли телефон падає на обличчя перед сном", text_ru: "Когда телефон падает на лицо перед сном", category: "absurd" },
  { id: 146, text_ua: "Я коли уявляю себе в паралельному всесвіті де я багатий", text_ru: "Я когда представляю себя в параллельной вселенной где я богат", category: "absurd" },
  { id: 147, text_ua: "Коли намагаєшся відкрити пакетик кетчупу і він вибухає", text_ru: "Когда пытаешься открыть пакетик кетчупа и он взрывается", category: "absurd" },
  { id: 148, text_ua: "Моє тіло коли я лягаю спати і згадую момент з 2015 року", text_ru: "Моё тело когда я ложусь спать и вспоминаю момент из 2015 года", category: "absurd" },
  { id: 149, text_ua: "Коли пилосос засмоктує щось і ти робиш вигляд що не чув", text_ru: "Когда пылесос засасывает что-то и ты делаешь вид что не слышал", category: "absurd" },
  { id: 150, text_ua: "Я коли тостер вистрілює хлібом як з катапульти", text_ru: "Я когда тостер выстреливает хлебом как из катапульты", category: "absurd" },
  { id: 151, text_ua: "Коли дзвінок закінчується і ти кажеш 'до побачення' тричі", text_ru: "Когда звонок заканчивается и ты говоришь 'до свидания' трижды", category: "absurd" },
  { id: 152, text_ua: "Моя реакція коли птах дивиться на мене занадто довго", text_ru: "Моя реакция когда птица смотрит на меня слишком долго", category: "absurd" },
  { id: 153, text_ua: "Коли відкриваєш банку і вона летить під диван", text_ru: "Когда открываешь банку и она летит под диван", category: "absurd" },
  { id: 154, text_ua: "Я і мій мозок о 3 ночі обговорюємо чи існують інопланетяни", text_ru: "Я и мой мозг в 3 ночи обсуждаем существуют ли инопланетяне", category: "absurd" },
  { id: 155, text_ua: "Коли намагаєшся зловити мило в душі а воно тікає", text_ru: "Когда пытаешься поймать мыло в душе а оно убегает", category: "absurd" },
  { id: 156, text_ua: "Моя реакція коли USB вставляється з першого разу", text_ru: "Моя реакция когда USB вставляется с первого раза", category: "absurd" },
];

// --- Seed deck (original + expanded) ----------------------------------------
function buildSeedDeck(): DeckFile {
  // Original situations get 'general' category
  const originalSituations: SituationWithCategory[] = SITUATIONS.map((s) => ({
    ...s,
    category: 'general',
  }));

  return {
    memes: [...MEME_CARDS, ...NEW_MEMES],
    situations: [...originalSituations, ...NEW_SITUATIONS],
    categories: CATEGORIES,
  };
}

// --- Persistence ------------------------------------------------------------
function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function loadFromDisk(): DeckFile | null {
  try {
    if (fs.existsSync(DECK_PATH)) {
      const raw = fs.readFileSync(DECK_PATH, 'utf-8');
      return JSON.parse(raw) as DeckFile;
    }
  } catch (e) {
    console.error('[deck-store] Failed to load deck.json, will re-seed:', e);
  }
  return null;
}

function saveToDisk(deck: DeckFile): void {
  ensureDataDir();
  fs.writeFileSync(DECK_PATH, JSON.stringify(deck, null, 2), 'utf-8');
}

// --- Public API -------------------------------------------------------------
export function loadDeck(): DeckFile {
  if (deckCache) return deckCache;
  const fromDisk = loadFromDisk();
  if (fromDisk) {
    deckCache = fromDisk;
    console.log(`[deck-store] Loaded deck from ${DECK_PATH}: ${fromDisk.memes.length} memes, ${fromDisk.situations.length} situations`);
    return fromDisk;
  }
  // First run: seed and persist
  const seed = buildSeedDeck();
  saveToDisk(seed);
  deckCache = seed;
  console.log(`[deck-store] Seeded deck: ${seed.memes.length} memes, ${seed.situations.length} situations, ${seed.categories.length} categories`);
  return seed;
}

export function getDeck(): DeckFile {
  if (!deckCache) return loadDeck();
  return deckCache;
}

export function addMemes(memes: MemeCard[]): DeckFile {
  const deck = getDeck();
  const existingUrls = new Set(deck.memes.map((m) => m.image_url));
  // Auto-assign id for memes that don't have one; skip duplicates by URL.
  let maxId = deck.memes.reduce((max, m) => Math.max(max, m.id || 0), 0);
  for (const m of memes) {
    if (!m.image_url || existingUrls.has(m.image_url)) continue; // skip dup
    if (!m.id) {
      maxId++;
      m.id = maxId;
    }
    existingUrls.add(m.image_url);
    deck.memes.push(m);
  }
  saveToDisk(deck);
  return deck;
}

export function removeMeme(id: number): DeckFile {
  const deck = getDeck();
  deck.memes = deck.memes.filter((m) => m.id !== id);
  saveToDisk(deck);
  return deck;
}

export function removeMemesByTitle(titles: string[]): { deck: DeckFile; removed: number } {
  const deck = getDeck();
  const titleSet = new Set(titles.map((t) => t.toLowerCase().trim()));
  const before = deck.memes.length;
  deck.memes = deck.memes.filter((m) => !titleSet.has((m.title || '').toLowerCase().trim()));
  saveToDisk(deck);
  return { deck, removed: before - deck.memes.length };
}

export function addSituations(situations: SituationWithCategory[]): DeckFile {
  const deck = getDeck();
  deck.situations.push(...situations);
  saveToDisk(deck);
  return deck;
}

export function removeSituation(id: number): DeckFile {
  const deck = getDeck();
  deck.situations = deck.situations.filter((s) => s.id !== id);
  saveToDisk(deck);
  return deck;
}
