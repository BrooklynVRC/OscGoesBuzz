import type {FrontendPlugin} from '../../../frontend/plugins/Plugin';
import {PLUGIN_ID} from '../shared/config';
import SafetySettingsSection from './SafetySettingsSection';

export default {
    id: PLUGIN_ID,
    name: 'Safety',
    order: -100,
    Settings: SafetySettingsSection,
} satisfies FrontendPlugin;
