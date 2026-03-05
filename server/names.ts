const PREFIXES = [
  "Sir", "Lord", "Big", "Lil", "Hot", "Cold", "Fast", "Slow",
  "Moist", "Crispy", "Fiscal", "Feral", "Royal", "Holy", "Mild",
  "Spicy", "Soggy", "Dusty", "Funky", "Chunky", "Sneaky", "Shady",
  "Absolute", "General", "Captain", "Doctor", "Saint", "Uncle",
  "Baron", "Slightly", "Deeply", "Fully", "Half", "Almost",
  "Barely", "Legally", "Morally", "Technically", "Certified",
];

const MIDDLES = [
  "Thunder", "Glue", "Bean", "Chaos", "Noodle", "Pudding",
  "Tax", "Soup", "Cargo", "Turbo", "Disco", "Velvet",
  "Beef", "Waffle", "Gravy", "Biscuit", "Pickle", "Wobble",
  "Potato", "Cement", "Jazz", "Salad", "Butter", "Panic",
  "Nacho", "Cheddar", "Gravel", "Fungus", "Mango", "Pretzel",
  "Bacon", "Donut", "Taco", "Custard", "Giblet", "Turnip",
  "Yogurt", "Clam", "Sausage", "Crouton", "Anchovy", "Truffle",
];

const SUFFIXES = [
  "Hoof", "Gallop", "Sprint", "Trot", "Dancer", "Prancer",
  "Factory", "Machine", "Express", "Deluxe", "Supreme", "Classic",
  "Legs", "Hooves", "Mane", "Tail", "Shoes", "Bridle",
  "Heir", "Dream", "Vibes", "Energy", "Moment", "Journey",
  "Incident", "Situation", "Unit", "Zone", "Mode", "Protocol",
  "Fiasco", "Disaster", "Miracle", "Mystery", "Legend", "Scandal",
  "Scheme", "Agenda", "Policy", "Audit", "Invoice", "Receipt",
];

const TEMPLATES = [
  // "Adjective Noun" style
  (p: string, m: string, s: string) => `${p} ${m}`,
  // "Noun Suffix" style
  (p: string, m: string, s: string) => `${m} ${s}`,
  // "Prefix Noun Suffix" — 3 word
  (p: string, m: string, s: string) => `${p} ${m} ${s}`,
  // "NounSuffix" smashed together
  (p: string, m: string, s: string) => `${m}${s}`,
];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function generateHorseName(): string {
  let name: string;
  do {
    const template = pick(TEMPLATES);
    name = template(pick(PREFIXES), pick(MIDDLES), pick(SUFFIXES));
  } while (name.length > 18);
  return name;
}

export function generateUniqueNames(count: number, existing: string[] = []): string[] {
  const names = new Set(existing);
  const result: string[] = [];
  let attempts = 0;
  while (result.length < count && attempts < 1000) {
    const name = generateHorseName();
    if (!names.has(name)) {
      names.add(name);
      result.push(name);
    }
    attempts++;
  }
  // Fallback if we somehow can't generate enough unique names
  while (result.length < count) {
    result.push(`Wonk #${result.length + 1}`);
  }
  return result;
}
