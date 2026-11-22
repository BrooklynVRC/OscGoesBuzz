import http from 'node:http';
import https from 'node:https';
import net from 'node:net';

/** Name shown on the Lovense Remote screen while we're connected. */
export const LOVENSE_PLATFORM = 'OscGoesBuzz';

export interface LovenseEndpoint {
    protocol: 'http' | 'https';
    host: string;
    port: number;
}

export interface LovenseResponse {
    code?: number;
    type?: string;
    data?: unknown;
    message?: string;
}

export class LovenseError extends Error {
    constructor(readonly code: number | undefined, message: string) {
        super(message);
    }
}

const ERROR_MESSAGES: Record<number, string> = {
    400: 'Invalid command',
    401: 'Toy not found',
    402: 'Toy not connected',
    403: 'Toy does not support this command',
    404: 'Invalid parameter',
    500: 'Game Mode is not enabled in Lovense Remote',
    506: 'Lovense Remote server error',
};

export function describeEndpoint(endpoint: LovenseEndpoint): string {
    const host = endpoint.host.includes(':') ? `[${endpoint.host}]` : endpoint.host;
    return `${endpoint.protocol}://${host}:${endpoint.port}`;
}

/**
 * Lovense serves a real certificate for "<ip-with-dashes>.lovense.club". We connect to the IP directly
 * (so routers that block DNS rebinding don't break it) but verify the certificate against that name.
 */
export function lovenseTlsName(host: string): string | undefined {
    if (net.isIPv4(host)) return `${host.replace(/\./g, '-')}.lovense.club`;
    if (host.toLowerCase() === 'localhost') return '127-0-0-1.lovense.club';
    return undefined;
}

/** The ordered list of endpoints worth trying for a host/port the user gave us (or didn't). */
export function candidateEndpoints(host: string | undefined, port: number | undefined): LovenseEndpoint[] {
    const target = host ?? '127.0.0.1';
    if (port !== undefined) {
        return [
            {protocol: 'https', host: target, port},
            {protocol: 'http', host: target, port},
        ];
    }
    return [
        {protocol: 'https', host: target, port: 30010},
        {protocol: 'http', host: target, port: 20010},
        {protocol: 'https', host: target, port: 34568},
        {protocol: 'http', host: target, port: 34567},
    ];
}

export function sendLovenseCommand(
    endpoint: LovenseEndpoint,
    body: Record<string, unknown>,
    timeoutMs = 2500,
    signal?: AbortSignal,
): Promise<LovenseResponse> {
    const payload = JSON.stringify(body);
    const tlsName = endpoint.protocol === 'https' ? lovenseTlsName(endpoint.host) : undefined;
    const options: https.RequestOptions = {
        host: endpoint.host,
        port: endpoint.port,
        path: '/command',
        method: 'POST',
        timeout: timeoutMs,
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(payload),
            'X-platform': LOVENSE_PLATFORM,
            ...(tlsName ? {Host: `${tlsName}:${endpoint.port}`} : {}),
        },
        ...(tlsName ? {servername: tlsName} : {}),
        ...(signal ? {signal} : {}),
        agent: false,
    };
    const transport = endpoint.protocol === 'https' ? https : http;

    return new Promise((resolve, reject) => {
        const request = transport.request(options, response => {
            const chunks: Buffer[] = [];
            response.on('data', (chunk: Buffer) => chunks.push(chunk));
            response.on('end', () => {
                const text = Buffer.concat(chunks).toString('utf8');
                let parsed: LovenseResponse;
                try {
                    parsed = JSON.parse(text) as LovenseResponse;
                } catch {
                    reject(new LovenseError(response.statusCode, `Unexpected response (${response.statusCode ?? '?'})`));
                    return;
                }
                const code = typeof parsed.code === 'number' ? parsed.code : Number(parsed.code);
                if (code === 200 || (Number.isNaN(code) && parsed.type === 'OK')) {
                    resolve(parsed);
                } else {
                    reject(new LovenseError(code, ERROR_MESSAGES[code] ?? parsed.message ?? `Error ${code}`));
                }
            });
            response.on('error', reject);
        });
        request.on('timeout', () => request.destroy(new LovenseError(undefined, 'Timed out')));
        request.on('error', reject);
        request.end(payload);
    });
}
