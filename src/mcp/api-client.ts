// The MCP server's only way to the data: HTTP calls to the party API.

/** Something the API refused, or couldn't be reached. The message is meant for the agent to read. */
export class ApiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

export type ApiRequest = (method: string, path: string, body?: unknown) => Promise<unknown>;

/** Where the MCP server finds the API: PARTY_API_URL, or the local dev API. */
export function apiUrl(): string {
  return process.env.PARTY_API_URL ?? `http://localhost:${process.env.PORT ?? 3001}`;
}

export function createApiClient(baseUrl = apiUrl()): ApiRequest {
  return async (method, path, body) => {
    let res: Response;
    try {
      res = await fetch(`${baseUrl}/api${path}`, {
        method,
        headers: body === undefined ? undefined : { 'content-type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch {
      throw new ApiError(`Can't reach the party API at ${baseUrl}. Is "npm run dev" running?`);
    }
    if (res.status === 204) return undefined;
    const data = (await res.json().catch(() => undefined)) as { error?: string } | undefined;
    if (!res.ok) throw new ApiError(data?.error ?? `The party API answered ${res.status}`);
    return data;
  };
}
