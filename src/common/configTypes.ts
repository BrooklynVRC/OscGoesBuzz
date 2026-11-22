/** Shared plugin-link envelope. The engine receives resolved samples, not this payload. */
export interface OutputLink {
    [key: string]: unknown;
    kind: string;
    plugin: string;
    enabled?: boolean;
}

export interface OutputLinkFilter {
    include: string[];
    exclude: string[];
}

export type OutputLinkKind = OutputLink["kind"];

export interface OutputLinearActuatorConfig {
    maxv: number;
    maxa: number;
    durationMult: number;
    restingPos: number;
    restingTime: number;
    min: number;
    max: number;
}

export function getDefaultLinearActuatorConfig(): OutputLinearActuatorConfig {
    return {
        maxv: 3,
        maxa: 20,
        durationMult: 1,
        restingPos: 0,
        restingTime: 3,
        min: 0,
        max: 1,
    };
}

export interface InputScaleModifier {
    kind: 'scale';
    scale: number;
}

export interface InputDeadZoneModifier {
    kind: 'deadZone';
    level: number;
}

export type InputModifier =
    | InputScaleModifier
    | InputDeadZoneModifier;
export type InputModifierKind = InputModifier['kind'];

export type OutputPatternKind = 'steady' | 'pulse' | 'wave' | 'heartbeat' | 'fireworks' | 'earthquake';

/** Shapes intensity-style outputs (vibrate/rotate). Every field is optional; missing means "no change". */
export interface OutputIntensityConfig {
    /** Floor applied whenever the output is active at all (0-1). */
    min?: number;
    /** Ceiling for this output (0-1). */
    max?: number;
    /** Response curve exponent. 1 = linear, <1 = more sensitive at low input, >1 = gentler low end. */
    curve?: number;
    /** Optional rhythm layered on top of the incoming level. */
    pattern?: OutputPatternKind;
    /** Pattern speed multiplier (1 = normal). */
    patternSpeed?: number;
}

export interface OutputSettings {
    enabled?: boolean;
    linear?: Partial<OutputLinearActuatorConfig>;
    intensity?: OutputIntensityConfig;
}
