import type {DeviceHistoryItem} from '../../../main/services/backendDataTypes';
import {OUTPUT_PREFIX} from '../shared/config';

export interface LovenseOutputHistory {
    model: string;
    nickName?: string;
    action: string;
    multiFunction: boolean;
}

declare module '../../../main/plugins/deviceHistory' {
    interface PluginDeviceHistoryData {
        lovense?: LovenseOutputHistory;
    }
}

export function isLovenseDeviceHistory(
    id: string,
    item: DeviceHistoryItem,
): item is DeviceHistoryItem & {lovense: LovenseOutputHistory} {
    return id.startsWith(OUTPUT_PREFIX) && typeof item.lovense === 'object' && item.lovense !== null;
}
