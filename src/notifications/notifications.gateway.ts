import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from 'src/prisma/prisma.service';

@WebSocketGateway({
  cors: {
    origin: '*',
    credentials: true,
  },
  namespace: '/notifications',
})
export class NotificationsGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(NotificationsGateway.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async handleConnection(client: Socket) {
    try {
      const token =
        client.handshake.auth?.token ||
        (client.handshake.query?.token as string) ||
        this.extractTokenFromCookie(client.handshake.headers?.cookie);

      if (!token) {
        this.logger.debug(`Client ${client.id} disconnected: No auth token`);
        client.disconnect();
        return;
      }

      const jwtSecret = this.configService.get<string>('JWT_SECRET');
      const payload = await this.jwtService.verifyAsync(token, {
        secret: jwtSecret,
      });

      if (!payload?.userId) {
        client.disconnect();
        return;
      }

      // Verify active user in DB
      const user = await this.prisma.user.findUnique({
        where: { id: payload.userId },
        select: { id: true, role: true, isBanned: true },
      });

      if (!user) {
        client.disconnect();
        return;
      }

      // Store user identity on socket
      client.data.userId = user.id;
      client.data.role = user.role;

      // Join individual user room
      client.join(`user:${user.id}`);

      // Join role room (e.g. role:ADMIN, role:SUPERADMIN, role:USER)
      client.join(`role:${user.role}`);

      this.logger.log(
        `Socket connected: ${user.id} (${user.role}) on room user:${user.id}`,
      );

      client.emit('connected', {
        userId: user.id,
        role: user.role,
        timestamp: new Date().toISOString(),
      });
    } catch (err: any) {
      this.logger.debug(`Socket auth failed for ${client.id}: ${err.message}`);
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.debug(`Socket disconnected: ${client.id}`);
  }

  private extractTokenFromCookie(cookieHeader?: string): string | undefined {
    if (!cookieHeader) return undefined;
    const cookies = cookieHeader.split(';').map((c) => c.trim());
    const tokenCookie = cookies.find(
      (c) => c.startsWith('token=') || c.startsWith('access_token='),
    );
    if (!tokenCookie) return undefined;
    return decodeURIComponent(tokenCookie.split('=')[1]);
  }

  /**
   * Emit notification to a specific user by ID
   */
  emitToUser(userId: string, event: string, payload: any) {
    this.server.to(`user:${userId}`).emit(event, payload);
  }

  /**
   * Emit notification to all users matching a role (e.g. ADMIN, SUPERADMIN)
   */
  emitToRole(role: string, event: string, payload: any) {
    this.server.to(`role:${role}`).emit(event, payload);
  }

  /**
   * Broadcast to all connected clients
   */
  broadcast(event: string, payload: any) {
    this.server.emit(event, payload);
  }
}
