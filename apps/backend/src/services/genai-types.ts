/**
 * `genai-types.ts`
 * - common types definitions for genai service
 *
 * @author      Lina <lina@lemoncloud.io>
 * @date        2025-11-03 initial version with `lemon-core#4.0.7`
 *
 * @copyright   (C) lemoncloud.io 2025 - All Rights Reserved. (https://eureka.codes)
 */

/**
 * type: `GenAIParam`
 * - parameter for GenAI execution
 */
export interface GenAIParam {
    /** llm model to use */
    model: TransformModelType;

    /**
     * (optional) temperature
     * - a number between 0 and 2, where lower values make the output more focused and deterministic,
     *   while higher values make it more random and creative.
     * - default is 1.0
     * - if not set, the default value of the model will be used.
     */
    temperature?: number;
}

/**
 * type: `GenAIRequest`
 * - request to GenAI service
 */
export interface GenAIRequest {
    /** system prompt */
    system?: CodeContent[];
    /** user prompt */
    user?: CodeContent[];

    /** input code */
    code?: CodeContent[];
    /** app name */
    appName?: string;

    /** (optional) transform histories */
    histories?: CodeContent;
}

/**
 * type: `CodeContent`
 */
export interface CodeContent {
    /** id of content - ex) 'genaiBackend', 'geminiService' */
    id?: string;
    /** content */
    content?: string;
}

/**
 * type: `GenAIResponse`
 * - response for GenAI service
 */
export interface GenAIResponse {
    /** output prompt (or answer) */
    output: CodeContent;
}

/**
 * type: `TransformModelType`
 */
export type TransformModelType = 'gemini-2.5-flash' | 'gemini-2.5-pro';
