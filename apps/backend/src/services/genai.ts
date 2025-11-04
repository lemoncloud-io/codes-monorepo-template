/**
 * `genai.ts`
 * - genai service
 *
 * @author      Lina <lina@lemoncloud.io>
 * @date        2025-11-03 initial version with `lemon-core#4.0.7`
 *
 * @copyright   (C) lemoncloud.io 2025 - All Rights Reserved. (https://eureka.codes)
 */
import $cores, {
    $U,
    _log,
    _inf,
    _err,
    loadJsonSync,
    GETERR,
    $info,
    $rand,
    loadDataYml,
    $T,
    onlyDefined,
} from 'lemon-core';
import { GenerateContentConfig, GenerateContentParameters, GoogleGenAI } from '@google/genai';
import { TransformModelType, GenAIParam, GenAIRequest, GenAIResponse, CodeContent } from './genai-types';
import Mustache from 'mustache';
const NS = $U.NS('trans', 'yellow'); // NAMESPACE TO BE PRINTED.

const apiKey = process.env.API_KEY;
if (!apiKey) throw new Error(`.apiKey (string) is required (see env.API_KEY)`);

const genai = new GoogleGenAI({ apiKey: process.env.API_KEY });

/**
 * convert GenAIRequest to CodeTransformParams
 */
export function asCodeReTransformParams(
    $par: TransformModelType | GenAIParam,
    $req: GenAIRequest,
    options?: { step?: number },
): GenerateContentParameters {
    const model = typeof $par === 'string' ? $par : $par.model;
    const param = typeof $par === 'string' ? { model } : $par;
    const errScope = `asCodeReTransformParams(${model ?? ''})`;
    if (!model) throw new Error(`.model (TransformModelType) is required - ${errScope}`);
    const appName = $req?.appName;
    if (!appName) throw new Error(`.appName (string) is required - ${errScope}`);

    /**
     * build transform-params
     * - convert to user-completion input
     */
    const _init = (): GenerateContentParameters => {
        if (!$req) return;
        const codes = $req?.code;
        const histories = $req?.histories;
        const $data = {
            appName: appName,
            serviceCode: histories?.content ?? codes.filter(f => f.id === 'geminiService')?.at(0).content,
            typeCode: codes.filter(f => f.id === 'types')?.at(0).content,
            apiCode: codes.filter(f => f.id === 'api')?.at(0).content,
        };

        // create user content
        const userTemplate = $req?.user?.at($T.N(options?.step - 1)).content ?? '';
        const content = Mustache.render(userTemplate, $data);
        _log(NS, `> userContent.len =`, content?.length ?? 0);
        return { model: model, contents: content };
    };

    /** convert system prompt to config */
    const _system = (): GenerateContentConfig => {
        if (!$req) return;
        const content = $req?.system?.at(0).content ?? '';
        const system = { systemInstruction: content };
        return system;
    };

    // STEP.1 build code refactor params.
    const params = _init();

    // STEP.2 create code refactor config.
    const system = _system();

    //* return finally.
    const result: GenerateContentParameters = { ...params, config: system };
    if (typeof param.temperature === 'number') result.config['temperature'] = param.temperature;
    return result;
}

/**
 * generate content via GenAI.
 */
export async function generateContent(
    param: GenAIParam | TransformModelType,
    $reqs: GenAIRequest,
    options?: { step?: number },
): Promise<GenAIResponse> {
    const model: TransformModelType = typeof param === 'string' ? param : param?.model;
    const errScope = `generateContent(${model ?? ''}/${$reqs?.appName ?? ''})`;
    _log(NS, `${errScope} ...`);
    const step = $T.N(options?.step);

    /** extract code from code block */
    const _code = (text: string): string => {
        const match = text.match(/^```(?:typescript|ts)?\s*\n?([\s\S]*?)\n?```[\s\n]*$/);
        const code = match ? match[1].trim() : text.trim();
        return code;
    };

    // STEP.0 validate parameters.
    if (!model) throw new Error(`.model (TransformModelType) is required - ${errScope})`);
    if (!$reqs) throw new Error(`.req (GenAIRequest) is required - ${errScope}`);

    // STEP.1 build code refactor 1 params.
    const $param = asCodeReTransformParams(model, $reqs, { step: step });
    _inf(NS, `> $param =`, $U.json($param, { indent: 2 }));

    // STEP.2 generate the response via genai.
    const $res = await genai.models.generateContent($param);

    // STEP.3 extract code from genai response.
    const [genaiResponse] = $res?.candidates;
    const rawText = genaiResponse.content?.parts?.at(0)?.text;
    const code = _code(rawText);

    //* select the response and build output.
    const output = onlyDefined<CodeContent>({
        content: code ?? '',
    });

    return { output };
}
