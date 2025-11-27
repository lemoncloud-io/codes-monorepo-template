/**
 * `hello-api.ts`
 * - service endpoint for `/hello`
 *
 *
 * @author      Steve Jung <steve@lemoncloud.io>
 * @date        2025-10-10 initial version with `lemon-core#4.0.7`
 *
 * @copyright   (C) lemoncloud.io 2025 - All Rights Reserved. (https://eureka.codes)
 */
import { View, CoreModel } from 'lemon-model';
import { $T, $U, _log, NextHandler, GeneralWEBController } from 'lemon-core';
import { TestView } from '../service/views';
import $service, { HelloService } from '../service/service';
import { estimateAudioDuration, generateSpeechFromText } from '../services/geminiService';
const NS = $U.NS('hello', 'yellow'); // NAMESPACE TO BE PRINTED.

/* eslint-disable @typescript-eslint/no-unused-vars */
/**
 * class: `HelloAPIController`
 * - handle of `/hello` type
 *
 * support basic CRUD operations.
 * - GET    /hello         => list-all
 * - GET    /hello/:id     => get-one
 * - POST   /hello/:id     => create-new (at position :id)
 * - PUT    /hello/:id     => update-existing (at position :id)
 * - DELETE /hello/:id     => delete-existing (at position :id)
 * - GET    /hello/:id/say => get-one with say command.
 * - POST   /hello/:id/say => set-one with say command.
 */
export class HelloAPIController extends GeneralWEBController {
    /**
     * default constructor.
     */
    public constructor(readonly service: HelloService = $service) {
        super('hello');
        _log(NS, `HelloAPIController()...`);
    }

    /**
     * name of this resource.
     */
    public hello = () => `hello-api-controller:${this.type()}`;

    /**
     * transform from model to view.
     */
    public modelAsView = <V extends View, M = CoreModel<any>>(model: M) => $U.cleanup({ ...model }) as V;

    /**
     * list hello
     *
     * ```sh
     * $ http ':8000/hello'
     */
    public doList: NextHandler = async (id, param, body, context) => {
        const errScope = `doList(${this.type()}/${id ?? ''})`;
        _log(NS, `${errScope} ...`);
        id = id === '0' ? '' : $T.S2(id);
        if (id) throw new Error(`@id[${id}] is invalid - ${errScope}`);
        throw new Error(`401 NOT IMPLEMENTED - ${errScope}`);
    };

    /**
     * get hello hello
     *
     * ```sh
     * $ http ':8000/hello/0'
     * $ http ':8000/hello/abc'
     */
    public doGet: NextHandler = async (id, param, body, context) => {
        const errScope = `doGet(${this.type()}/${id ?? ''})`;
        _log(NS, `${errScope} ...`);
        id = id === '0' ? '' : $T.S2(id);
        if (!id) return { message: this.hello(), timestamp: $U.ts() };

        //* read from database.
        if (/^[a-zA-Z]+$/.test(id)) {
            const model = await this.service.$test.retrieve(id);
            if (!model?.id) throw new Error(`404 NOT FOUND - invalid id[${id}] @${errScope}`);
            return this.modelAsView<TestView>(model);
        }

        // otherwise, error.
        throw new Error(`@id[${id}] is invalid - ${errScope}`);
    };

    /**
     * post generate hello
     *
     * ```sh
     * $ http POST ':8000/hello/generate-speech-from-text/generate' text='hello world'
     * $ http POST ':8000/hello/estimate-audio-duration/generate' text='hello world' speed='normal'
     */
    public doPostGenerate: NextHandler = async (id, param, body, context) => {
        const errScope = `doPostGenerate(${this.type()}/${id ?? ''})`;
        _log(NS, `${errScope} ...`);
        id = id === '0' ? '' : $T.S2(id);
        if (!id) throw new Error(`@id[${id}] is required - ${errScope}`);

        switch (id) {
            case 'generate-speech-from-text':
                return await generateSpeechFromText(body);
            case 'estimate-audio-duration':
                return estimateAudioDuration(body);
            default:
                throw new Error(`404 NOT FOUND - unsupported type[${id}] @${errScope}`);
        }
    };
}

//*export as default.
export default new HelloAPIController();
