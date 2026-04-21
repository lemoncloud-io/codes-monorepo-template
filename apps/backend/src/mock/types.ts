/**
 * types.ts
 * - shared contracts for calc service request/response and operation ids
 */

/**
 * type: `AddRequest`
 * - request payload body for calc API
 */
export interface AddRequest {
    a: number;
    b: number;
}

/**
 * type: `AddResponse`
 * - normalized calc API response
 */
export interface AddResponse {
    v: number;
}

/**
 * interface: `CalcServicePort`
 * - public calc service contract used by app/tests
 */
export interface CalcServicePort {
    calc(id: AddOp, a: number, b: number): Promise<AddResponse>;
}

/**
 * type: `AddOp`
 * - supported calc operation ids (plus extensible string for future ops)
 */
export type AddOp = 'add' | 'minus' | 'divide' | 'multiply' | string;
