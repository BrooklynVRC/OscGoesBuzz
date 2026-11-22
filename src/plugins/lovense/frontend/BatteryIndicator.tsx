import React from 'react';
import {Stack, Typography} from '@mui/material';
import {
    Battery20 as Battery20Icon,
    Battery50 as Battery50Icon,
    Battery80 as Battery80Icon,
    BatteryFull as BatteryFullIcon,
    BatteryUnknown as BatteryUnknownIcon,
} from '@mui/icons-material';

export function batteryColor(battery: number | undefined) {
    if (battery === undefined) return 'text.disabled';
    if (battery <= 15) return 'error.main';
    if (battery <= 35) return 'warning.main';
    return 'success.main';
}

export default function BatteryIndicator({battery, size = 16}: {battery: number | undefined; size?: number}) {
    const Icon = battery === undefined ? BatteryUnknownIcon
        : battery <= 20 ? Battery20Icon
        : battery <= 50 ? Battery50Icon
        : battery <= 85 ? Battery80Icon
        : BatteryFullIcon;
    return (
        <Stack direction="row" spacing={0.25} sx={{alignItems: 'center'}}>
            <Icon sx={{fontSize: size, color: batteryColor(battery), transform: 'rotate(90deg)'}} />
            <Typography variant="caption" sx={{color: batteryColor(battery), fontVariantNumeric: 'tabular-nums', fontWeight: 600}}>
                {battery === undefined ? '—' : `${battery}%`}
            </Typography>
        </Stack>
    );
}
