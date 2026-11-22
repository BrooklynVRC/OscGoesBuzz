import type {LovenseToyState} from '../shared/ipc';

export interface LovenseFunction {
    /** Action name sent to Game Mode, e.g. "Vibrate" or "Vibrate2". */
    action: string;
    /** Highest strength step the action accepts. */
    max: number;
    type: 'vibrate' | 'rotate';
}

const SHORT_NAMES: Record<string, string> = {
    v: 'Vibrate', r: 'Rotate', p: 'Pump', t: 'Thrusting', f: 'Fingering',
    s: 'Suction', d: 'Depth', o: 'Oscillate',
};

/** Functions we can drive with a single 0-N level. Stroke/Position need special handling and are skipped. */
const KNOWN_ACTIONS: Record<string, Omit<LovenseFunction, 'action'>> = {
    Vibrate: {max: 20, type: 'vibrate'},
    Rotate: {max: 20, type: 'rotate'},
    Thrusting: {max: 20, type: 'vibrate'},
    Fingering: {max: 20, type: 'vibrate'},
    Suction: {max: 20, type: 'vibrate'},
    Oscillate: {max: 20, type: 'vibrate'},
    Pump: {max: 3, type: 'vibrate'},
    Depth: {max: 3, type: 'vibrate'},
};

/** Used when an older Lovense Remote doesn't report function names. */
const MODEL_FUNCTIONS: Record<string, string[]> = {
    nora: ['Vibrate', 'Rotate'],
    max: ['Vibrate', 'Pump'],
    edge: ['Vibrate1', 'Vibrate2'],
    tenera: ['Suction'],
    flexer: ['Vibrate', 'Fingering'],
    gravity: ['Vibrate', 'Thrusting'],
    solace: ['Thrusting', 'Depth'],
    ridge: ['Vibrate', 'Rotate'],
    osci: ['Oscillate'],
};

export function normalizeAction(raw: string): string | undefined {
    const trimmed = raw.trim();
    if (!trimmed) return undefined;
    const short = /^([a-z])(\d?)$/i.exec(trimmed);
    if (short) {
        const base = SHORT_NAMES[short[1]!.toLowerCase()];
        return base ? base + (short[2] ?? '') : undefined;
    }
    const match = /^([a-z]+)(\d?)$/i.exec(trimmed);
    if (!match) return undefined;
    const base = match[1]!.charAt(0).toUpperCase() + match[1]!.slice(1).toLowerCase();
    return base + (match[2] ?? '');
}

export function describeFunction(action: string): LovenseFunction | undefined {
    const match = /^([A-Za-z]+?)(\d?)$/.exec(action);
    if (!match) return undefined;
    const known = KNOWN_ACTIONS[match[1]!];
    return known ? {action, ...known} : undefined;
}

function stringArray(value: unknown): string[] {
    if (Array.isArray(value)) return value.filter((item): item is string => typeof item === 'string');
    if (typeof value === 'string') return value.split(/[,;]/);
    return [];
}

export function getToyFunctions(raw: Record<string, unknown>): LovenseFunction[] {
    const names = [
        ...stringArray(raw['fullFunctionNames']),
        ...stringArray(raw['shortFunctionNames']),
    ].map(normalizeAction).filter((name): name is string => name !== undefined);
    if (names.length === 0) {
        const model = String(raw['name'] ?? '').toLowerCase().replace(/[^a-z]/g, '');
        names.push(...(MODEL_FUNCTIONS[model] ?? ['Vibrate']));
    }
    // "Vibrate" alongside numbered motors is redundant: keep the individual motors.
    const hasNumbered = names.some(name => /^Vibrate\d$/.test(name));
    const unique = [...new Set(names)].filter(name => !(hasNumbered && name === 'Vibrate'));
    return unique.map(describeFunction).filter((fn): fn is LovenseFunction => fn !== undefined);
}

export function prettyModel(name: string): string {
    const trimmed = name.trim();
    if (!trimmed) return 'Lovense toy';
    return trimmed.split(/\s+/).map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
}

export interface ParsedToy {
    state: LovenseToyState;
    functions: LovenseFunction[];
}

/** GetToys returns `data.toys` as a JSON string (sometimes an object) keyed by toy ID. */
export function parseToys(data: unknown): ParsedToy[] {
    if (!data || typeof data !== 'object') return [];
    let toys: unknown = (data as Record<string, unknown>)['toys'];
    if (typeof toys === 'string') {
        try { toys = JSON.parse(toys); } catch { return []; }
    }
    if (!toys || typeof toys !== 'object') return [];
    const result: ParsedToy[] = [];
    for (const [key, value] of Object.entries(toys as Record<string, unknown>)) {
        if (!value || typeof value !== 'object') continue;
        const raw = value as Record<string, unknown>;
        const id = typeof raw['id'] === 'string' && raw['id'] ? raw['id'] : key;
        const battery = Number(raw['battery']);
        const nickName = typeof raw['nickName'] === 'string' ? raw['nickName'].trim() : '';
        const firmware = raw['version'] !== undefined && raw['version'] !== '' ? String(raw['version']) : undefined;
        const functions = getToyFunctions(raw);
        result.push({
            state: {
                id,
                model: prettyModel(String(raw['name'] ?? '')),
                ...(nickName ? {nickName} : {}),
                ...(Number.isFinite(battery) && battery >= 0 ? {battery: Math.min(100, Math.round(battery))} : {}),
                connected: String(raw['status'] ?? '1') === '1',
                ...(firmware ? {firmware} : {}),
                functions: functions.map(fn => fn.action),
            },
            functions,
        });
    }
    return result.sort((a, b) => a.state.id.localeCompare(b.state.id));
}

/** Map a 0-1 level onto the action's integer steps, never rounding a non-zero level down to off. */
export function toStep(level: number, max: number): number {
    const t = Math.min(1, Math.max(0, Math.abs(level)));
    if (t <= 0.001) return 0;
    return Math.max(1, Math.round(t * max));
}

export function buildAction(steps: ReadonlyMap<string, number>): string | undefined {
    const entries = [...steps];
    if (!entries.some(([, step]) => step > 0)) return undefined;
    // Explicit zeros keep idle motors off on multi-function toys.
    return entries.map(([action, step]) => `${action}:${step}`).join(',');
}
