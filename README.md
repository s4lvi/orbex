# Orbital Extraction: Technical Design Document

## 1. Executive Summary

**Game Title:** Orbital Extraction  
**Genre:** Tower Defense / Resource Management  
**Platform:** Mobile Web (Primary: iPhone/Safari), Desktop Web  
**Engine:** Phaser 3.x  
**Target Session Length:** ~10 minutes per drop  
**Deployment:** GitHub Pages (static hosting)

### Core Loop Summary
1. Player selects a planet (3 available, increasing difficulty)
2. Player views 3 randomly generated landing zones and picks one
3. Player drops into tower defense gameplay - place turrets, survive waves
4. Victory: Secure landing zone, extract resources shown in preview
5. Defeat: Lose all resources spent on turrets during that drop
6. Return to landing zone selection with updated resource inventory

---

## 2. Technical Requirements

### 2.1 Mobile/Safari Optimization Priorities
- Touch-first input design with 44px minimum touch targets
- Prevent iOS elastic scrolling/bounce
- Handle iOS audio context unlock (require user interaction before audio)
- Support notched devices with safe area insets
- Target 60fps, minimum acceptable 30fps
- Object pooling for enemies and projectiles
- Pause game when app is backgrounded

### 2.2 Screen Layout
- Base resolution: 1280x720 (16:9 landscape)
- Scale mode: Fit with letterboxing
- Grid: 16 columns × 9 rows of 64px tiles
- UI overlays at top (resources, wave info) and bottom (turret selection)

---

## 3. Resource System

### 3.1 Resource Types

**Basic Resources (3):**
| Resource | Color | Primary Use |
|----------|-------|-------------|
| Ferrite | Brown | Primary building material for turrets |
| Crystite | Blue | Power/energy costs, ammunition |
| Compound | Gray | Structural upgrades, advanced turrets |

**Exotic Resources (5):**
| Resource | Color | Primary Use | Rarity |
|----------|-------|-------------|--------|
| Plasma Core | Magenta | Energy weapon upgrades | Uncommon |
| Neutronium | Dark Gray | Armor-piercing upgrades | Uncommon |
| Thermite Alloy | Orange-Red | Incendiary upgrades | Rare |
| Graviton Shard | Purple | Trap enhancements, slow effects | Rare |
| Dark Matter | Near Black | Ultimate/final tier upgrades | Very Rare |

### 3.2 Resource Flow

**Gaining Resources:**
- Killing enemies awards small bounties (basic resources, rare chance for exotic)
- Completing a landing zone awards the resources shown in the preview
- Small bonus resources between waves

**Spending Resources:**
- Building turrets costs basic resources
- Applying upgrades costs exotic resources
- Placing traps costs basic + sometimes exotic resources

**Risk/Reward:**
- Resources spent during a drop are tracked separately
- Victory: Keep spent resources + gain landing zone rewards
- Defeat: Lose ALL resources spent during that drop (turrets, upgrades, traps)

### 3.3 Interactions with Other Systems
- **Landing Zone Selection**: Previews show estimated resource rewards
- **Turret System**: Each turret type has a resource cost
- **Upgrade System**: Upgrades require exotic resources
- **Wave System**: Enemies drop bounties on death
- **Difficulty**: Higher difficulty zones yield more/better resources

---

## 4. Planet & Landing Zone System

### 4.1 Planets (3 Total)

**Planet 1: Terran Prime (Easy)**
- Base difficulty: 0.3
- Environment: Forest/temperate
- Available enemy types: Drone, Crawler, Scout
- Exotic resources available: Plasma Core only
- Wave count range: 5-10 waves

**Planet 2: Ignis IV (Medium)**
- Base difficulty: 0.6
- Environment: Volcanic
- Available enemy types: Drone, Crawler, Tank, Scout, Bomber
- Exotic resources available: Plasma Core, Thermite Alloy, Neutronium
- Wave count range: 8-15 waves

**Planet 3: Void Station X-7 (Hard)**
- Base difficulty: 0.9
- Environment: Space station interior
- Available enemy types: All 8 enemy types
- Exotic resources available: All 5 exotic types
- Wave count range: 12-20 waves

### 4.2 Landing Zone Generation

When player selects a planet, generate 3 landing zone options. Each has:

**Map Generation:**
- Number of paths: 1-4 (more paths = higher difficulty)
- Path complexity: Random waypoints between entry and exit
- Paths enter from left edge, exit to base on right edge
- Buildable tiles: All tiles not occupied by or adjacent to paths

**Difficulty Calculation:**
- Start with planet's base difficulty
- Add variance (±0.2 random)
- Modify by path count (+0.15 per path beyond first)
- Modify by average path length (shorter = harder)
- Clamp to 0.1 - 1.0 range

**Resource Rewards:**
- Scale basic resources by difficulty multiplier
- Higher difficulty = higher chance of exotic resources
- Display exact rewards in landing zone preview

**Wave Configuration:**
- Select a wave pattern (Standard, Swarm, or Elite)
- Calculate wave count based on difficulty
- Determine which enemy types from planet's pool will appear

### 4.3 Wave Patterns

| Pattern | Base Enemies | Spawn Speed | Description |
|---------|--------------|-------------|-------------|
| Standard | 8 | Medium (1s interval) | Balanced waves |
| Swarm | 15 | Fast (0.5s interval) | Many weak enemies |
| Elite | 4 | Slow (2s interval) | Few strong enemies |

### 4.4 Landing Zone Preview Display
Show the player:
- Mini-map with paths visualized
- Difficulty percentage (e.g., "67%")
- Resource rewards (icons + amounts)
- Enemy types that will appear (icons)
- Wave count and pattern name
- "DROP" button to select

### 4.5 Interactions with Other Systems
- **Resource System**: Determines rewards for completion
- **Wave System**: Provides wave configuration
- **Map Generator**: Creates path layouts
- **Enemy System**: Determines which enemies can spawn
- **Difficulty**: Affects enemy stats scaling

---

## 5. Turret System

### 5.1 Turret Types (7)

| Turret | Damage Type | Targets | Key Stats | Role |
|--------|-------------|---------|-----------|------|
| Machine Gun | Basic | Ground + Air | High fire rate, low damage | Cheap all-rounder |
| Railgun | Armor Piercing | Ground only | Very high damage, very slow, penetrates multiple enemies | Anti-armor |
| Artillery | Explosive | Ground only | AOE splash damage, long range, slow | Crowd control |
| Rocket | Explosive | Ground + Air | Homing projectiles, medium stats | Versatile damage |
| Missile | Explosive | Air priority | Fires volleys, strong vs air | Anti-air specialist |
| Laser | Energy | Ground + Air | Instant hit beam, sustained damage | Consistent DPS |
| Plasma | Energy | Ground only | High damage + burn DOT | Damage over time |

### 5.2 Turret Stats Explained

- **Damage**: Base damage per hit/tick
- **Rate of Fire**: Attacks per second (or DPS for laser)
- **Range**: Detection and attack radius in pixels
- **Turn Speed**: How fast turret rotates to track targets (degrees/sec)
- **Projectile Speed**: How fast projectiles travel (instant for laser)
- **Splash Radius**: AOE damage radius (artillery, rocket, missile)
- **Tracking**: Homing strength for guided projectiles
- **Penetration**: Number of enemies a projectile passes through (railgun)

### 5.3 Turret Placement Rules
- Can only place on buildable tiles (not on/adjacent to paths)
- One turret per tile
- Turret costs deducted immediately on placement
- Can sell turrets for partial refund (50%?)
- Tapping occupied tile opens upgrade menu

### 5.4 Targeting Behavior
- Default: Target closest enemy in range
- Respect target type restrictions (ground-only turrets ignore air)
- Continuously re-evaluate targets
- Lead targets based on projectile speed and enemy velocity

### 5.5 Interactions with Other Systems
- **Resource System**: Costs resources to build
- **Upgrade System**: Can receive upgrades
- **Damage System**: Deals damage to enemies
- **Enemy System**: Targets and attacks enemies
- **UI System**: Build menu, upgrade menu, range preview

---

## 6. Upgrade System

### 6.1 Upgrade Philosophy
- Upgrades are applied to INDIVIDUAL turrets, not globally
- Each upgrade costs exotic resources
- Upgrades modify turret stats or add new effects
- Some upgrades change the turret's damage type

### 6.2 Upgrade Categories

**Fire Rate Upgrades:**
- Rapid Fire Module: +50% fire rate
- Overcharge: +100% fire rate, turret takes damage over time

**Damage Upgrades:**
- Heavy Caliber: +30% damage
- Focused Beam (laser): +50% DPS, reduced range

**Damage Type Conversion:**
- AP Rounds: Convert to armor-piercing damage
- Incendiary Payload: Add burn DOT effect
- Plasma Infusion: Convert to energy damage

**Utility Upgrades:**
- Extended Range: +40% range
- Advanced Targeting: Prioritize high-value targets
- Multi-shot: Hit additional targets (reduced damage each)

### 6.3 Upgrade Restrictions
- Each turret type has a list of compatible upgrades
- Some upgrades are mutually exclusive
- Maximum 2-3 upgrades per turret

### 6.4 Interactions with Other Systems
- **Resource System**: Costs exotic resources
- **Turret System**: Modifies turret stats and behavior
- **Damage System**: Can change damage types and effects
- **UI System**: Upgrade menu interface

---

## 7. Trap System

### 7.1 Trap Concept
- Traps are placed ON path tiles (unlike turrets)
- Trigger when enemies walk over them
- Apply effects or damage to enemies
- Limited uses or cooldown-based

### 7.2 Trap Types

| Trap | Effect | Uses | Cooldown | Cost Tier |
|------|--------|------|----------|-----------|
| Spike Trap | Instant damage | 5 uses | None | Basic |
| Slow Field | 50% slow for 3s | Infinite | 2s | Basic |
| Stun Mine | 1.5s stun | 3 uses | None | Basic + Exotic |
| Gravity Well | Pulls enemies to center, massive slow | Infinite | 8s | Exotic |
| Napalm Patch | DOT fire damage zone | 10s duration | None | Basic + Exotic |

### 7.3 Trap Placement Rules
- Can only place on path tiles
- Multiple traps can occupy same tile
- Some traps are consumed on use, others have cooldowns
- Traps trigger for ALL enemies passing through

### 7.4 Interactions with Other Systems
- **Resource System**: Costs resources to place
- **Enemy System**: Affects enemy movement and health
- **Damage System**: Some traps deal damage
- **Path System**: Must be placed on valid path tiles

---

## 8. Enemy System

### 8.1 Enemy Categories

**Ground Enemies (4):**

| Enemy | Health | Speed | Armor | Special |
|-------|--------|-------|-------|---------|
| Drone | Low (40) | Fast (80) | None | Basic swarm unit |
| Crawler | Medium (100) | Medium (60) | Light (10) | 25% basic resistance |
| Tank | High (400) | Slow (35) | Heavy (25) | 50% basic, 25% explosive resistance |
| Burrower | Medium (80) | Medium (70) | Low (5) | Teleports forward periodically |

**Air Enemies (4):**

| Enemy | Health | Speed | Armor | Special |
|-------|--------|-------|-------|---------|
| Scout | Low (30) | Very Fast (150) | None | Fastest enemy |
| Bomber | Medium (150) | Medium (50) | Light (10) | Spawns 3 drones on death |
| Carrier | High (250) | Slow (40) | Medium (15) | Spawns 2 drones every 5 seconds |
| Striker | Medium (70) | Fast (100) | Low (5) | 50% explosive resistance, 20% evasion |

### 8.2 Enemy Stats Explained

- **Health**: Hit points, scaled by zone difficulty
- **Speed**: Pixels per second along path
- **Armor**: Flat damage reduction (except vs armor-piercing)
- **Resistances**: Percentage damage reduction from specific types
- **Vulnerabilities**: Percentage damage INCREASE from specific types

### 8.3 Resistance/Vulnerability Table

| Enemy | Basic | Armor Pierce | Explosive | Incendiary | Energy |
|-------|-------|--------------|-----------|------------|--------|
| Drone | - | - | - | - | - |
| Crawler | 25% resist | 30% vuln | - | - | - |
| Tank | 50% resist | 50% vuln | 25% resist | - | 20% vuln |
| Burrower | - | - | 30% vuln | - | - |
| Scout | - | - | - | - | - |
| Bomber | - | - | 20% vuln | - | 25% resist |
| Carrier | 25% resist | 30% vuln | - | - | - |
| Striker | - | - | 50% resist | - | 30% vuln |

### 8.4 Enemy Abilities

**Teleport (Burrower):**
- Every 8 seconds, jump forward along path
- Skip approximately 100 pixels of path
- Brief visual indicator before teleport

**Death Spawn (Bomber):**
- On death, spawn 3 Drones at current position
- Drones continue along same path from that point

**Periodic Spawn (Carrier):**
- Every 5 seconds while alive, spawn 2 Drones
- Drones spawn at Carrier's current position

**Evasion (Striker):**
- 20% chance to completely dodge any attack
- Visual "miss" indicator when evaded

### 8.5 Enemy Movement
- Follow path waypoints using linear interpolation
- Rotate to face movement direction
- Speed modified by status effects (slow, stun)
- When reaching base: Deal 1 damage to base, despawn

### 8.6 Enemy Scaling
- Health scales with zone difficulty (health × difficulty multiplier)
- Armor scales with zone difficulty
- Speed remains constant
- Bounties scale slightly with difficulty

### 8.7 Interactions with Other Systems
- **Path System**: Enemies follow generated paths
- **Damage System**: Take damage from turrets, apply resistances
- **Wave System**: Spawned according to wave configuration
- **Trap System**: Trigger traps, receive status effects
- **Resource System**: Award bounties on death
- **Base Health**: Deal damage when reaching end

---

## 9. Damage System

### 9.1 Damage Types (5)

| Type | Color | Behavior |
|------|-------|----------|
| Basic | Gray | Standard damage, reduced by armor |
| Armor Piercing | Steel Blue | Ignores armor completely |
| Explosive | Red | AOE splash damage, reduced by armor |
| Incendiary | Orange | Applies burn DOT, reduced by armor |
| Energy | Cyan | Standard damage, reduced by armor |

### 9.2 Damage Calculation Flow

```
1. Start with base damage from turret
2. Check if target has RESISTANCE to damage type
   → If yes: damage = damage × (1 - resistance%)
3. Check if target has VULNERABILITY to damage type
   → If yes: damage = damage × (1 + vulnerability%)
4. Apply armor reduction (unless armor-piercing)
   → damage = max(1, damage - armor)
5. Apply final damage to enemy health
```

### 9.3 Special Damage Mechanics

**Splash Damage (Explosive):**
- Full damage at impact point
- Damage falls off with distance (50% at edge of radius)
- Affects all enemies in radius

**Burn DOT (Incendiary):**
- Apply burn status effect on hit
- Deals X damage every 0.5 seconds
- Lasts for specified duration
- Multiple burns refresh duration (don't stack damage)

**Penetration (Railgun):**
- Projectile continues through enemies
- Each penetration reduces damage by 20%
- Maximum 3 penetrations

**Beam (Laser):**
- No projectile, instant hit
- Deals damage per second while beam active
- Brief warmup time before firing

### 9.4 Interactions with Other Systems
- **Turret System**: Receives damage values and types from turrets
- **Enemy System**: Applies damage to enemies, checks resistances
- **Upgrade System**: Upgrades can modify damage types and values
- **Trap System**: Traps use damage system for damage traps

---

## 10. Wave System

### 10.1 Wave Structure

Each wave consists of:
- Pre-wave delay (time before spawning starts)
- Spawn queue (list of enemies with spawn delays)
- Inter-spawn delay (time between each enemy)

### 10.2 Wave Generation

When landing zone is selected, waves are pre-generated:

```
For each wave (1 to totalWaves):
  1. Calculate wave progress (0.0 to 1.0)
  2. Determine enemy count based on pattern + progress + difficulty
  3. Determine enemy composition based on progress:
     - Early waves (0-30%): 80% basic, 20% medium enemies
     - Mid waves (30-60%): 50% basic, 30% medium, 20% tough
     - Late waves (60-100%): 30% basic, 30% medium, 25% tough, 15% elite
  4. Assign enemies to random paths (if multiple paths)
  5. Shuffle spawn order for variety
```

### 10.3 Wave Progression

- Waves start automatically after brief delay
- Next wave begins 3-5 seconds after previous wave cleared
- "Wave cleared" = all enemies from that wave defeated
- Player CAN build during waves (no forced build phase)

### 10.4 Wave Completion Conditions

**Wave Complete:**
- All enemies from current wave are dead
- Triggers small resource bonus
- Brief pause, then next wave

**All Waves Complete (Victory):**
- Player survives final wave
- Landing zone secured
- Award preview resources
- Return to map select

**Base Destroyed (Defeat):**
- Base health reaches 0
- Lose all resources spent this drop
- Return to map select

### 10.5 Interactions with Other Systems
- **Enemy System**: Spawns enemies according to schedule
- **Landing Zone System**: Receives wave configuration
- **Resource System**: Awards between-wave bonuses
- **Game State**: Tracks victory/defeat conditions

---

## 11. Path System

### 11.1 Path Generation

**Entry Points:**
- Always on left edge of map
- Distributed vertically based on path count
- Example: 2 paths → entries at 1/3 and 2/3 height

**Exit Point:**
- Always on right edge, vertically centered
- All paths converge to same exit (the base)

**Waypoint Generation:**
- Each path has 3-5 waypoints between entry and exit
- Waypoints have random Y variance
- X positions evenly distributed
- Waypoints clamped to stay within map bounds

**Path Smoothing:**
- Add midpoints between waypoints for smoother movement
- Convert grid coordinates to world pixel coordinates

### 11.2 Buildable Area Calculation

After paths generated:
1. Mark all tiles containing path waypoints as blocked
2. Mark all tiles adjacent to path tiles as blocked
3. All remaining interior tiles are buildable
4. Edge tiles (row 0, last row, column 0, last column) reserved for UI/entry/exit

### 11.3 Interactions with Other Systems
- **Enemy System**: Provides paths for enemy movement
- **Turret System**: Determines valid placement tiles
- **Trap System**: Path tiles are valid for trap placement
- **Landing Zone**: Paths affect difficulty calculation

---

## 12. Base Health System

### 12.1 Base Mechanics
- Starting health: 20 HP
- Each enemy reaching the end: -1 HP
- No way to heal during a drop
- Visual representation: Health bar in UI, base structure on right side of map

### 12.2 Interactions with Other Systems
- **Enemy System**: Enemies deal damage when reaching base
- **Wave System**: Base destruction triggers defeat
- **UI System**: Health bar display

---

## 13. UI System

### 13.1 Screen Flow

```
Main Menu → Planet Select → Landing Zone Select → Gameplay → Results
                                    ↑                           │
                                    └───────────────────────────┘
```

### 13.2 Main Menu Screen
- Title/logo
- "New Game" button → Planet Select
- "Options" button → Settings (volume, etc.)

### 13.3 Planet Select Screen
- 3 planet cards displayed horizontally
- Each shows: Name, difficulty label, environment preview, available resource types
- Tap to select → Landing Zone Select

### 13.4 Landing Zone Select Screen
- 3 landing zone option cards
- Each card shows:
  - Mini-map preview with paths visualized
  - Difficulty percentage
  - Resource rewards (icons + amounts)
  - Enemy type icons
  - Wave count and pattern name
- "DROP" button on each card
- "Back" button to planet select

### 13.5 Game HUD (During Gameplay)

**Top Bar:**
- Basic resource counts with icons
- Wave counter ("Wave 3/12")
- Base health bar

**Bottom Bar:**
- 7 turret quick-select buttons
- Each shows: turret icon, cost, grayed if unaffordable
- Selected turret highlighted
- Keyboard shortcuts 1-7 on desktop

**Contextual Elements:**
- Range preview circle when placing turret
- Turret upgrade panel when tapping existing turret
- "Insufficient resources" feedback
- Wave start/complete notifications

### 13.6 Build/Upgrade Menus

**Build Menu (tap empty tile):**
- Grid of available turrets
- Each shows: icon, name, cost
- Unaffordable items grayed out
- Tap to build, tap outside to cancel

**Upgrade Menu (tap existing turret):**
- Current turret stats display
- List of available upgrades with costs
- Sell button with refund amount
- Tap upgrade to apply, tap outside to close

### 13.7 Speed Controls
- Pause button
- 1× speed (normal)
- 2× speed (fast forward)
- Accessible during gameplay, top corner

### 13.8 Results Screen

**Victory Version:**
- "ZONE SECURED" header
- Resources gained breakdown
- Mission stats (kills, waves, turrets)
- "Continue" button

**Defeat Version:**
- "EXTRACTION FAILED" header
- Resources lost breakdown
- Progress stats
- "Continue" button

---

## 14. Game State Management

### 14.1 Persistent State (Session)
- Total resources (all 8 types)
- Selected planet

### 14.2 Per-Drop State (Reset each landing)
- Resources spent this drop (for defeat penalty)
- Placed turrets (positions, types, upgrades)
- Placed traps
- Current wave number
- Base health
- Active enemies

### 14.3 Future: Save System
- LocalStorage for persistence between browser sessions
- Save: resource totals, unlocks
- Not implementing in initial version

---

## 15. Audio Design

### 15.1 Sound Effects Needed
- Turret firing (7 unique sounds)
- Enemy death (general + special for large enemies)
- Building placed
- Upgrade applied
- Wave start chime
- Wave complete chime
- Base damage warning
- Victory fanfare
- Defeat sting
- UI button clicks

### 15.2 Music
- Menu theme (ambient, spacey)
- Gameplay theme (tense, building intensity)
- Victory theme (triumphant)
- Defeat theme (somber)

### 15.3 Mobile Audio Notes
- Must handle iOS audio unlock requirement
- Mute when app backgrounded
- Volume controls in options

---

## 16. Visual Feedback

### 16.1 Combat Feedback
- Floating damage numbers
- Enemy hit flash (red tint)
- Turret muzzle flash
- Projectile effects and trails
- Explosion animations
- Laser beam rendering
- Status effect particles (slow = blue, burn = orange)

### 16.2 UI Feedback
- Button hover/press states
- Resource gain "+X" floating text
- Insufficient funds shake
- Range circle (green valid, red invalid)
- Enemy health bars

---

## 17. Performance Targets

### 17.1 Object Limits
- Max enemies: 50 simultaneous
- Max projectiles: 100 simultaneous  
- Max turrets: 20
- Max particles: 500 total

### 17.2 Frame Rate
- Target: 60 fps
- Minimum: 30 fps
- Max frame time: 33ms

### 17.3 Optimization Strategies
- Object pooling for enemies and projectiles
- Texture atlases
- Hybrid approach for off-screen entities: reduce update frequency rather than completely disabling
- Hybrid approach for particles: limit per-effect counts and cull oldest when over budget

---

## 18. Implementation Phases

### Phase 1: Core MVP
- Scene structure (menu → game → results)
- Single hardcoded map, one path
- One turret (machine gun), one enemy (drone)
- Fixed wave spawning
- Basic win/lose conditions
- Simple resource tracking

### Phase 2: Combat Systems
- All 7 turret types
- All 8 enemy types  
- Full damage type system with resistances
- Projectile behaviors (homing, penetration, splash)
- Enemy abilities

### Phase 3: Map & Progression
- Procedural path generation
- Multiple paths support
- Landing zone generation with 3 options
- Planet selection (3 planets)
- Difficulty scaling

### Phase 4: Full Economy
- Complete resource system (8 types)
- Upgrade system
- Trap system
- Risk/reward on defeat

### Phase 5: Polish
- Full UI implementation
- Visual effects
- Audio integration
- Mobile optimization
- Balance tuning

---

## 19. Open Design Questions

1. **Turret Selling**: What refund percentage? 50%? 75%?
2. **Starting Resources**: How much to start first drop? 
3. **Burn Stacking**: Refresh duration only, or stack damage too?
4. **Path Trap Overlap**: One trigger per enemy, or per enemy per path?
5. **Speed Options**: Include 3× speed option?
6. **Planet Unlocks**: All available at start, or unlock with progress?
7. **Difficulty Variance**: How much RNG in landing zone difficulty?

---

## Appendix A: Data File Structures

### turrets.json
Each turret entry needs:
- id, name, description
- damageType
- targetTypes (array: "ground", "air")
- baseStats (damage, rateOfFire, range, turnSpeed, projectileSpeed, etc.)
- cost (basic resource amounts)
- compatibleUpgrades (array of upgrade ids)
- visual/audio asset keys

### enemies.json
Each enemy entry needs:
- id, name
- movementType ("ground" or "air")
- baseStats (health, speed, armor)
- bounty (resource amounts)
- resistances (damage type → percentage)
- vulnerabilities (damage type → percentage)
- abilities (array of ability definitions)
- visual/audio asset keys

### upgrades.json
Each upgrade entry needs:
- id, name, description
- applicableTo (array of turret ids)
- effects (stat modifications)
- cost (exotic resource amounts)
- mutuallyExclusiveWith (array of upgrade ids)

### planets.json
Each planet entry needs:
- id, name, description
- baseDifficulty
- environment theme
- availableEnemyTypes (array)
- availableExoticResources (array)
- waveCountRange (min, max)
- resourceMultiplier

### traps.json
Each trap entry needs:
- id, name, description
- effectType (damage, slow, stun, etc.)
- effectValue
- uses (-1 for infinite)
- cooldown
- cost
- visual/audio asset keys

---

*Document Version: 1.0*  
*Last Updated: January 2025*
