import type {Draft} from 'immer';
import type {Config, OutputConfig, PluginConfig} from '../../../common/application/configTypes';
import {getDefaultLinks} from '../../../common/application/configuration';
import {registerPluginConfiguration} from '../../../common/application/pluginConfiguration';

export const PLUGIN_ID = 'lovense';
export const OUTPUT_PREFIX = 'lovense.';

/** Lovense Remote's built-in patterns. They run on the toy at their own fixed strength. */
export type LovensePreset = 'pulse' | 'wave' | 'fireworks' | 'earthquake';
export const LOVENSE_PRESETS: readonly LovensePreset[] = ['pulse', 'wave', 'fireworks', 'earthquake'];

export interface LovenseConfig extends PluginConfig {
    enabled: boolean;
    /** IP shown in Lovense Remote's Game Mode screen. Unset means this PC (Lovense Remote for PC). */
    host?: string;
    /** Port shown in Game Mode. Unset tries the usual Game Mode ports automatically. */
    port?: number;
}

export interface LovenseOutputConfig extends OutputConfig {
    /** When set, the toy plays this Lovense preset whenever this output is active instead of a steady level. */
    nativePreset?: LovensePreset;
}

export const defaultConfig: LovenseConfig = {version: 1, enabled: true};

export function getSettings(config: Config): LovenseConfig {
    return config.plugins[PLUGIN_ID] as LovenseConfig;
}

export function getOutput(config: Config, id: string): LovenseOutputConfig | undefined {
    return config.outputs.find(output => output.plugin === PLUGIN_ID && output.id === id) as LovenseOutputConfig | undefined;
}

export function createOutput(id: string): LovenseOutputConfig {
    return {plugin: PLUGIN_ID, id, links: getDefaultLinks()};
}

export function outputId(toyId: string, fn: string): string {
    return `${OUTPUT_PREFIX}${toyId}.${fn.toLowerCase()}`;
}

registerPluginConfiguration({
    id: PLUGIN_ID,
    defaults: {...defaultConfig},
    normalize: raw => {
        const draft = raw as Draft<LovenseConfig>;
        const host = draft.host?.trim().replace(/^https?:\/\//i, '').replace(/\/.*$/, '');
        if (!host) delete draft.host;
        else {
            // People often paste "192.168.1.20:30010" from the Game Mode screen.
            const match = /^(.+?):(\d{2,5})$/.exec(host);
            if (match && !host.includes('[')) {
                draft.host = match[1]!;
                draft.port ??= Number(match[2]);
            } else {
                draft.host = host;
            }
        }
        if (draft.port !== undefined && (!Number.isInteger(draft.port) || draft.port < 1 || draft.port > 65535)) delete draft.port;
    },
    normalizeOutput: raw => {
        const output = raw as Draft<LovenseOutputConfig>;
        if (output.nativePreset === undefined) delete output.nativePreset;
    },
});
