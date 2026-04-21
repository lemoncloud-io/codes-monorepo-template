/**
 * Calc service client.
 * - Provides a unified `calc()` API for mock mode and real HTTP mode.
 */

import { AddRequest, AddResponse, AddOp, CalcServicePort } from './types';

export interface CalcServiceOptions {
    baseUrl: string;
    isMock?: boolean;
}

/**
 * Calc API adapter.
 * - `isMock=true`: run deterministic local calculation (sandbox/unit-test friendly)
 * - `isMock=false`: call backend calc API (`POST /hello/{id}/add`)
 */
export class CalcService implements CalcServicePort {
    private readonly baseUrl: string;
    private readonly isMock: boolean;

    constructor(options: CalcServiceOptions) {
        this.baseUrl = options?.baseUrl || 'http://localhost:8830';
        this.isMock = !!options.isMock;
    }

    async calc(id: AddOp, a: number, b: number): Promise<AddResponse> {
        if (this.isMock) {
            return this.mockCalc(id, { a, b });
        }

        return (await this.fetchCalc(id, { a, b }));
    }

    /**
     * Mock/sandbox execution path.
     * - Keeps behavior aligned with backend calc rules for supported operations.
     */
    private mockCalc(id: AddOp, req: AddRequest): AddResponse {
        const { a, b } = req;
        const op: AddOp = id === '0' ? 'add' : id;

        if (op === 'add') return { v: a + b };
        if (op === 'minus') return { v: a - b };
        if (op === 'divide') return { v: b === 0 ? 0 : a / b };
        if (op === 'multiply') return { v: a * b };

        throw new Error(`Unsupported calc operation id: ${id}`);
    }

    /**
     * Real API execution path.
     * - Calls backend `doPostAdd` route.
     * - Backend treats `id='0'` as `add`.
     */
    private async fetchCalc(id: AddOp, req: AddRequest): Promise<AddResponse> {
        const body: AddRequest = req;

        const response = await fetch(`${this.baseUrl}/hello/${id}/add`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
        });

        if (!response.ok) {
            const text = await response.text().catch(() => '');
            throw new Error(`Calc add API failed with status ${response.status}: ${text}`);
        }

        const data: AddResponse = await response.json();

        if (typeof data?.v !== 'number') {
            throw new Error('Unexpected response format from calc add API.');
        }

        return data;
    }
}
