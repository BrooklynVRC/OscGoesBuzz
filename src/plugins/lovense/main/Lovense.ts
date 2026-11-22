import {Service} from 'typedi';
import ConfigService from '../../../main/services/ConfigService';
import BackendDataService from '../../../main/services/BackendDataService';
import LoggerService, {type SubLogger} from '../../../main/services/LoggerService';
import {poll} from '../../../main/plugins/poll';
import type {PluginContext} from '../../../main/plugins/PluginContext';
import type {OutputEndpoint} from '../../../main/OutputEndpoint';
import {getOutput, getSettings, outputId, type LovensePreset} from '../shared/config';
import type {LovenseSettingsState, LovenseToyState} from '../shared/ipc';
import {
    candidateEndpoints,
    describeEndpoint,
    LovenseError,
    sendLovenseCommand,
    type LovenseEndpoint,
} from './LovenseClient';
import {buildAction, parseToys, toStep, type LovenseFunction, type ParsedToy} from './lovenseToys';
import './deviceHistory';

const POLL_MS = 2000;
/** Minimum gap between commands to one toy. Game Mode is HTTP; flooding it makes it laggy. */
const MIN_SEND_INTERVAL_MS = 100;
/** Active commands are sent with a short duration and refreshed, so a crash can't leave a toy running. */
const ACTIVE_COMMAND_SECONDS = 2;
const REFRESH_MS = 1000;
const TEST_MS = 1500;

export function prettyAction(action: string): string {
    return action.replace(/(\D)(\d)$/, '$1 $2');
}

export function toyDisplayName(toy: Pick<LovenseToyState, 'model' | 'nickName'>): string {
    return toy.nickName || toy.model;
}

@Service()
export default class Lovense {
    private endpoint?: LovenseEndpoint;
    private readonly toys = new Map<string, LovenseToy>();
    private lastError?: string;
    private appInfo?: string;
    private failures = 0;
    private generation = 0;
    private readonly logger: SubLogger;
    private lastSettingsKey?: string;

    constructor(
        readonly config: ConfigService,
        private readonly backendData: BackendDataService,
        loggerService: LoggerService,
    ) {
        this.logger = loggerService.get('lovense');
    }

    start(context: PluginContext): void {
        const onConfig = () => {
            const settings = getSettings(this.config.getCached());
            const key = JSON.stringify([settings.enabled, settings.host, settings.port]);
            if (this.lastSettingsKey !== undefined && key !== this.lastSettingsKey) {
                this.logger.log('Connection settings changed, reconnecting');
                this.disconnect();
                this.lastError = undefined;
            }
            this.lastSettingsKey = key;
        };
        onConfig();
        this.config.on('changed', onConfig);
        context.onCleanup(() => {
            this.config.off('changed', onConfig);
            this.disconnect();
        });
        poll(context, POLL_MS, () => this.tick(), error => this.logger.log('Poll failed', error));
    }

    /** Ask Lovense Remote for a fresh toy list right away. */
    async refresh(): Promise<void> {
        if (!this.endpoint) this.failures = 0;
        await this.tick();
    }

    private async tick(): Promise<void> {
        const settings = getSettings(this.config.getCached());
        if (!settings.enabled) {
            if (this.endpoint) this.disconnect();
            this.lastError = undefined;
            return;
        }
        const generation = this.generation;
        if (!this.endpoint) {
            const found = await this.discover(settings.host, settings.port);
            if (generation !== this.generation) return;
            if (!found) return;
            this.endpoint = found.endpoint;
            this.lastError = undefined;
            this.failures = 0;
            this.logger.log(`Connected to Lovense Game Mode at ${describeEndpoint(found.endpoint)}`);
            this.syncToys(found.data);
            return;
        }
        try {
            const response = await sendLovenseCommand(this.endpoint, {command: 'GetToys'});
            if (generation !== this.generation) return;
            this.failures = 0;
            this.lastError = undefined;
            this.syncToys(response.data);
        } catch (error) {
            if (generation !== this.generation) return;
            this.noteFailure(error);
        }
    }

    private async discover(host: string | undefined, port: number | undefined) {
        let lastError: unknown;
        for (const endpoint of candidateEndpoints(host, port)) {
            try {
                const response = await sendLovenseCommand(endpoint, {command: 'GetToys'}, 1500);
                return {endpoint, data: response.data};
            } catch (error) {
                lastError = error;
                // A Lovense error code means we reached the app; report that instead of a network error.
                if (error instanceof LovenseError && error.code !== undefined && error.code >= 400) break;
            }
        }
        this.lastError = describeDiscoveryError(host, lastError);
        return undefined;
    }

    noteFailure(error: unknown) {
        this.failures++;
        if (this.failures === 1) this.logger.log('Lovense Remote did not answer', error instanceof Error ? error.message : error);
        if (this.failures >= 3 && this.endpoint) {
            this.logger.log('Lost connection to Lovense Remote');
            this.lastError = 'Lost connection to Lovense Remote. Is the app still open with Game Mode on?';
            this.disconnect();
        }
    }

    private disconnect() {
        this.generation++;
        const endpoint = this.endpoint;
        for (const toy of this.toys.values()) toy.dispose(endpoint);
        this.toys.clear();
        this.endpoint = undefined;
        this.appInfo = undefined;
        this.failures = 0;
    }

    private syncToys(data: unknown) {
        if (data && typeof data === 'object') {
            const record = data as Record<string, unknown>;
            const info = [record['platform'], record['appType']].filter(value => typeof value === 'string' && value).join(' ');
            this.appInfo = info || undefined;
        }
        const parsed = parseToys(data);
        const seen = new Set<string>();
        for (const item of parsed) {
            seen.add(item.state.id);
            const existing = this.toys.get(item.state.id);
            if (existing) {
                const wasConnected = existing.state.connected;
                existing.update(item);
                if (!wasConnected && item.state.connected) this.logger.log(`${toyDisplayName(item.state)} reconnected`);
            } else {
                const toy = new LovenseToy(this, item);
                this.toys.set(item.state.id, toy);
                this.logger.log(`Found ${toyDisplayName(item.state)} (${item.state.functions.join(', ') || 'no controllable functions'})`
                    + (item.state.battery !== undefined ? `, battery ${item.state.battery}%` : ''));
                for (const output of toy.outputs.values()) this.rememberOutput(toy, output);
            }
        }
        for (const [id, toy] of this.toys) {
            if (seen.has(id)) continue;
            toy.dispose(this.endpoint);
            this.toys.delete(id);
        }
    }

    private rememberOutput(toy: LovenseToy, output: LovenseOutput) {
        void this.backendData.updateDeviceHistory(output.id, {
            lovense: {
                model: toy.state.model,
                ...(toy.state.nickName ? {nickName: toy.state.nickName} : {}),
                action: output.fn.action,
                multiFunction: toy.functions.length > 1,
            },
        }).catch(error => this.logger.log('Failed to update device history', error));
    }

    getEndpoint() {
        return this.endpoint;
    }

    /** Outputs for toys that are currently connected to Lovense Remote. */
    *getOutputs(): Iterable<LovenseOutput> {
        for (const toy of this.toys.values()) {
            if (!toy.state.connected) continue;
            yield* toy.outputs.values();
        }
    }

    getPreset(id: string): LovensePreset | undefined {
        return getOutput(this.config.getCached(), id)?.nativePreset;
    }

    test(toyId: string) {
        this.toys.get(toyId)?.test();
    }

    getState(): LovenseSettingsState {
        return {
            lovenseConnected: this.endpoint !== undefined,
            ...(this.endpoint ? {lovenseEndpoint: describeEndpoint(this.endpoint)} : {}),
            ...(this.appInfo ? {lovenseApp: this.appInfo} : {}),
            ...(this.lastError && !this.endpoint ? {lovenseError: this.lastError} : {}),
            lovenseToys: [...this.toys.values()].map(toy => ({...toy.state, functions: [...toy.state.functions]})),
        };
    }
}

function describeDiscoveryError(host: string | undefined, error: unknown): string {
    const where = host ?? 'this PC';
    if (error instanceof LovenseError && error.code !== undefined && ERROR_HINTS[error.code]) return ERROR_HINTS[error.code]!;
    const code = (error as {code?: string} | undefined)?.code;
    if (code === 'ECONNREFUSED') return `Nothing is answering at ${where}. Turn on Game Mode in Lovense Remote and check the IP.`;
    if (code === 'EHOSTUNREACH' || code === 'ENETUNREACH') return `Can't reach ${where}. Make sure both devices are on the same Wi-Fi and no VPN is on.`;
    return `Can't find Lovense Remote at ${where}. Open the app, go to Discover → Game Mode and turn it on.`;
}

const ERROR_HINTS: Record<number, string> = {
    500: 'Lovense Remote answered, but Game Mode is switched off. Turn it on under Discover → Game Mode.',
};

type Command = Record<string, unknown>;

class LovenseToy {
    state: LovenseToyState;
    functions: LovenseFunction[];
    readonly outputs = new Map<string, LovenseOutput>();
    private readonly steps = new Map<string, number>();
    private flushQueued = false;
    private inFlight = false;
    private pending = false;
    private timer?: ReturnType<typeof setTimeout>;
    private lastKey?: string;
    private lastSentAt = 0;
    private testUntil = 0;
    private disposed = false;

    constructor(private readonly parent: Lovense, parsed: ParsedToy) {
        this.state = parsed.state;
        this.functions = parsed.functions;
        this.buildOutputs();
    }

    private buildOutputs() {
        this.outputs.clear();
        this.steps.clear();
        for (const fn of this.functions) {
            this.outputs.set(fn.action, new LovenseOutput(outputId(this.state.id, fn.action), this, fn));
            this.steps.set(fn.action, 0);
        }
    }

    update(parsed: ParsedToy) {
        const changed = parsed.functions.map(fn => fn.action).join() !== this.functions.map(fn => fn.action).join();
        this.state = parsed.state;
        this.functions = parsed.functions;
        if (changed) this.buildOutputs();
    }

    setStep(action: string, step: number) {
        this.steps.set(action, step);
        this.scheduleFlush();
    }

    test() {
        this.testUntil = Date.now() + TEST_MS;
        this.lastKey = undefined;
        this.scheduleFlush();
        setTimeout(() => this.scheduleFlush(), TEST_MS + 50);
    }

    private scheduleFlush() {
        if (this.flushQueued || this.disposed) return;
        this.flushQueued = true;
        // Let every motor on this toy update in the same tick, then send one combined command.
        setImmediate(() => {
            this.flushQueued = false;
            this.flush();
        });
    }

    private desiredCommand(now: number): {key: string; body: Command; active: boolean} {
        const toy = this.state.id;
        if (now < this.testUntil) {
            const action = this.functions.map(fn => `${fn.action}:${Math.max(1, Math.round(fn.max * 0.3))}`).join(',') || 'Vibrate:6';
            return {key: `test`, body: {command: 'Function', action, timeSec: 2, toy, apiVer: 1}, active: false};
        }
        for (const [action, step] of this.steps) {
            if (step <= 0) continue;
            const output = this.outputs.get(action);
            const preset = output ? this.parent.getPreset(output.id) : undefined;
            if (preset) {
                // Presets run on the toy itself; restarting them would reset the rhythm, so send once.
                return {key: `preset:${preset}`, body: {command: 'Preset', name: preset, timeSec: 0, toy, apiVer: 1}, active: false};
            }
        }
        const action = buildAction(this.steps);
        if (action) {
            return {
                key: `fn:${action}`,
                body: {command: 'Function', action, timeSec: ACTIVE_COMMAND_SECONDS, toy, apiVer: 1, stopPrevious: 1},
                active: true,
            };
        }
        return {key: 'stop', body: stopCommand(toy), active: false};
    }

    private flush() {
        if (this.disposed) return;
        if (this.inFlight) {
            this.pending = true;
            return;
        }
        const endpoint = this.parent.getEndpoint();
        if (!endpoint) return;
        const now = Date.now();
        const desired = this.desiredCommand(now);
        const stale = desired.active && now - this.lastSentAt >= REFRESH_MS;
        if (desired.key === this.lastKey && !stale) return;
        const wait = MIN_SEND_INTERVAL_MS - (now - this.lastSentAt);
        if (wait > 0) {
            if (!this.timer) {
                this.timer = setTimeout(() => {
                    this.timer = undefined;
                    this.flush();
                }, wait);
            }
            return;
        }
        this.inFlight = true;
        this.lastKey = desired.key;
        this.lastSentAt = now;
        sendLovenseCommand(endpoint, desired.body, 2000)
            .catch(error => {
                // Retry this state on the next flush instead of assuming it landed.
                this.lastKey = undefined;
                if (error instanceof LovenseError && error.code === 402) return;
                this.parent.noteFailure(error);
            })
            .finally(() => {
                this.inFlight = false;
                if (this.pending) {
                    this.pending = false;
                    this.flush();
                }
            });
    }

    dispose(endpoint: LovenseEndpoint | undefined) {
        if (this.disposed) return;
        this.disposed = true;
        clearTimeout(this.timer);
        const wasActive = this.lastKey !== undefined && this.lastKey !== 'stop';
        if (endpoint && wasActive) void sendLovenseCommand(endpoint, stopCommand(this.state.id), 1500).catch(() => {});
    }
}

function stopCommand(toy: string): Command {
    return {command: 'Function', action: 'Stop', timeSec: 0, toy, apiVer: 1};
}

export class LovenseOutput implements OutputEndpoint {
    lastLevel = 0;

    constructor(
        readonly id: string,
        private readonly toy: LovenseToy,
        readonly fn: LovenseFunction,
    ) {}

    get type() { return this.fn.type; }

    get toyState(): LovenseToyState { return this.toy.state; }

    get multiFunction(): boolean { return this.toy.functions.length > 1; }

    setLevel(level: number) {
        this.lastLevel = level;
        // Game Mode can't reverse rotation; use the magnitude.
        this.toy.setStep(this.fn.action, toStep(level, this.fn.max));
    }
}
