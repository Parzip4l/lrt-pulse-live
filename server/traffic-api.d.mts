import type { IncomingMessage, ServerResponse, Server } from 'node:http';

type Options = { env?: Record<string, string | undefined>; fetchImpl?: typeof fetch };
export function createTrafficHandler(options?: Options): (req: IncomingMessage, res: ServerResponse) => Promise<void>;
export function createTrafficServer(options?: Options): Server;
