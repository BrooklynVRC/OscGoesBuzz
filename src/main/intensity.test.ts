import assert from 'node:assert/strict';
import {test} from 'node:test';
import {isDefaultIntensity, patternValue, shapeIntensity} from '../common/intensity';

test('default intensity is a pass-through', () => {
    for (const level of [0, 0.1, 0.5, 1]) assert.equal(shapeIntensity(level, undefined, 0), level);
    assert.equal(shapeIntensity(2, undefined, 0), 1);
    assert.ok(isDefaultIntensity({}));
});

test('min/max window and curve', () => {
    assert.equal(shapeIntensity(0, {min: 0.3}, 0), 0, 'floor never wakes an idle output');
    assert.ok(Math.abs(shapeIntensity(0.01, {min: 0.3, max: 0.8}, 0) - 0.305) < 0.001);
    assert.equal(shapeIntensity(1, {max: 0.6}, 0), 0.6);
    assert.equal(shapeIntensity(0.5, {curve: 2}, 0), 0.25);
    assert.equal(shapeIntensity(1, {min: 0.9, max: 0.5}, 0), 0.5, 'min is capped by max');
});

test('patterns stay within range', () => {
    for (const pattern of ['steady', 'pulse', 'wave', 'heartbeat', 'fireworks', 'earthquake'] as const) {
        for (let t = 0; t < 10; t += 0.037) {
            const value = patternValue(pattern, t);
            assert.ok(value >= 0 && value <= 1, `${pattern} at ${t} = ${value}`);
        }
    }
    assert.equal(shapeIntensity(1, {pattern: 'pulse'}, 0), 1);
    assert.equal(shapeIntensity(1, {pattern: 'pulse'}, 600), 0.15);
});
