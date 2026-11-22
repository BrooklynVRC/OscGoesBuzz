import React from 'react';
import {atom} from 'jotai';
import {selectAtom} from 'jotai/utils';
import {Stack, Typography} from '@mui/material';
import type {OutputPresentation, OutputPresentationAtoms} from '../../../frontend/plugins/Plugin';
import {OUTPUT_PREFIX} from '../shared/config';
import BatteryIndicator from './BatteryIndicator';

/** "lovense.<toyId>.<function>" → toyId */
export function toyIdFromOutputId(id: string): string | undefined {
    if (!id.startsWith(OUTPUT_PREFIX)) return undefined;
    const rest = id.slice(OUTPUT_PREFIX.length);
    const dot = rest.lastIndexOf('.');
    return dot > 0 ? rest.slice(0, dot) : undefined;
}

export function outputPresentation({outputId: outputIdAtom, info: infoAtom, settings}: OutputPresentationAtoms) {
    const connectedAtom = selectAtom(settings, state => state.lovenseConnected);
    const toysAtom = selectAtom(settings, state => state.lovenseToys);
    return atom<OutputPresentation | undefined>(get => {
        const outputId = get(outputIdAtom);
        const toyId = toyIdFromOutputId(outputId);
        if (!toyId) return undefined;
        const info = get(infoAtom);
        const toy = (get(toysAtom) ?? []).find(candidate => candidate.id === toyId);
        const alerts: OutputPresentation['alerts'] = [];
        if (!info?.connected) {
            alerts.push({
                severity: 'error',
                content: !get(connectedAtom)
                    ? 'Lovense Remote is not connected, so this toy is unavailable.'
                    : 'This toy is not connected in Lovense Remote. Turn it on and reconnect it in the app.',
            });
        } else if (toy?.battery !== undefined && toy.battery <= 15) {
            alerts.push({severity: 'warning', content: `Battery is low (${toy.battery}%). Charge it soon.`});
        }
        return {
            alerts,
            subtitle: (
                <Stack direction="row" spacing={1} component="span" sx={{alignItems: 'center'}}>
                    <span>Lovense{toy ? ` · ${toy.model}` : ''}</span>
                    {toy?.connected && <BatteryIndicator battery={toy.battery} size={12} />}
                </Stack>
            ),
        };
    });
}
