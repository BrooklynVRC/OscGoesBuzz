import React, {useEffect, useState} from 'react';
import {Alert, Box, Button, Paper, Slider, Stack, Typography} from '@mui/material';
import {PanTool as StopIcon, PlayArrow as ResumeIcon, Keyboard as KeyboardIcon} from '@mui/icons-material';
import {useAtom, useAtomValue} from 'jotai';
import {selectAtom} from 'jotai/utils';
import type {PluginSettingsProps} from '../../../frontend/plugins/Plugin';
import {focusKeyAtom, pluginConfigAtom} from '../../../frontend/utils/atomUtils';
import {useSettingsStateAtom} from '../../../frontend/components/settings/SettingsStateAtomContext';
import TextCommitInput from '../../../frontend/components/util/TextCommitInput';
import {invokeIpc} from '../../../frontend/ipc';
import {DEFAULT_PANIC_SHORTCUT, PLUGIN_ID, type SafetyConfig} from '../shared/config';

function prettyShortcut(accelerator: string) {
    return accelerator
        .replace(/CommandOrControl|CmdOrCtrl/gi, 'Ctrl')
        .replace(/Control/gi, 'Ctrl')
        .split('+')
        .join(' + ');
}

function SafetySettingsSection({configAtom}: PluginSettingsProps) {
    const settingsAtom = React.useMemo(() => pluginConfigAtom<SafetyConfig>(configAtom, PLUGIN_ID), [configAtom]);
    const masterAtom = React.useMemo(() => focusKeyAtom(settingsAtom, 'masterLevel'), [settingsAtom]);
    const shortcutAtom = React.useMemo(() => focusKeyAtom(settingsAtom, 'panicShortcut'), [settingsAtom]);
    const [master, setMaster] = useAtom(masterAtom);
    const [shortcut, setShortcut] = useAtom(shortcutAtom);
    const [draftMaster, setDraftMaster] = useState(master);
    useEffect(() => setDraftMaster(master), [master]);
    const [showShortcut, setShowShortcut] = useState(false);

    const stateAtom = useSettingsStateAtom();
    const stopped = useAtomValue(React.useMemo(() => selectAtom(stateAtom, s => s.safetyStopped ?? false), [stateAtom]));
    const activeShortcut = useAtomValue(React.useMemo(() => selectAtom(stateAtom, s => s.safetyShortcutActive), [stateAtom]));
    const shortcutError = useAtomValue(React.useMemo(() => selectAtom(stateAtom, s => s.safetyShortcutError), [stateAtom]));

    return (
        <Paper
            variant="outlined"
            sx={{
                p: 2,
                mb: 2,
                borderRadius: 3,
                borderColor: stopped ? 'error.main' : 'divider',
                background: stopped
                    ? 'linear-gradient(135deg, rgba(244,67,54,0.18), rgba(244,67,54,0.05))'
                    : 'linear-gradient(135deg, rgba(255,92,157,0.08), rgba(139,123,255,0.06))',
                transition: 'background 200ms, border-color 200ms',
            }}
        >
            <Stack direction={{xs: 'column', sm: 'row'}} spacing={2.5} sx={{alignItems: {sm: 'center'}}}>
                <Button
                    variant="contained"
                    color={stopped ? 'success' : 'error'}
                    size="large"
                    startIcon={stopped ? <ResumeIcon /> : <StopIcon />}
                    onClick={() => void invokeIpc('safety:setStopped', !stopped)}
                    sx={{minWidth: 150, py: 1.25, fontWeight: 700, letterSpacing: 0.5, borderRadius: 2.5, boxShadow: 'none'}}
                >
                    {stopped ? 'Resume' : 'Stop all'}
                </Button>
                <Box sx={{flex: 1, minWidth: 0}}>
                    <Stack direction="row" sx={{justifyContent: 'space-between', alignItems: 'baseline'}}>
                        <Typography variant="subtitle2">{stopped ? 'Everything is stopped' : 'Master intensity'}</Typography>
                        <Typography variant="h6" sx={{fontVariantNumeric: 'tabular-nums', lineHeight: 1}}>
                            {Math.round(draftMaster * 100)}%
                        </Typography>
                    </Stack>
                    <Slider
                        size="small"
                        min={0}
                        max={1}
                        step={0.01}
                        value={draftMaster}
                        disabled={stopped}
                        onChange={(_e, value) => setDraftMaster(value as number)}
                        onChangeCommitted={(_e, value) => setMaster(value as number)}
                        aria-label="Master intensity"
                    />
                    <Stack direction="row" spacing={0.75} sx={{alignItems: 'center', cursor: 'pointer', width: 'fit-content'}} onClick={() => setShowShortcut(v => !v)}>
                        <KeyboardIcon sx={{fontSize: 15, color: 'text.secondary'}} />
                        <Typography variant="caption" color="text.secondary">
                            {activeShortcut
                                ? <>Press <b>{prettyShortcut(activeShortcut)}</b> anywhere, even in VR, to stop or resume</>
                                : 'No stop shortcut set'}
                        </Typography>
                    </Stack>
                </Box>
            </Stack>
            {shortcutError && <Alert severity="warning" sx={{mt: 1.5}}>{shortcutError} Pick a different stop shortcut.</Alert>}
            {(showShortcut || shortcutError) && (
                <Box sx={{mt: 1.5}}>
                    <TextCommitInput
                        label="Stop shortcut"
                        value={shortcut}
                        placeholder={DEFAULT_PANIC_SHORTCUT}
                        helperText="Electron accelerator format, e.g. Control+Shift+Space or Alt+F12. Leave empty to disable."
                        onCommit={setShortcut}
                    />
                </Box>
            )}
        </Paper>
    );
}

export default React.memo(SafetySettingsSection);
