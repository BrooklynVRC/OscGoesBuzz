import {globalShortcut} from 'electron';
import {Plugin, PluginService} from '../../../main/plugins/Plugin';
import type {PluginContext} from '../../../main/plugins/PluginContext';
import type {OutputSettings} from '../../../common/configTypes';
import type {SettingsStatePayload} from '../../../common/application/ipcContract';
import ConfigService from '../../../main/services/ConfigService';
import LoggerService, {type SubLogger} from '../../../main/services/LoggerService';
import {getSettings, PLUGIN_ID} from '../shared/config';

/**
 * Global safety controls: an instant stop (button or system-wide hotkey) and a master intensity ceiling.
 * Implemented as a plugin that adjusts every output's settings each tick, so it covers every device plugin.
 */
@PluginService()
export default class SafetyPlugin extends Plugin {
    readonly id = PLUGIN_ID;
    private stopped = false;
    private registeredShortcut?: string;
    private shortcutError?: string;
    private logger: SubLogger;

    constructor(
        private readonly config: ConfigService,
        loggerService: LoggerService,
    ) {
        super();
        this.logger = loggerService.get('safety');
    }

    override async start(context: PluginContext) {
        context.handleIpc('safety:setStopped', stopped => this.setStopped(stopped));
        const sync = () => this.registerShortcut(getSettings(this.config.getCached()).panicShortcut);
        this.config.on('changed', sync);
        context.onCleanup(() => {
            this.config.off('changed', sync);
            this.unregisterShortcut();
        });
        sync();
    }

    private setStopped(stopped: boolean) {
        if (this.stopped === stopped) return;
        this.stopped = stopped;
        this.logger.log(stopped ? 'STOP engaged: all outputs held at zero' : 'STOP released: outputs resumed');
    }

    private registerShortcut(accelerator: string) {
        if (accelerator === this.registeredShortcut && !this.shortcutError) return;
        this.unregisterShortcut();
        this.shortcutError = undefined;
        if (!accelerator) return;
        try {
            const ok = globalShortcut.register(accelerator, () => this.setStopped(!this.stopped));
            if (ok) {
                this.registeredShortcut = accelerator;
            } else {
                this.shortcutError = 'That shortcut is already used by another app.';
            }
        } catch (error) {
            this.shortcutError = 'That shortcut is not valid.';
            this.logger.log('Failed to register stop shortcut', error);
        }
    }

    private unregisterShortcut() {
        if (this.registeredShortcut) {
            try { globalShortcut.unregister(this.registeredShortcut); } catch {}
        }
        this.registeredShortcut = undefined;
    }

    override adjustOutputSettings(settings: OutputSettings): OutputSettings {
        if (this.stopped) return {...settings, enabled: false};
        const master = getSettings(this.config.getCached()).masterLevel;
        if (master >= 1) return settings;
        const intensity = settings.intensity ?? {};
        return {
            ...settings,
            intensity: {
                ...intensity,
                max: (intensity.max ?? 1) * master,
                min: Math.min(intensity.min ?? 0, (intensity.max ?? 1) * master),
            },
        };
    }

    override async settingsState(): Promise<Partial<SettingsStatePayload>> {
        return {
            safetyStopped: this.stopped,
            ...(this.registeredShortcut ? {safetyShortcutActive: this.registeredShortcut} : {}),
            ...(this.shortcutError ? {safetyShortcutError: this.shortcutError} : {}),
        };
    }
}
