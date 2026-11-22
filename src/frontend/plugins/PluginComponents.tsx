import React from 'react';
import {plugins} from './plugins';
import type {PluginSettingsProps} from './Plugin';

const pluginsBySettingsOrder = [...plugins].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

export function PluginSettings(props: PluginSettingsProps) {
    return <>{pluginsBySettingsOrder.map(plugin => plugin.Settings && <plugin.Settings key={plugin.id} {...props} />)}</>;
}

export function PluginRuntimes() {
    return <>{plugins.map((plugin, index) => plugin.Runtime && <plugin.Runtime key={index} />)}</>;
}
