export interface LovenseToyState {
    id: string;
    /** Model, e.g. "Lush 3". */
    model: string;
    nickName?: string;
    /** 0-100, when the app reports it. */
    battery?: number;
    connected: boolean;
    firmware?: string;
    /** Motor/function names, e.g. ["Vibrate", "Rotate"]. */
    functions: string[];
}

export interface LovenseSettingsState {
    lovenseConnected: boolean;
    /** Where Game Mode answered, e.g. "https://192.168.1.20:30010". */
    lovenseEndpoint?: string;
    /** What Lovense Remote reported about itself, e.g. "ios remote". */
    lovenseApp?: string;
    lovenseError?: string;
    lovenseToys: LovenseToyState[];
}

export interface LovenseIpcInvokeMap {
    'lovense:test': {args: [toyId: string]; result: void};
    'lovense:refresh': {args: []; result: void};
}

declare module '../../../common/application/ipcContract' {
    interface SettingsStatePayload extends LovenseSettingsState {}
    interface IpcInvokeMap extends LovenseIpcInvokeMap {}
}
