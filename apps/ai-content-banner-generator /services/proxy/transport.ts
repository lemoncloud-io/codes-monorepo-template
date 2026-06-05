/**
 * `proxy/transport.ts`
 * - Browser/WebSocket helpers for receiving proxy generate results over JSONTransport.
 *
 * @origin eureka-agents-api / src/lib/proxy/transport.ts
 */
import { createJSONTransport, JSONTransportOptions, JSONTransportPacket } from '../socket/transport';
import {
    NetworkMessageHandler,
    NetworkSupportable,
    SocketErrorHandler,
    SocketNetworkOptions,
    SocketReadyState,
    SocketUnsubscribe,
} from '../socket/types';
import { ProxyTransportReceiver } from './types';
import type { BrowserWebSocketDumpTestOptions, BrowserWebSocketDumpTestResult } from './dump-test';
import { browserWebSocketDumpTest } from './dump-test';

/** event map required from a browser-like WebSocket object */
export interface WebSocketCompartibleEventMap {
    open: unknown;
    close: unknown;
    error: unknown;
    message: { data: unknown };
}

/** preferred spelling for WebSocket-compatible event maps */
export type WebSocketCompatibleEventMap = WebSocketCompartibleEventMap;

/**
 * Minimal WebSocket-compatible contract.
 *
 * This keeps the proxy package usable in browsers, tests, and custom UI runtimes
 * without depending directly on the DOM `WebSocket` type.
 */
export interface WebSocketCompartible {
    readonly CONNECTING?: number;
    readonly OPEN?: number;
    readonly CLOSING?: number;
    readonly CLOSED?: number;
    readonly readyState: number;
    send(data: string): void;
    addEventListener<K extends keyof WebSocketCompartibleEventMap>(
        type: K,
        handler: (event: WebSocketCompartibleEventMap[K]) => void,
        options?: { once?: boolean },
    ): void;
    removeEventListener<K extends keyof WebSocketCompartibleEventMap>(
        type: K,
        handler: (event: WebSocketCompartibleEventMap[K]) => void,
    ): void;
}

/** preferred spelling; `WebSocketCompartible` remains for backward compatibility */
export type WebSocketCompatible = WebSocketCompartible;

/** options for the standard WebSocket connection-id handshake */
export interface WebSocketConnectionIdOptions {
    /** message sent after socket open, usually `device.save` */
    connectMessage?: string;
    /** timeout for open and connection-id response */
    timeoutMs?: number;
    /** custom extractor when a service returns a different connection-id shape */
    extract?: (message: unknown) => string | undefined;
}

/** options for receiving a single JSONTransport response */
export interface ProxyTransportReceiverOptions<T extends object = object> {
    timeoutMs?: number;
    jsonTransport?: JSONTransportOptions;
    validate?: (data: T) => boolean;
}

interface PendingWait<T extends object> {
    transportId: string;
    resolve: (data: T) => void;
    reject: (error: any) => void;
    timer?: ReturnType<typeof setTimeout>;
}

/** JSONTransport-backed receiver used by `HttpAbstractGenAI` transport mode */
export class JSONProxyTransportReceiver<T extends object = object> implements ProxyTransportReceiver<T> {
    private readonly transport;
    private pending?: PendingWait<T>;

    public constructor(
        private readonly network: NetworkSupportable,
        private readonly options: ProxyTransportReceiverOptions<T> = {},
    ) {
        this.transport = createJSONTransport<T>(new TransportPacketNetwork(network), options.jsonTransport);
        this.transport.onMessage(data => this.resolve(data));
        this.transport.onError(error => this.reject(error));
    }

    /**
     * Run an HTTP trigger task and resolve with the next complete JSONTransport payload.
     *
     * Only one pending wait is supported per receiver instance.
     */
    public async wait(transportId: string, task: () => Promise<unknown>): Promise<T> {
        if (this.pending) throw new Error(`@transport is already waiting - proxy.transport(${transportId})`);
        if (!transportId) throw new Error(`@transportId (string) is required - proxy.transport`);

        const promise = new Promise<T>((resolve, reject) => {
            const timeoutMs = this.options.timeoutMs ?? 30_000;
            const timer =
                timeoutMs > 0
                    ? setTimeout(() => {
                          this.reject(new Error(`@transport[${transportId}] timeout - proxy.transport`));
                      }, timeoutMs)
                    : undefined;
            this.pending = { transportId, resolve, reject, timer };
        });

        try {
            await task();
        } catch (e) {
            this.reject(e);
        }

        return promise;
    }

    /** detach listeners and reject an in-flight wait */
    public detach(): void {
        this.reject(new Error(`@transport detached - proxy.transport`));
        this.transport.detach();
    }

    private resolve(data: T): void {
        if (!this.pending) return;
        if (this.options.validate && !this.options.validate(data)) return;
        const pending = this.pending;
        this.pending = undefined;
        if (pending.timer) clearTimeout(pending.timer);
        pending.resolve(data);
    }

    private reject(error: any): void {
        if (!this.pending) return;
        const pending = this.pending;
        this.pending = undefined;
        if (pending.timer) clearTimeout(pending.timer);
        pending.reject(error);
    }
}

/** create a receiver that filters raw network packets down to JSONTransport frames */
export const createProxyTransportReceiver = <T extends object = object>(
    network: NetworkSupportable,
    options?: ProxyTransportReceiverOptions<T>,
): JSONProxyTransportReceiver<T> => new JSONProxyTransportReceiver<T>(network, options);

/** extract a connection id from known API Gateway/WebSocket handshake response shapes */
export const extractWebSocketConnectionId = (message: unknown): string | undefined => {
    if (!message || typeof message !== 'object') return undefined;
    const data = message as any;
    const candidates = [
        data.connectionId,
        data.connId,
        data.data?.connectionId,
        data.data?.connId,
        data.data?.connId?.id,
        data.data?.id,
        data.body?.connectionId,
        data.body?.connId,
        data.body?.id,
        data.id,
    ];
    return candidates.find(value => typeof value === 'string' && value.length > 0);
};

/**
 * Wait until a WebSocket is open, send the handshake message, and resolve the
 * first connection id found in inbound messages.
 */
export const waitWebSocketConnectionId = async (
    ws: WebSocketCompartible,
    options: WebSocketConnectionIdOptions = {},
): Promise<string> => {
    const timeoutMs = options.timeoutMs ?? 15_000;
    const extract = options.extract ?? extractWebSocketConnectionId;

    await waitWebSocketOpen(ws, timeoutMs);

    return new Promise((resolve, reject) => {
        let settled = false;
        const timer =
            timeoutMs > 0
                ? setTimeout(() => {
                      rejectOnce(new Error(`timeout waiting for connectionId from WebSocket: ${timeoutMs}ms`));
                  }, timeoutMs)
                : undefined;

        const cleanup = () => {
            if (timer) clearTimeout(timer);
            ws.removeEventListener('message', onMessage);
            ws.removeEventListener('error', onError);
            ws.removeEventListener('close', onClose);
        };
        const resolveOnce = (connectionId: string) => {
            if (settled) return;
            settled = true;
            cleanup();
            resolve(connectionId);
        };
        const rejectOnce = (error: any) => {
            if (settled) return;
            settled = true;
            cleanup();
            reject(error);
        };
        const onMessage = async (event: WebSocketCompartibleEventMap['message']) => {
            try {
                const raw = await asWebSocketText(event.data);
                const json = tryParseWebSocketJSON(raw);
                const connectionId = extract(json ?? raw);
                if (connectionId) resolveOnce(connectionId);
            } catch (e) {
                rejectOnce(e);
            }
        };
        const onError = (event: WebSocketCompartibleEventMap['error']) => rejectOnce(event);
        const onClose = () => rejectOnce(new Error(`WebSocket closed before connectionId was received`));

        ws.addEventListener('message', onMessage);
        ws.addEventListener('error', onError, { once: true });
        ws.addEventListener('close', onClose, { once: true });
        if (options.connectMessage) ws.send(options.connectMessage);
    });
};

/**
 * Adapter from browser-like WebSocket objects to `NetworkSupportable`.
 *
 * The adapter does not own externally supplied WebSocket instances. `close()` is
 * intentionally equivalent to `detach()`; callers that created the WebSocket should
 * close it themselves when they want the underlying connection closed.
 */
export class BrowserWebSocketNetwork implements NetworkSupportable {
    private readonly messageHandlers = new Set<NetworkMessageHandler>();
    private readonly errorHandlers = new Set<SocketErrorHandler>();
    private readonly opened: Promise<void>;
    private readyOpenHandler?: (event: WebSocketCompartibleEventMap['open']) => void;
    private readyErrorHandler?: (event: WebSocketCompartibleEventMap['error']) => void;
    private detached = false;

    private readonly handleOpen = () => undefined;
    private readonly handleMessage = (event: WebSocketCompartibleEventMap['message']) => {
        if (this.detached || typeof event.data !== 'string') return;
        for (const handler of [...this.messageHandlers]) handler(event.data);
    };
    private readonly handleError = (event: WebSocketCompartibleEventMap['error']) => {
        if (this.detached) return;
        for (const handler of [...this.errorHandlers]) handler(event, { scope: 'browserWebSocket', network: this });
    };
    private readonly handleClose = (event: WebSocketCompartibleEventMap['close']) => {
        if (this.detached) return;
        for (const handler of [...this.errorHandlers])
            handler(event, { scope: 'browserWebSocket.close', network: this });
    };

    public constructor(private readonly ws: WebSocketCompartible) {
        this.opened = this.isOpen()
            ? Promise.resolve()
            : new Promise((resolve, reject) => {
                  const onOpen = () => {
                      this.detachReadyListeners();
                      resolve();
                  };
                  const onError = (event: WebSocketCompartibleEventMap['error']) => {
                      this.detachReadyListeners();
                      reject(event);
                  };
                  this.readyOpenHandler = onOpen;
                  this.readyErrorHandler = onError;
                  ws.addEventListener('open', onOpen, { once: true });
                  ws.addEventListener('error', onError, { once: true });
              });

        ws.addEventListener('open', this.handleOpen);
        ws.addEventListener('message', this.handleMessage);
        ws.addEventListener('error', this.handleError);
        ws.addEventListener('close', this.handleClose);
    }

    /**
     * End-to-end browser diagnostic for generate transport.
     *
     * It discovers the WebSocket connection id, sends an inline-image `/dump`
     * request, waits for the JSONTransport response, and returns checks that a UI
     * can display directly.
     */
    public static async dumpTest(
        options: BrowserWebSocketDumpTestOptions = {},
    ): Promise<BrowserWebSocketDumpTestResult> {
        return browserWebSocketDumpTest(options);
    }

    public get readyState(): SocketReadyState {
        if (this.detached) return 'closed';
        if (this.isOpen()) return 'open';
        if (this.ws.readyState === this.stateValue('CLOSING', 2)) return 'closing';
        if (this.ws.readyState === this.stateValue('CLOSED', 3)) return 'closed';
        return 'connecting';
    }

    public ready(): Promise<void> {
        if (this.detached)
            return Promise.reject(new Error(`@network connection error: closed - browserWebSocket.ready`));
        return this.opened;
    }

    public send(data: string): void {
        if (this.detached || !this.isOpen()) {
            throw new Error(`@network connection error: ${this.readyState} - browserWebSocket.send`);
        }
        this.ws.send(data);
    }

    public onMessage(handler: NetworkMessageHandler): SocketUnsubscribe {
        if (this.detached) throw new Error(`@network connection error: closed - browserWebSocket.onMessage`);
        this.messageHandlers.add(handler);
        return () => this.messageHandlers.delete(handler);
    }

    public configure(_options: SocketNetworkOptions): void {
        // Browser WebSocket transport options are controlled by the browser/runtime.
    }

    public onError(handler: SocketErrorHandler): SocketUnsubscribe {
        this.errorHandlers.add(handler);
        return () => this.errorHandlers.delete(handler);
    }

    public close(): void {
        this.detach();
    }

    /** remove all listeners without closing the externally owned WebSocket */
    public detach(): void {
        if (this.detached) return;
        this.detached = true;
        this.messageHandlers.clear();
        this.errorHandlers.clear();
        this.ws.removeEventListener('open', this.handleOpen);
        this.ws.removeEventListener('message', this.handleMessage);
        this.ws.removeEventListener('error', this.handleError);
        this.ws.removeEventListener('close', this.handleClose);
        this.detachReadyListeners();
    }

    private isOpen(): boolean {
        return this.ws.readyState === this.stateValue('OPEN', 1);
    }

    private stateValue(key: 'OPEN' | 'CLOSING' | 'CLOSED', fallback: number): number {
        return typeof this.ws[key] === 'number' ? this.ws[key] : fallback;
    }

    private detachReadyListeners(): void {
        if (this.readyOpenHandler) this.ws.removeEventListener('open', this.readyOpenHandler);
        if (this.readyErrorHandler) this.ws.removeEventListener('error', this.readyErrorHandler);
        this.readyOpenHandler = undefined;
        this.readyErrorHandler = undefined;
    }
}

const waitWebSocketOpen = (ws: WebSocketCompartible, timeoutMs: number): Promise<void> => {
    if (ws.readyState === stateValue(ws, 'OPEN', 1)) return Promise.resolve();
    return new Promise((resolve, reject) => {
        let settled = false;
        const timer =
            timeoutMs > 0
                ? setTimeout(
                      () => rejectOnce(new Error(`timeout waiting for WebSocket open: ${timeoutMs}ms`)),
                      timeoutMs,
                  )
                : undefined;
        const cleanup = () => {
            if (timer) clearTimeout(timer);
            ws.removeEventListener('open', onOpen);
            ws.removeEventListener('error', onError);
            ws.removeEventListener('close', onClose);
        };
        const resolveOnce = () => {
            if (settled) return;
            settled = true;
            cleanup();
            resolve();
        };
        const rejectOnce = (error: any) => {
            if (settled) return;
            settled = true;
            cleanup();
            reject(error);
        };
        const onOpen = () => resolveOnce();
        const onError = (event: WebSocketCompartibleEventMap['error']) => rejectOnce(event);
        const onClose = () => rejectOnce(new Error(`WebSocket closed before open`));
        ws.addEventListener('open', onOpen, { once: true });
        ws.addEventListener('error', onError, { once: true });
        ws.addEventListener('close', onClose, { once: true });
    });
};

const stateValue = (
    ws: WebSocketCompartible,
    key: 'OPEN' | 'CLOSING' | 'CLOSED' | 'CONNECTING',
    fallback: number,
): number => (typeof ws[key] === 'number' ? ws[key] : fallback);

const asWebSocketText = async (data: unknown): Promise<string> => {
    if (typeof data === 'string') return data;
    if (data instanceof ArrayBuffer) return new TextDecoder().decode(data);
    if (ArrayBuffer.isView(data)) return new TextDecoder().decode(data);
    const readable = data as { text?: () => Promise<string>; arrayBuffer?: () => Promise<ArrayBuffer> };
    if (typeof readable?.text === 'function') return readable.text();
    if (typeof readable?.arrayBuffer === 'function') return new TextDecoder().decode(await readable.arrayBuffer());
    return String(data);
};

const tryParseWebSocketJSON = (text: string) => {
    try {
        return JSON.parse(text);
    } catch {
        return undefined;
    }
};

/** network wrapper that lets JSONTransport see only transport packet strings */
class TransportPacketNetwork implements NetworkSupportable {
    public constructor(private readonly source: NetworkSupportable) {}

    public get readyState(): SocketReadyState {
        return this.source.readyState;
    }

    public ready(): Promise<void> {
        return this.source.ready?.() ?? Promise.resolve();
    }

    public send(data: string): void {
        this.source.send(data);
    }

    public onMessage(handler: NetworkMessageHandler): SocketUnsubscribe {
        return this.source.onMessage(data => {
            if (!isTransportPacketString(data)) return;
            handler(data);
        });
    }

    public configure(options: SocketNetworkOptions): void {
        this.source.configure?.(options);
    }

    public onError(handler: SocketErrorHandler): SocketUnsubscribe {
        return this.source.onError(handler);
    }

    public close(): void {
        this.source.close();
    }
}

const isTransportPacketString = (data: string): boolean => {
    try {
        const packet = JSON.parse(data) as Partial<JSONTransportPacket>;
        return (
            packet?.type === 'json:manifest' ||
            packet?.type === 'json:chunk' ||
            packet?.type === 'json:complete' ||
            packet?.type === 'json:error'
        );
    } catch {
        return false;
    }
};
