import type {OutputIntensityConfig, OutputPatternKind} from './configTypes';
import clamp from './clamp';

export const DEFAULT_INTENSITY = {
    min: 0,
    max: 1,
    curve: 1,
    pattern: 'steady' as OutputPatternKind,
    patternSpeed: 1,
};

/** Below this the output is treated as fully off, so floors and patterns never wake an idle toy. */
const ACTIVE_THRESHOLD = 0.001;

/** Cheap deterministic hash in [0, 1) so random-looking patterns are stable across calls. */
function hash01(n: number): number {
    const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
    return x - Math.floor(x);
}

function smoothstep(t: number): number {
    return t * t * (3 - 2 * t);
}

/** Pattern multiplier in [0, 1] for a phase measured in seconds (already scaled by speed). */
export function patternValue(pattern: OutputPatternKind, seconds: number): number {
    switch (pattern) {
        case 'pulse': {
            // ~1.2 Hz on/off with a soft floor so it reads as pulsing, not stuttering.
            const t = (seconds * 1.2) % 1;
            return t < 0.5 ? 1 : 0.15;
        }
        case 'wave': {
            // Slow swell between 25% and 100%.
            return 0.625 + 0.375 * Math.sin(seconds * Math.PI * 2 * 0.35);
        }
        case 'heartbeat': {
            // Lub-dub at ~70 bpm.
            const t = (seconds * 1.15) % 1;
            if (t < 0.12) return 1;
            if (t < 0.22) return 0.2;
            if (t < 0.32) return 0.8;
            return 0.1;
        }
        case 'fireworks': {
            // Random bursts that ramp up then pop.
            const segment = Math.floor(seconds / 0.45);
            const t = (seconds / 0.45) - segment;
            const peak = 0.35 + 0.65 * hash01(segment);
            return t < 0.7 ? peak * smoothstep(t / 0.7) : 0.1;
        }
        case 'earthquake': {
            // Fast, heavy rumble that wanders between 50% and 100%.
            const segment = Math.floor(seconds / 0.12);
            const t = (seconds / 0.12) - segment;
            const a = 0.5 + 0.5 * hash01(segment);
            const b = 0.5 + 0.5 * hash01(segment + 1);
            return a + (b - a) * smoothstep(t);
        }
        case 'steady':
        default:
            return 1;
    }
}

/**
 * Apply the per-output response curve, min/max window and optional pattern to a 0-1 level.
 * Returns 0 for inactive input so idle outputs stay idle.
 */
export function shapeIntensity(level: number, config: OutputIntensityConfig | undefined, nowMs: number): number {
    const input = clamp(level, 0, 1);
    if (input <= ACTIVE_THRESHOLD) return 0;
    const max = clamp(config?.max ?? DEFAULT_INTENSITY.max, 0, 1);
    const min = clamp(config?.min ?? DEFAULT_INTENSITY.min, 0, max);
    const curve = clamp(config?.curve ?? DEFAULT_INTENSITY.curve, 0.2, 5);
    const speed = clamp(config?.patternSpeed ?? DEFAULT_INTENSITY.patternSpeed, 0.1, 5);
    const pattern = config?.pattern ?? DEFAULT_INTENSITY.pattern;
    const shaped = min + (max - min) * Math.pow(input, curve);
    return clamp(shaped * patternValue(pattern, (nowMs / 1000) * speed), 0, 1);
}

export function isDefaultIntensity(config: OutputIntensityConfig | undefined): boolean {
    if (!config) return true;
    return (config.min ?? 0) === 0
        && (config.max ?? 1) === 1
        && (config.curve ?? 1) === 1
        && (config.pattern ?? 'steady') === 'steady';
}
