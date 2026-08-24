# Dungeon Maze - Board Game Prototype

Browser-based board game for 2-4 players. Tile-based dungeon exploration with dice-based combat.

## Quick Start

Open `index.html` in a browser. No build step, no server required.

## Game Design

- **Players**: 2-4 local, each controls one hero
- **Objective**: Defeat the final boss
- **Turn Flow**: Draw tile → Rotate → Place tile → Draw encounter → Resolve
- **Combat**: Virtual d20 dice rolls (hero stats vs monster stats)
- **Hero Classes**: Warrior, Wizard, Rogue, Cleric

## Dungeon Tiles

Tiles have directional exits (north, south, west, east) that must connect properly. Players can rotate tiles to change exit directions:
- **Corridor**: Two opposite exits
- **Corner**: Two adjacent exits
- **T-Junction**: Three exits
- **Crossroads**: Four exits
- **Dead End**: One exit
- **Entrance**: Starting tile with all four exits (placed once at game start, gold border)

## File Structure

```
/
├── index.html              # Entry point
├── css/
│   └── styles.css
├── js/
│   └── game.js             # All game logic
├── data/
│   ├── dungeon-cards.json  # Tile definitions (excludes entrance)
│   ├── encounter-cards.json # Monsters, treasures, events
│   └── heroes.json         # Hero class stats
└── AGENTS.md
```

## JSON Data Format

### dungeon-cards.json
```json
[
  {
    "id": "tile-corridor",
    "name": "Corridor",
    "type": "corridor",
    "north": true,
    "south": true,
    "west": false,
    "east": false,
    "exit": false,
    "quantity": 8
  }
]
```

## Development Guidelines

- **No frameworks** - vanilla JS only
- **Data-driven** - all tile/stats in JSON, easy to modify
- **Single file** - game.js contains all logic
- **Naming**: camelCase for JS, kebab-case for files

## Testing

Manual testing in browser console.

## Tile Editing

Edit `/data/dungeon-cards.json` to:
- Add/remove tile types
- Adjust tile quantities
- Modify exit configurations
