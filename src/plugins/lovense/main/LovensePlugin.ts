import {Plugin, PluginService} from '../../../main/plugins/Plugin';
import type {OutputFrame} from '../../../main/OutputFrame';
import type {ResolveLinks} from '../../../main/plugins/linkInputs';
import type OutputController from '../../../main/OutputController';
import type {PluginContext} from '../../../main/plugins/PluginContext';
import type {OutputDeviceInfo, SettingsStatePayload} from '../../../common/application/ipcContract';
import ConfigService from '../../../main/services/ConfigService';
import BackendDataService from '../../../main/services/BackendDataService';
import {getOutput, PLUGIN_ID} from '../shared/config';
import Lovense, {LovenseOutput, prettyAction, toyDisplayName} from './Lovense';
import {isLovenseDeviceHistory} from './deviceHistory';

@PluginService()
export default class LovensePlugin extends Plugin {
    readonly id = PLUGIN_ID;

    constructor(
        private readonly lovense: Lovense,
        private readonly config: ConfigService,
        private readonly backendData: BackendDataService,
    ) {
        super();
    }

    override async start(context: PluginContext) {
        context.handleIpc('lovense:test', toyId => this.lovense.test(toyId));
        context.handleIpc('lovense:refresh', () => this.lovense.refresh());
        this.lovense.start(context);
    }

    override *getOutputs(resolve: ResolveLinks): Iterable<OutputFrame> {
        for (const output of this.lovense.getOutputs()) {
            const config = getOutput(this.config.getCached(), output.id);
            yield {
                output,
                inputs: resolve(config?.links ?? [], false),
                settings: {enabled: config?.enabled, intensity: config?.intensity},
            };
        }
    }

    override *getOutputConfigs() {
        for (const output of this.lovense.getOutputs()) {
            const config = getOutput(this.config.getCached(), output.id);
            if (config) yield config;
        }
    }

    override async settingsState(controllers: readonly OutputController[]): Promise<Partial<SettingsStatePayload>> {
        const outputs = new Map<string, OutputDeviceInfo>();
        const configured = new Set(this.config.getCached().outputs.filter(output => output.plugin === PLUGIN_ID).map(output => output.id));
        const history = await this.backendData.getAllDeviceHistory();
        for (const [id, item] of Object.entries(history)) {
            if (!configured.has(id) || !isLovenseDeviceHistory(id, item)) continue;
            const base = toyDisplayName(item.lovense);
            outputs.set(id, info(id, item.lovense.multiFunction ? `${base} · ${prettyAction(item.lovense.action)}` : base, false));
        }
        for (const controller of controllers) {
            const output = controller.output;
            if (!(output instanceof LovenseOutput)) continue;
            const base = toyDisplayName(output.toyState);
            const name = output.multiFunction ? `${base} · ${prettyAction(output.fn.action)}` : base;
            outputs.set(output.id, {
                ...info(output.id, name, true),
                currentLevel: controller.getCurrentLevel(),
                lastLinkValues: controller.getLastLinkValues(),
            });
        }
        return {outputs: [...outputs.values()], ...this.lovense.getState()};
    }
}

function info(id: string, name: string, connected: boolean): OutputDeviceInfo {
    return {
        plugin: PLUGIN_ID,
        id,
        name,
        connected,
        showLinearActuatorOptions: false,
        supportsLinearPreference: false,
        currentLevel: 0,
        lastLinkValues: [],
    };
}
