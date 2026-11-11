import { WsAdapter } from '@nestjs/platform-ws';
import { IncomingMessage, Server } from 'node:http';
import { Duplex } from 'node:stream';

// The frozen device protocol uses dynamic URLs (`/ws/device/{id}`,
// `/ws/capture/{measurementId}`) while the stock WsAdapter matches gateway
// paths by strict equality. This subclass keeps the ws adapter and adds a
// path-prefix match at the '/' boundary.
export class DsfavWsAdapter extends WsAdapter {
  private readonly prefixUpgradeListeners = new Map<number, (request: IncomingMessage, socket: Duplex, head: Buffer) => void>();

  protected override ensureHttpServerExists(port: number, httpServer?: Server): Server | undefined {
    if (this.httpServersRegistry.has(port)) return;
    const server = httpServer ?? this.createRejectingServer();
    this.httpServersRegistry.set(port, server);
    const listener = (request: IncomingMessage, socket: Duplex, head: Buffer) => {
      try {
        const baseUrl = `ws://${request.headers.host ?? 'localhost'}/`;
        const pathname = new URL(request.url ?? '/', baseUrl).pathname;
        const servers = this.wsServersRegistry.get(port) ?? [];
        const match = servers.find((entry: { path?: string }) => {
          const base = entry.path ?? '/';
          return pathname === base || pathname.startsWith(base.endsWith('/') ? base : `${base}/`);
        });
        if (!match) {
          socket.destroy();
          return;
        }
        match.handleUpgrade(request, socket, head, (ws: unknown) => match.emit('connection', ws, request));
      } catch (error) {
        socket.on('error', () => socket.destroy());
        socket.end(`HTTP/1.1 400 ${(error as Error).message}\r\n\r\n`);
      }
    };
    server.on('upgrade', listener);
    this.prefixUpgradeListeners.set(port, listener);
    return server;
  }

  override async dispose(): Promise<void> {
    for (const [port, listener] of this.prefixUpgradeListeners) {
      this.httpServersRegistry.get(port)?.off('upgrade', listener);
    }
    this.prefixUpgradeListeners.clear();
    await super.dispose();
  }

  private createRejectingServer(): Server {
    return new Server((_, response) => {
      const body = 'Upgrade Required';
      response.writeHead(426, { 'Content-Length': body.length, 'Content-Type': 'text/plain' });
      response.end(body);
    });
  }
}
