import React, {useMemo} from 'react';
import {Stack, ToggleButton, ToggleButtonGroup, Typography} from '@mui/material';
import {AutoAwesome as AutoAwesomeIcon} from '@mui/icons-material';
import {type PrimitiveAtom, useAtom} from 'jotai';
import {selectAtom} from 'jotai/utils';
import type {OutputEditorProps} from '../../../frontend/plugins/Plugin';
import OutputLinks from '../../../frontend/components/settings/OutputLinks';
import MyAccordion from '../../../frontend/components/util/MyAccordion';
import {focusKeyAtom} from '../../../frontend/utils/atomUtils';
import {LOVENSE_PRESETS, type LovenseOutputConfig, type LovensePreset} from '../shared/config';

const PRESET_LABELS: Record<LovensePreset, string> = {
    pulse: 'Pulse',
    wave: 'Wave',
    fireworks: 'Fireworks',
    earthquake: 'Earthquake',
};

export default function LovenseOutputEditor({outputAtom: opaqueOutputAtom, infoAtom}: OutputEditorProps) {
    const outputAtom = opaqueOutputAtom as PrimitiveAtom<LovenseOutputConfig>;
    const linksAtom = useMemo(() => focusKeyAtom(outputAtom, 'links'), [outputAtom]);
    const presetAtom = useMemo(() => focusKeyAtom(outputAtom, 'nativePreset'), [outputAtom]);
    const [preset, setPreset] = useAtom(presetAtom);
    const [expanded, setExpanded] = React.useState(false);
    const linkLevelsAtom = useMemo(
        () => selectAtom(
            infoAtom,
            info => info?.lastLinkValues ?? [],
            (a, b) => a.length === b.length && a.every((value, index) => value === b[index]),
        ),
        [infoAtom],
    );
    return (
        <>
            <OutputLinks linksAtom={linksAtom} linkLevelsAtom={linkLevelsAtom} />
            <MyAccordion
                expanded={expanded}
                onChange={setExpanded}
                sx={{bgcolor: 'action.hover'}}
                summary={
                    <Stack direction="row" spacing={1} sx={{alignItems: 'center'}}>
                        <AutoAwesomeIcon sx={{fontSize: 18, color: 'text.secondary'}} />
                        <Typography variant="subtitle2">Lovense built-in preset</Typography>
                        <Typography variant="caption" color={preset ? 'primary.main' : 'text.secondary'}>
                            {preset ? PRESET_LABELS[preset] : 'Off'}
                        </Typography>
                    </Stack>
                }
            >
                <Stack spacing={1.5}>
                    <ToggleButtonGroup
                        size="small"
                        exclusive
                        value={preset ?? 'off'}
                        onChange={(_e, value: LovensePreset | 'off' | null) => {
                            if (value === null) return;
                            setPreset(value === 'off' ? undefined : value);
                        }}
                        sx={{flexWrap: 'wrap'}}
                    >
                        <ToggleButton value="off" sx={{px: 1.5, textTransform: 'none'}}>Off</ToggleButton>
                        {LOVENSE_PRESETS.map(id => (
                            <ToggleButton key={id} value={id} sx={{px: 1.5, textTransform: 'none'}}>{PRESET_LABELS[id]}</ToggleButton>
                        ))}
                    </ToggleButtonGroup>
                    <Typography variant="caption" color="text.secondary">
                        Plays Lovense's own preset on the whole toy whenever this output is active. Presets run at Lovense's
                        fixed strength; for rhythms that follow your avatar's intensity, use the Patterns under Intensity instead.
                    </Typography>
                </Stack>
            </MyAccordion>
        </>
    );
}
