module.exports = [
  {
    id: 'classic',
    name: 'Classic',
    icon: '⚽',
    rarity: 'Common',
    description: 'A regular ball.',
    stats: { health: 600, speed: 4.0, damage: 1.0, size: 42 },
    colors: { primary: '#d4d4d4', secondary: '#888888', glow: '#ffffff', trail: '#cccccc' },
    special: { name: 'Steady', desc: 'No special ability. Reliable in any matchup.' }
  },
  {
    id: 'fireball',
    name: 'Fire(ball)',
    icon: '🔥',
    rarity: 'Rare',
    description: 'Burns bright and hits hard. Low HP but devastating damage.',
    stats: { health: 450, speed: 5.5, damage: 1.7, size: 38 },
    colors: { primary: '#ff4500', secondary: '#ff8c00', glow: '#ff6600', trail: '#ff4500' },
    special: { name: 'Ignite', desc: 'Deals +30% extra damage on every hit.' }
  },
  {
    id: 'glacier',
    name: 'Ice',
    icon: '🧊',
    rarity: 'Rare',
    description: 'Outlasts opponents through sheer endurance.',
    stats: { health: 840, speed: 2.5, damage: 0.9, size: 46 },
    colors: { primary: '#a8d8ff', secondary: '#00bfff', glow: '#87ceeb', trail: '#00bfff' },
    special: { name: 'Freeze', desc: 'Slows the opponent for 1.5s after each hit.' }
  },
  {
    id: 'thunder',
    name: 'Thunder',
    icon: '⚡',
    rarity: 'Epic',
    description: 'Blink and you\'ll miss it.',
    stats: { health: 360, speed: 7.5, damage: 1.4, size: 35 },
    colors: { primary: '#ffff00', secondary: '#9b59b6', glow: '#ffff00', trail: '#ffee00' },
    special: { name: 'Static Surge', desc: 'Bursts to 2x speed every 4 seconds.' }
  },
  {
    id: 'boulder',
    name: 'Rock',
    icon: '🪨',
    rarity: 'Epic',
    description: 'Slow but nearly unkillable.',
    stats: { health: 1140, speed: 1.8, damage: 0.75, size: 52 },
    colors: { primary: '#8b7355', secondary: '#5c4a32', glow: '#c8a96e', trail: '#8b7355' },
    special: { name: 'Quake', desc: 'Causes screen shake and massive knockback on impact.' }
  },
  {
    id: 'shadow',
    name: 'Shadow',
    icon: '🌑',
    rarity: 'Legendary',
    description: 'Drains life from every blow it lands.',
    stats: { health: 525, speed: 5.2, damage: 1.3, size: 40 },
    colors: { primary: '#6c3483', secondary: '#1a1a2e', glow: '#9b59b6', trail: '#6c3483' },
    special: { name: 'Lifesteal', desc: 'Heals 20% of all damage dealt.' }
  },
  {
    id: 'crystal',
    name: 'Crystal',
    icon: '💎',
    rarity: 'Legendary',
    description: 'Deflects a portion of all damage received.',
    stats: { health: 720, speed: 3.5, damage: 1.0, size: 44 },
    colors: { primary: '#00ffff', secondary: '#ffffff', glow: '#00ffff', trail: '#00e5ff' },
    special: { name: 'Armor', desc: 'Reduces all incoming damage by 25%.' }
  },
  {
    id: 'plasma',
    name: 'Plasma',
    icon: '🔮',
    rarity: 'Legendary',
    description: 'Volatile energy orb. Grows more dangerous as it takes damage.',
    stats: { health: 435, speed: 5.8, damage: 1.5, size: 37 },
    colors: { primary: '#ff00ff', secondary: '#8800ff', glow: '#ff00ff', trail: '#cc00ff' },
    special: { name: 'Overload', desc: 'Damage increases up to 80% as HP decreases.' }
  }
];
