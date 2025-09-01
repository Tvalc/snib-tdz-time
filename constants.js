const GAME_WIDTH = 1600;
const GAME_HEIGHT = 1200;

// Lower the floor to the bottom of the background
const GROUND_Y = GAME_HEIGHT - 28; // Platform height is 28, so ground sits at very bottom

// --- PLAYER SPRITE SIZE ---
// 25% smaller: multiply by 0.75
const PLAYER_WIDTH = 80 * 0.75;   // was 80, now 60
const PLAYER_HEIGHT = 108 * 0.75; // was 108, now 81
const PLAYER_JUMP_VELOCITY = -14;
const PLAYER_MOVE_SPEED = 5.5;

// --- ENLARGE COINBOY SPRITE ---
const COINBOY_WIDTH = 76;   // was 48
const COINBOY_HEIGHT = 92;  // was 58
// --- SLOW DOWN ENEMIES: Reduce walk and roll speed ---
const COINBOY_WALK_SPEED = 1.1; // was 2.2
const COINBOY_ROLL_SPEED = 4.2; // was 8.2
// --- SMOOTHER ANIMATION: Lower walk/roll anim FPS for smoother look ---
const COINBOY_WALK_ANIM_FPS = 7; // was 10
const COINBOY_ROLL_ANIM_FPS = 13; // was 22

// --- SLOW DOWN ATTACK INTERVALS (OPTIONAL, but not required for smoothness) ---
const COINBOY_ATTACK_INTERVAL_MIN = 1.1; // seconds
const COINBOY_ATTACK_INTERVAL_MAX = 3.2; // seconds

// --- ENLARGE DOOMSHROOM SPRITE ---
const DOOMSHROOM_WIDTH = 86;  // was 54
const DOOMSHROOM_HEIGHT = 106; // was 66
// --- SLOW DOWN DOOMSHROOM WALK SPEED ---
const DOOMSHROOM_WALK_SPEED = 0.7; // was 1.45
// --- SMOOTHER ANIMATION: Lower walk/heal anim FPS ---
const DOOMSHROOM_WALK_ANIM_FPS = 6; // was 8
const DOOMSHROOM_HEAL_ANIM_FPS = 6; // was 7
const DOOMSHROOM_HEAL_INTERVAL_MIN = 2.7; // seconds
const DOOMSHROOM_HEAL_INTERVAL_MAX = 5.5; // seconds

// --- ENLARGE ENEMYSHIP SPRITE ---
const ENEMYSHIP_WIDTH = 90;  // was 56
const ENEMYSHIP_HEIGHT = 70; // was 44
// --- SLOW DOWN ENEMYSHIP HORIZONTAL MOVEMENT AND DIVE SPEED ---
const ENEMYSHIP_WALK_SPEED = 1.2; // used for horizontal tracking (not used in code, but for reference)
// --- SMOOTHER ANIMATION: Lower anim FPS ---
const ENEMYSHIP_ANIM_FPS = 7; // was 11

const PLATFORM_HEIGHT = 28;

// --- PLAYER GROUND ALIGNMENT OFFSET ---
// This offset will be added to the player's Y position so their feet align with the ground/platform
// Set to match Coinboy and DoomShroom (0 means feet at platform top), positive moves up
const PLAYER_GROUND_Y_OFFSET = 0; // <-- Feet at platform top

// --- PLAYER SPAWN Y OFFSET ---
// This is the amount to move the player UP when spawning (e.g. 75px higher than normal)
// Set to 75 to move the player up by 75px at spawn/reset
const PLAYER_SPAWN_Y_OFFSET = 75; // <-- Move player up 75px at spawn/reset

window.constants = {
    GAME_WIDTH,
    GAME_HEIGHT,
    GROUND_Y,
    PLAYER_WIDTH,
    PLAYER_HEIGHT,
    PLAYER_JUMP_VELOCITY,
    PLAYER_MOVE_SPEED,
    COINBOY_WIDTH,
    COINBOY_HEIGHT,
    COINBOY_WALK_SPEED,
    COINBOY_ROLL_SPEED,
    COINBOY_WALK_ANIM_FPS,
    COINBOY_ROLL_ANIM_FPS,
    COINBOY_ATTACK_INTERVAL_MIN,
    COINBOY_ATTACK_INTERVAL_MAX,
    DOOMSHROOM_WIDTH,
    DOOMSHROOM_HEIGHT,
    DOOMSHROOM_WALK_SPEED,
    DOOMSHROOM_WALK_ANIM_FPS,
    DOOMSHROOM_HEAL_ANIM_FPS,
    DOOMSHROOM_HEAL_INTERVAL_MIN,
    DOOMSHROOM_HEAL_INTERVAL_MAX,
    ENEMYSHIP_WIDTH,
    ENEMYSHIP_HEIGHT,
    ENEMYSHIP_WALK_SPEED,
    ENEMYSHIP_ANIM_FPS,
    PLATFORM_HEIGHT,
    PLAYER_GROUND_Y_OFFSET, // <-- Feet at platform top
    PLAYER_SPAWN_Y_OFFSET   // <-- Export spawn offset
};