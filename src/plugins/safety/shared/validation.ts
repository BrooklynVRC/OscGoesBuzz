import typia from 'typia';
import type {SafetyConfig} from './config';
export {PLUGIN_ID as pluginId} from './config';

export function validateConfig(raw: unknown): void {
    typia.assert<SafetyConfig>(raw);
}
