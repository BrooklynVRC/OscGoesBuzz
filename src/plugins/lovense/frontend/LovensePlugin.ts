import type {FrontendPlugin} from '../../../frontend/plugins/Plugin';
import {createOutput, PLUGIN_ID} from '../shared/config';
import LovenseSettingsSection from './LovenseSettingsSection';
import LovenseOutputEditor from './LovenseOutputEditor';
import {outputPresentation} from './outputPresentation';

export default {
    id: PLUGIN_ID,
    name: 'Lovense',
    createOutput,
    OutputEditor: LovenseOutputEditor,
    Settings: LovenseSettingsSection,
    outputPresentation,
} satisfies FrontendPlugin;
