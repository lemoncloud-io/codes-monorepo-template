/**
 * `proxy/mocks.ts`
 * - Test helpers for invoking AgentAPIController through a fetch-compatible API.
 *
 * @origin eureka-agents-api / src/lib/proxy/mocks.ts
 */

/** minimal controller shape required by `createAgentGenerateFetcher()` */
export interface AgentGenerateControllerLike {
    doPostGenerate(id: string, param: unknown, body: unknown, ctx: unknown): Promise<unknown>;
}

/**
 * Create a `fetch` implementation that routes `/agents/:id/generate` calls
 * directly into a controller instance.
 */
export const createAgentGenerateFetcher = (api: AgentGenerateControllerLike, ctx: unknown): typeof fetch =>
    (async (url: string | URL | Request, init?: RequestInit) => {
        const href = typeof url === 'string' || url instanceof URL ? `${url}` : url.url;
        const parsed = new URL(href, 'http://localhost');
        const matched = parsed.pathname.match(/^\/agents\/(.+)\/generate$/);
        if (!matched) {
            return {
                ok: false,
                status: 404,
                statusText: 'Not Found',
                text: async () => `unsupported endpoint: ${parsed.pathname}`,
            } as Response;
        }

        const body = init?.body ? JSON.parse(`${init.body}`) : {};
        try {
            const data = await api.doPostGenerate(
                decodeURIComponent(matched[1]),
                Object.fromEntries(parsed.searchParams.entries()),
                body,
                ctx,
            );
            return {
                ok: true,
                status: 200,
                statusText: 'OK',
                json: async () => data,
                text: async () => JSON.stringify(data),
            } as Response;
        } catch (e) {
            const text = e instanceof Error ? e.message : `${e}`;
            return {
                ok: false,
                status: 500,
                statusText: 'Internal Server Error',
                text: async () => text,
            } as Response;
        }
    }) as typeof fetch;
