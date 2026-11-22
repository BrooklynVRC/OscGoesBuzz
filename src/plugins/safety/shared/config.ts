import type {Draft} from 'immer';
import type {Config, PluginConfig} from '../../../common/application/configTypes';
import {registerPluginConfiguration} from '../../../common/application/pluginConfiguration';
import clamp from '../../../common/clamp';

export const PLUGIN_ID = 'safety';

export const DEFAULT_PANIC_SHORTCUT = 'Control+Shift+Space';

export interface SafetyConfig extends PluginConfig {
    /** Global ceiling multiplied into every intensity output (0-1). */
    masterLevel: number;
    /** Electron accelerator for the system-wide stop toggle. Empty disables it. */
    panicShortcut: string;
}

export const defaultConfig: SafetyConfig = {version: 1, masterLevel: 1, panicShortcut: DEFAULT_PANIC_SHORTCUT};

export function getSettings(config: Config): SafetyConfig {
    return config.plugins[PLUGIN_ID] as SafetyConfig;
}

registerPluginConfiguration({
    id: PLUGIN_ID,
    order: -100,
    defaults: {...defaultConfig},
    normalize: raw => {
        const draft = raw as Draft<SafetyConfig>;
        draft.masterLevel = Math.round(clamp(draft.masterLevel, 0, 1) * 100) / 100;
        draft.panicShortcut = draft.panicShortcut.trim();
    },
});
