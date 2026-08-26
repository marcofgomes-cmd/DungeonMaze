# Dungeon Maze - Board Game Prototype

Browser-based board game for 2-4 players. Tile-based dungeon exploration with dice-based combat.

## Quick Start

Run `start.bat` to launch a local server at `http://localhost:8000`. No build step required.

## Game Design

- **Players**: 2-4 local, each controls one hero
- **Objective**: Defeat the final boss
- **Turn Flow**: Move → Draw room → Rotate → Place → Draw encounter → Resolve
- **Combat**: Virtual d20 dice rolls (hero stats vs monster stats)
- **Hero Classes**: Warrior, Wizard, Rogue, Cleric

## Room Tiles

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
├── start.bat               # Launch local server
├── start.ps1               # PowerShell server script
├── css/
│   └── styles.css
├── js/
│   └── game.js             # All game logic
├── data/
│   ├── room-cards.json     # Room tile definitions (excludes entrance)
│   ├── quests.json         # Quest definitions with encounter decks
│   └── heroes.json         # Hero class stats
└── AGENTS.md
```

## JSON Data Format

### room-cards.json
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

Edit `/data/room-cards.json` to:
- Add/remove tile types
- Adjust tile quantities
- Modify exit configurations
