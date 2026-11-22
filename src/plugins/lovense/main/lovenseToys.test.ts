import assert from 'node:assert/strict';
import {test} from 'node:test';
import {buildAction, getToyFunctions, normalizeAction, parseToys, toStep} from './lovenseToys';
import {candidateEndpoints, lovenseTlsName} from './LovenseClient';

test('GetToys payload with stringified toys is parsed', () => {
    const toys = parseToys({
        toys: JSON.stringify({
            ff922f7fd345: {
                id: 'ff922f7fd345', name: 'nora', nickName: '', status: '1', battery: 87, version: '3',
                shortFunctionNames: ['v', 'r'], fullFunctionNames: ['Vibrate', 'Rotate'],
            },
            aa11: {id: 'aa11', name: 'lush', status: 0, battery: '42'},
        }),
        platform: 'ios',
        appType: 'remote',
    });
    assert.equal(toys.length, 2);
    const nora = toys.find(toy => toy.state.id === 'ff922f7fd345')!;
    assert.equal(nora.state.model, 'Nora');
    assert.equal(nora.state.battery, 87);
    assert.equal(nora.state.connected, true);
    assert.deepEqual(nora.functions.map(fn => [fn.action, fn.type]), [['Vibrate', 'vibrate'], ['Rotate', 'rotate']]);
    const lush = toys.find(toy => toy.state.id === 'aa11')!;
    assert.equal(lush.state.connected, false);
    assert.equal(lush.state.battery, 42);
    assert.deepEqual(lush.state.functions, ['Vibrate']);
});

test('function names normalize from short and long forms', () => {
    assert.equal(normalizeAction('v'), 'Vibrate');
    assert.equal(normalizeAction('v2'), 'Vibrate2');
    assert.equal(normalizeAction('pump'), 'Pump');
    assert.equal(normalizeAction('???'), undefined);
    assert.deepEqual(getToyFunctions({name: 'max'}).map(fn => [fn.action, fn.max]), [['Vibrate', 20], ['Pump', 3]]);
    assert.deepEqual(getToyFunctions({fullFunctionNames: ['Vibrate', 'Vibrate1', 'Vibrate2']}).map(fn => fn.action), ['Vibrate1', 'Vibrate2']);
    assert.deepEqual(getToyFunctions({fullFunctionNames: ['Stroke', 'Thrusting']}).map(fn => fn.action), ['Thrusting']);
});

test('levels map to steps without dropping small values', () => {
    assert.equal(toStep(0, 20), 0);
    assert.equal(toStep(0.01, 20), 1);
    assert.equal(toStep(0.5, 20), 10);
    assert.equal(toStep(1.5, 3), 3);
    assert.equal(toStep(-0.5, 20), 10);
});

test('combined actions keep idle motors explicitly at zero', () => {
    assert.equal(buildAction(new Map([['Vibrate', 0], ['Rotate', 0]])), undefined);
    assert.equal(buildAction(new Map([['Vibrate', 5], ['Rotate', 0]])), 'Vibrate:5,Rotate:0');
});

test('endpoints and TLS names', () => {
    assert.equal(lovenseTlsName('192.168.1.20'), '192-168-1-20.lovense.club');
    assert.equal(lovenseTlsName('localhost'), '127-0-0-1.lovense.club');
    assert.equal(lovenseTlsName('my-phone.local'), undefined);
    assert.deepEqual(candidateEndpoints('10.0.0.5', 30010).map(e => e.protocol), ['https', 'http']);
    assert.equal(candidateEndpoints(undefined, undefined)[0]!.host, '127.0.0.1');
});
