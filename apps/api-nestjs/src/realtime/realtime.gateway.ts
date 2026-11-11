import { OnGatewayConnection, OnGatewayDisconnect, WebSocketGateway } from '@nestjs/websockets';
import { IncomingMessage } from 'node:http';
import { WebSocket } from 'ws';
import { RealtimeRelayService } from './realtime.relay.js';

@WebSocketGateway({ path: '/ws/device' })
export class DeviceGateway implements OnGatewayConnection, OnGatewayDisconnect {
  constructor(private readonly relay: RealtimeRelayService) {}

  handleConnection(client: WebSocket, request?: IncomingMessage): void {
    this.relay.attachDeviceSocket(client, request?.url);
  }

  handleDisconnect(client: WebSocket): void {
    client.close();
  }
}

@WebSocketGateway({ path: '/ws/capture' })
export class CaptureGateway implements OnGatewayConnection, OnGatewayDisconnect {
  constructor(private readonly relay: RealtimeRelayService) {}

  handleConnection(client: WebSocket, request?: IncomingMessage): void {
    this.relay.attachCaptureSocket(client, request?.url);
  }

  handleDisconnect(client: WebSocket): void {
    client.close();
  }
}
