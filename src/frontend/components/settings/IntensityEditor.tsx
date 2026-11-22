import React, {useEffect, useMemo, useRef, useState} from 'react';
import {Box, Button, Chip, Slider, Stack, ToggleButton, ToggleButtonGroup, Typography, useTheme} from '@mui/material';
import {Tune as TuneIcon} from '@mui/icons-material';
import {type PrimitiveAtom, useAtom} from 'jotai';
import type {OutputConfig, OutputIntensityConfig, OutputPatternKind} from '../../../common/application/configTypes';
import {DEFAULT_INTENSITY, isDefaultIntensity, patternValue} from '../../../common/intensity';
import {focusKeyAtom} from '../../utils/atomUtils';
import MyAccordion from '../util/MyAccordion';

const PATTERNS: {id: OutputPatternKind; label: string}[] = [
    {id: 'steady', label: 'Steady'},
    {id: 'pulse', label: 'Pulse'},
    {id: 'wave', label: 'Wave'},
    {id: 'heartbeat', label: 'Heartbeat'},
    {id: 'fireworks', label: 'Fireworks'},
    {id: 'earthquake', label: 'Earthquake'},
];

const CURVE_MARKS = [
    {value: 0.4, label: 'Sensitive'},
    {value: 1, label: 'Linear'},
    {value: 2.5, label: 'Gentle'},
];

interface Props {
    outputAtom: PrimitiveAtom<OutputConfig>;
}

function pct(value: number) {
    return `${Math.round(value * 100)}%`;
}

/** Drop default values so untouched outputs keep a clean config. */
function compact(config: OutputIntensityConfig): OutputIntensityConfig | undefined {
    const next: OutputIntensityConfig = {};
    if ((config.min ?? 0) > 0) next.min = config.min!;
    if ((config.max ?? 1) < 1) next.max = config.max!;
    if ((config.curve ?? 1) !== 1) next.curve = config.curve!;
    if ((config.pattern ?? 'steady') !== 'steady') next.pattern = config.pattern!;
    if (next.pattern && (config.patternSpeed ?? 1) !== 1) next.patternSpeed = config.patternSpeed!;
    return Object.keys(next).length > 0 ? next : undefined;
}

function CurvePreview({min, max, curve}: {min: number; max: number; curve: number}) {
    const theme = useTheme();
    const w = 120, h = 72, pad = 4;
    const points: string[] = [];
    for (let i = 0; i <= 40; i++) {
        const x = i / 40;
        const y = x <= 0.001 ? 0 : min + (max - min) * Math.pow(x, curve);
        points.push(`${(pad + x * (w - 2 * pad)).toFixed(1)},${(h - pad - y * (h - 2 * pad)).toFixed(1)}`);
    }
    return (
        <Box component="svg" viewBox={`0 0 ${w} ${h}`} sx={{width: w, height: h, flexShrink: 0, borderRadius: 1.5, bgcolor: 'rgba(255,255,255,0.03)', border: '1px solid', borderColor: 'divider'}}>
            <line x1={pad} y1={h - pad} x2={w - pad} y2={pad} stroke="rgba(255,255,255,0.12)" strokeDasharray="3 3" />
            <polyline points={points.join(' ')} fill="none" stroke={theme.palette.primary.main} strokeWidth={2.25} strokeLinecap="round" />
        </Box>
    );
}

function PatternPreview({pattern, speed}: {pattern: OutputPatternKind; speed: number}) {
    const theme = useTheme();
    const ref = useRef<SVGPolylineElement>(null);
    const w = 240, h = 40;
    useEffect(() => {
        let frame = 0;
        const draw = () => {
            const now = performance.now() / 1000;
            const points: string[] = [];
            for (let i = 0; i <= 120; i++) {
                const x = i / 120;
                const value = patternValue(pattern, (now - 3 + x * 3) * speed);
                points.push(`${(x * w).toFixed(1)},${(h - 3 - value * (h - 6)).toFixed(1)}`);
            }
            ref.current?.setAttribute('points', points.join(' '));
            frame = requestAnimationFrame(draw);
        };
        draw();
        return () => cancelAnimationFrame(frame);
    }, [pattern, speed]);
    return (
        <Box component="svg" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" sx={{width: '100%', height: h, display: 'block', borderRadius: 1.5, bgcolor: 'rgba(255,255,255,0.03)', border: '1px solid', borderColor: 'divider'}}>
            <polyline ref={ref} fill="none" stroke={theme.palette.secondary.main} strokeWidth={2} strokeLinejoin="round" />
        </Box>
    );
}

function IntensityEditor({outputAtom}: Props) {
    const intensityAtom = useMemo(() => focusKeyAtom(outputAtom, 'intensity'), [outputAtom]);
    const [stored, setStored] = useAtom(intensityAtom);
    const [expanded, setExpanded] = useState(false);
    // Sliders edit a local draft and commit when released, so dragging doesn't rewrite the config file constantly.
    const [draft, setDraft] = useState<OutputIntensityConfig>(stored ?? {});
    useEffect(() => setDraft(stored ?? {}), [stored]);
    const commit = (next: OutputIntensityConfig) => {
        setDraft(next);
        setStored(compact(next));
    };

    const min = draft.min ?? DEFAULT_INTENSITY.min;
    const max = draft.max ?? DEFAULT_INTENSITY.max;
    const curve = draft.curve ?? DEFAULT_INTENSITY.curve;
    const pattern = draft.pattern ?? DEFAULT_INTENSITY.pattern;
    const speed = draft.patternSpeed ?? DEFAULT_INTENSITY.patternSpeed;
    const isDefault = isDefaultIntensity(stored);

    const chips: string[] = [];
    if (min > 0 || max < 1) chips.push(`${pct(min)}–${pct(max)}`);
    if (curve !== 1) chips.push(curve < 1 ? 'Sensitive curve' : 'Gentle curve');
    if (pattern !== 'steady') chips.push(PATTERNS.find(p => p.id === pattern)?.label ?? pattern);

    return (
        <MyAccordion
            expanded={expanded}
            onChange={setExpanded}
            sx={{bgcolor: 'action.hover'}}
            summary={
                <Stack direction="row" spacing={1} sx={{alignItems: 'center', flexWrap: 'wrap', rowGap: 0.5}}>
                    <TuneIcon sx={{fontSize: 18, color: 'text.secondary'}} />
                    <Typography variant="subtitle2">Intensity &amp; Patterns</Typography>
                    {chips.map(chip => <Chip key={chip} label={chip} size="small" color="primary" variant="outlined" sx={{height: 20, fontSize: '0.7rem'}} />)}
                </Stack>
            }
        >
            {expanded && (
                <Stack spacing={2.5}>
                    <Stack direction="row" spacing={2.5} sx={{alignItems: 'center'}}>
                        <CurvePreview min={min} max={max} curve={curve} />
                        <Stack spacing={1.5} sx={{flex: 1, minWidth: 0}}>
                            <Box>
                                <Stack direction="row" sx={{justifyContent: 'space-between'}}>
                                    <Typography variant="body2">Output range</Typography>
                                    <Typography variant="body2" color="text.secondary">{pct(min)} – {pct(max)}</Typography>
                                </Stack>
                                <Slider
                                    size="small"
                                    min={0}
                                    max={1}
                                    step={0.01}
                                    value={[min, max]}
                                    disableSwap
                                    valueLabelDisplay="auto"
                                    valueLabelFormat={pct}
                                    onChange={(_e, value) => {
                                        const [lo, hi] = value as number[];
                                        setDraft(d => ({...d, min: lo!, max: hi!}));
                                    }}
                                    onChangeCommitted={(_e, value) => {
                                        const [lo, hi] = value as number[];
                                        commit({...draft, min: lo!, max: hi!});
                                    }}
                                />
                                <Typography variant="caption" color="text.secondary">
                                    The minimum kicks in as soon as anything touches you, so light contact is still felt. The maximum caps this device.
                                </Typography>
                            </Box>
                        </Stack>
                    </Stack>
                    <Box sx={{px: 1}}>
                        <Stack direction="row" sx={{justifyContent: 'space-between'}}>
                            <Typography variant="body2">Response curve</Typography>
                            <Typography variant="body2" color="text.secondary">{curve.toFixed(2)}×</Typography>
                        </Stack>
                        <Slider
                            size="small"
                            min={0.3}
                            max={3}
                            step={0.05}
                            marks={CURVE_MARKS}
                            value={curve}
                            onChange={(_e, value) => setDraft(d => ({...d, curve: value as number}))}
                            onChangeCommitted={(_e, value) => commit({...draft, curve: value as number})}
                        />
                    </Box>
                    <Stack spacing={1}>
                        <Typography variant="body2">Pattern</Typography>
                        <ToggleButtonGroup
                            size="small"
                            exclusive
                            value={pattern}
                            onChange={(_e, value: OutputPatternKind | null) => value && commit({...draft, pattern: value})}
                            sx={{flexWrap: 'wrap'}}
                        >
                            {PATTERNS.map(p => <ToggleButton key={p.id} value={p.id} sx={{px: 1.5, textTransform: 'none'}}>{p.label}</ToggleButton>)}
                        </ToggleButtonGroup>
                        {pattern !== 'steady' && (
                            <Stack spacing={1}>
                                <PatternPreview pattern={pattern} speed={speed} />
                                <Stack direction="row" spacing={2} sx={{alignItems: 'center', px: 1}}>
                                    <Typography variant="body2" sx={{whiteSpace: 'nowrap'}}>Speed</Typography>
                                    <Slider
                                        size="small"
                                        min={0.25}
                                        max={3}
                                        step={0.05}
                                        value={speed}
                                        valueLabelDisplay="auto"
                                        valueLabelFormat={v => `${v.toFixed(2)}×`}
                                        onChange={(_e, value) => setDraft(d => ({...d, patternSpeed: value as number}))}
                                        onChangeCommitted={(_e, value) => commit({...draft, patternSpeed: value as number})}
                                    />
                                </Stack>
                                <Typography variant="caption" color="text.secondary">
                                    The pattern rides on top of your avatar's intensity, so stronger contact still feels stronger.
                                </Typography>
                            </Stack>
                        )}
                    </Stack>
                    {!isDefault && (
                        <Box>
                            <Button size="small" onClick={() => commit({})}>Reset to defaults</Button>
                        </Box>
                    )}
                </Stack>
            )}
        </MyAccordion>
    );
}

export default React.memo(IntensityEditor);
