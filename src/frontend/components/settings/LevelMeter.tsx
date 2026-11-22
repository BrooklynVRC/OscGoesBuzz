import React from 'react';
import {Box, Stack, Typography} from '@mui/material';

interface Props {
    level: number;
}

/** Compact live output bar shown in an output's header. */
function LevelMeter({level}: Props) {
    const value = Math.max(0, Math.min(1, level));
    const percent = Math.round(value * 100);
    return (
        <Stack direction="row" spacing={0.75} sx={{alignItems: 'center'}} aria-label={`Output ${percent}%`}>
            <Box sx={{width: 56, height: 6, borderRadius: 3, bgcolor: 'rgba(255,255,255,0.08)', overflow: 'hidden'}}>
                <Box
                    sx={{
                        width: `${percent}%`,
                        height: '100%',
                        borderRadius: 3,
                        background: theme => `linear-gradient(90deg, ${theme.palette.secondary.main}, ${theme.palette.primary.main})`,
                        transition: 'width 80ms linear',
                    }}
                />
            </Box>
            <Typography variant="body2" color={percent > 0 ? 'text.primary' : 'text.disabled'} sx={{width: 34, textAlign: 'right', fontVariantNumeric: 'tabular-nums'}}>
                {percent}%
            </Typography>
        </Stack>
    );
}

export default React.memo(LevelMeter);
