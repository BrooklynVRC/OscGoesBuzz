export interface SafetySettingsState {
    /** True while every output is held at zero by the stop button or hotkey. */
    safetyStopped: boolean;
    /** Shortcut that is currently registered, if any. */
    safetyShortcutActive?: string;
    /** Why the configured shortcut could not be registered. */
    safetyShortcutError?: string;
}

export interface SafetyIpcInvokeMap {
    'safety:setStopped': {args: [boolean]; result: void};
}

declare module '../../../common/application/ipcContract' {
    interface SettingsStatePayload extends SafetySettingsState {}
    interface IpcInvokeMap extends SafetyIpcInvokeMap {}
}
