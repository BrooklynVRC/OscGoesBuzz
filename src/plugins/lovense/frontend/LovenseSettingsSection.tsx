import React from 'react';
import {
    Alert,
    type AlertColor,
    Box,
    Button,
    Chip,
    Collapse,
    FormControlLabel,
    IconButton,
    Link,
    Paper,
    Stack,
    Switch,
    Tooltip,
    Typography,
} from '@mui/material';
import {
    Refresh as RefreshIcon,
    Vibration as VibrationIcon,
    HelpOutlined as HelpIcon,
    PowerSettingsNew as PowerIcon,
} from '@mui/icons-material';
import {useAtom, useAtomValue} from 'jotai';
import {selectAtom} from 'jotai/utils';
import type {PluginSettingsProps} from '../../../frontend/plugins/Plugin';
import {focusKeyAtom, pluginConfigAtom} from '../../../frontend/utils/atomUtils';
import {useSettingsStateAtom} from '../../../frontend/components/settings/SettingsStateAtomContext';
import ConnectionBubble from '../../../frontend/components/settings/ConnectionBubble';
import {getConnectionBubbleColor} from '../../../frontend/utils/connectionBubbleColor';
import MyAccordion from '../../../frontend/components/util/MyAccordion';
import TextCommitInput from '../../../frontend/components/util/TextCommitInput';
import {invokeIpc} from '../../../frontend/ipc';
import {PLUGIN_ID, type LovenseConfig} from '../shared/config';
import type {LovenseToyState} from '../shared/ipc';
import BatteryIndicator, {batteryColor} from './BatteryIndicator';

const EMPTY_TOYS: LovenseToyState[] = [];

function prettyAction(action: string) {
    return action.replace(/(\D)(\d)$/, '$1 $2');
}

function ToyCard({toy}: {toy: LovenseToyState}) {
    const [testing, setTesting] = React.useState(false);
    const battery = toy.battery;
    return (
        <Paper
            variant="outlined"
            sx={{
                p: 1.5,
                borderRadius: 2.5,
                minWidth: 200,
                flex: '1 1 200px',
                maxWidth: 320,
                opacity: toy.connected ? 1 : 0.55,
                bgcolor: 'rgba(255,255,255,0.02)',
                position: 'relative',
                overflow: 'hidden',
            }}
        >
            <Stack spacing={1}>
                <Stack direction="row" sx={{alignItems: 'flex-start', justifyContent: 'space-between'}}>
                    <Box sx={{minWidth: 0}}>
                        <Typography variant="subtitle1" sx={{fontWeight: 600, lineHeight: 1.2}} noWrap>
                            {toy.nickName || toy.model}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" noWrap component="div">
                            {toy.nickName ? `${toy.model} · ` : ''}{toy.connected ? 'Connected' : 'Not connected'}
                            {toy.firmware ? ` · fw ${toy.firmware}` : ''}
                        </Typography>
                    </Box>
                    {toy.connected && <BatteryIndicator battery={battery} />}
                </Stack>
                {toy.connected && (
                    <Box sx={{height: 4, borderRadius: 2, bgcolor: 'rgba(255,255,255,0.08)', overflow: 'hidden'}}>
                        <Box sx={{height: '100%', width: `${battery ?? 0}%`, bgcolor: batteryColor(battery), transition: 'width 300ms'}} />
                    </Box>
                )}
                <Stack direction="row" sx={{alignItems: 'center', justifyContent: 'space-between'}}>
                    <Stack direction="row" spacing={0.5} sx={{flexWrap: 'wrap', rowGap: 0.5}}>
                        {toy.functions.map(fn => (
                            <Chip key={fn} label={prettyAction(fn)} size="small" variant="outlined" sx={{height: 20, fontSize: '0.68rem'}} />
                        ))}
                    </Stack>
                    <Tooltip title="Buzz for a second at 30%">
                        <span>
                            <Button
                                size="small"
                                variant="text"
                                startIcon={<VibrationIcon sx={{fontSize: 16}} />}
                                disabled={!toy.connected || testing}
                                onClick={() => {
                                    setTesting(true);
                                    void invokeIpc('lovense:test', toy.id).finally(() => setTimeout(() => setTesting(false), 1500));
                                }}
                                sx={{textTransform: 'none', minWidth: 0}}
                            >
                                {testing ? 'Buzzing…' : 'Test'}
                            </Button>
                        </span>
                    </Tooltip>
                </Stack>
            </Stack>
        </Paper>
    );
}

function LovenseSettingsSection({configAtom}: PluginSettingsProps) {
    const settingsAtom = React.useMemo(() => pluginConfigAtom<LovenseConfig>(configAtom, PLUGIN_ID), [configAtom]);
    const hostAtom = React.useMemo(() => focusKeyAtom(settingsAtom, 'host'), [settingsAtom]);
    const portAtom = React.useMemo(() => focusKeyAtom(settingsAtom, 'port'), [settingsAtom]);
    const enabledAtom = React.useMemo(() => focusKeyAtom(settingsAtom, 'enabled'), [settingsAtom]);
    const [host, setHost] = useAtom(hostAtom);
    const [port, setPort] = useAtom(portAtom);
    const [enabled, setEnabled] = useAtom(enabledAtom);
    const [expanded, setExpanded] = React.useState(false);
    const [showHelp, setShowHelp] = React.useState(false);

    const stateAtom = useSettingsStateAtom();
    const connected = useAtomValue(React.useMemo(() => selectAtom(stateAtom, s => s.lovenseConnected), [stateAtom]));
    const endpoint = useAtomValue(React.useMemo(() => selectAtom(stateAtom, s => s.lovenseEndpoint), [stateAtom]));
    const appInfo = useAtomValue(React.useMemo(() => selectAtom(stateAtom, s => s.lovenseApp), [stateAtom]));
    const error = useAtomValue(React.useMemo(() => selectAtom(stateAtom, s => s.lovenseError), [stateAtom]));
    const toys = useAtomValue(React.useMemo(() => selectAtom(stateAtom, s => s.lovenseToys ?? EMPTY_TOYS), [stateAtom]));

    const alerts: {severity: AlertColor; content: React.ReactNode}[] = [];
    if (enabled) {
        if (!connected) alerts.push({severity: 'error', content: error ?? 'Looking for Lovense Remote…'});
        else if (!toys.some(toy => toy.connected)) alerts.push({severity: 'warning', content: 'Connected, but no toys are connected in Lovense Remote.'});
    }
    const connectedToys = toys.filter(toy => toy.connected).length;
    const status = !enabled ? 'Off'
        : connected ? `${connectedToys} toy${connectedToys === 1 ? '' : 's'} connected`
        : 'Not connected';

    return (
        <MyAccordion
            expanded={expanded}
            onChange={setExpanded}
            summary={
                <Stack direction="row" spacing={1} sx={{alignItems: 'center', width: '100%'}}>
                    <ConnectionBubble color={enabled ? getConnectionBubbleColor(alerts) : 'text.disabled'} />
                    <Typography variant="h6">Lovense Game Mode</Typography>
                    <Typography variant="body2" color="text.secondary" sx={{flex: 1}} noWrap>{status}</Typography>
                    {toys.filter(toy => toy.connected).slice(0, 3).map(toy => (
                        <Stack key={toy.id} direction="row" spacing={0.5} sx={{alignItems: 'center', display: {xs: 'none', sm: 'flex'}}}>
                            <Typography variant="caption" color="text.secondary" noWrap>{toy.nickName || toy.model}</Typography>
                            <BatteryIndicator battery={toy.battery} size={13} />
                        </Stack>
                    ))}
                </Stack>
            }
        >
            <Stack spacing={2}>
                {alerts.map((alert, index) => (
                    <Alert key={index} severity={alert.severity}>{alert.content}</Alert>
                ))}
                {connected && endpoint && (
                    <Typography variant="caption" color="text.secondary">
                        Talking to Lovense Remote{appInfo ? ` (${appInfo})` : ''} at {endpoint}
                    </Typography>
                )}
                {toys.length > 0 && (
                    <Stack direction="row" sx={{flexWrap: 'wrap', gap: 1.5}}>
                        {toys.map(toy => <ToyCard key={toy.id} toy={toy} />)}
                    </Stack>
                )}

                <Stack direction={{xs: 'column', md: 'row'}} spacing={1.5}>
                    <Box sx={{flex: 2}}>
                        <TextCommitInput
                            label="Local IP from Game Mode"
                            value={host ?? ''}
                            placeholder="Leave empty for Lovense Remote on this PC"
                            disabled={!enabled}
                            onCommit={next => setHost(next.trim() || undefined)}
                        />
                    </Box>
                    <Box sx={{flex: 1}}>
                        <TextCommitInput
                            label="Port"
                            value={port === undefined ? '' : String(port)}
                            placeholder="Auto"
                            disabled={!enabled}
                            onCommit={next => {
                                const trimmed = next.trim();
                                if (!trimmed) { setPort(undefined); return; }
                                const parsed = Number(trimmed);
                                if (Number.isInteger(parsed) && parsed > 0 && parsed <= 65535) setPort(parsed);
                            }}
                        />
                    </Box>
                </Stack>

                <Stack direction="row" spacing={1} sx={{alignItems: 'center', justifyContent: 'space-between'}}>
                    <FormControlLabel
                        control={<Switch checked={enabled} onChange={(_e, checked) => setEnabled(checked)} />}
                        label={<Stack direction="row" spacing={0.5} sx={{alignItems: 'center'}}><PowerIcon sx={{fontSize: 16}} /><span>Enable Lovense</span></Stack>}
                    />
                    <Stack direction="row" spacing={0.5}>
                        <Button size="small" startIcon={<HelpIcon />} onClick={() => setShowHelp(v => !v)} sx={{textTransform: 'none'}}>
                            How to connect
                        </Button>
                        <Tooltip title="Refresh toys now">
                            <span>
                                <IconButton size="small" disabled={!enabled} onClick={() => void invokeIpc('lovense:refresh')}>
                                    <RefreshIcon fontSize="small" />
                                </IconButton>
                            </span>
                        </Tooltip>
                    </Stack>
                </Stack>

                <Collapse in={showHelp || (enabled && !connected && toys.length === 0)}>
                    <Paper variant="outlined" sx={{p: 2, borderRadius: 2.5, bgcolor: 'rgba(255,255,255,0.02)'}}>
                        <Stack spacing={1}>
                            <Typography variant="subtitle2">Connect with Lovense Remote</Typography>
                            <Typography variant="body2" component="ol" sx={{pl: 2.5, m: 0, '& li': {mb: 0.5}}}>
                                <li>Pair your toys in the <b>Lovense Remote</b> app (phone or PC).</li>
                                <li>In the app, open <b>Discover → Game Mode</b> and switch on <b>Enable LAN</b>.</li>
                                <li>Type the <b>Local IP</b> it shows into the box above. Add the <b>Port</b> if it lists one, or leave it on Auto.</li>
                                <li>Keep the app open, and keep your phone and PC on the same Wi-Fi with no VPN.</li>
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                                Using Lovense Remote for PC on this computer? Leave the IP empty. No Intiface or Lovense Connect needed.{' '}
                                <Link href="https://www.lovense.com/app/remote" target="_blank" rel="noreferrer">Get Lovense Remote</Link>
                            </Typography>
                        </Stack>
                    </Paper>
                </Collapse>
            </Stack>
        </MyAccordion>
    );
}

export default React.memo(LovenseSettingsSection);
