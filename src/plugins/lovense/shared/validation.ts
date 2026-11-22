import typia from 'typia';
import type {LovenseConfig, LovenseOutputConfig} from './config';
export {PLUGIN_ID as pluginId} from './config';

export function validateConfig(raw: unknown): void {
    typia.assert<LovenseConfig>(raw);
}

export function validateOutput(raw: unknown): void {
    typia.assert<LovenseOutputConfig>(raw);
}
