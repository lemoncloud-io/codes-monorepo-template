/**
 * calcService.test.ts
 * - basic mock-mode contract tests for `CalcService`
 * - verifies calc result shape/value using sample fixture data
 */
import { CalcService } from './calcService';
import sample from './calc-sample.json';
import {expect2} from 'lemon-core';

export const instance = () => {
    // Build a mock-mode service instance for deterministic unit tests.
    const calc = new CalcService({
        baseUrl: '',
        isMock: true,
    });
    return calc;
}

describe('CalcService', () => {
    it('should pass basic tests(mock)', () => {
        const calc = instance();
        // For the same request inputs, calc results should match sample responses.
        expect2(calc.calc('0', 1, 2)).toEqual(sample['0'].response);
        expect2(calc.calc('add', 1, 2)).toEqual(sample['add'].response);
        expect2(calc.calc('minus', 1, 2)).toEqual(sample['minus'].response);
        expect2(calc.calc('divide', 1, 2)).toEqual(sample['divide'].response);
        expect2(calc.calc('multiply', 1, 2)).toEqual(sample['multiply'].response);

    });
});
