// app/api/socketio/route.ts
import { NextResponse } from 'next/server';
import { Server as NetServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import type { NextApiRequest } from 'next';
import type { Socket as NetSocket } from 'net';

interface Message {
  id: string;
  userId: string;
  text: string;
  timestamp: number;
}

const rooms: { [key: string]: { users: Set<string>; messages: Message[] } } = {};

export async function GET(req: NextApiRequest) {
  if ((await initSocketIO(req)) instanceof Error) {
    return NextResponse.error();
  }
  return NextResponse.json({ success: true });
}

async function initSocketIO(req: NextApiRequest) {
  if (!((req.socket as any).server as any).io) {
    const httpServer: NetServer = (req.socket as any).server as any;
    const io = new SocketIOServer(httpServer, {
      path: '/api/socketio',
      addTrailingSlash: false,
    });

    io.on('connection', (socket) => {
      console.log('A user connected');

      socket.on('join room', ({ roomId, codeword }) => {
        if (codeword !== process.env.CODEWORD) {
          socket.emit('error', 'Invalid codeword');
          return;
        }

        socket.join(roomId);
        console.log(`User joined room: ${roomId}`);

        if (!rooms[roomId]) {
          rooms[roomId] = { users: new Set(), messages: [] };
        }
        rooms[roomId].users.add(socket.id);

        // Send existing messages to the newly joined user
        socket.emit('previous messages', rooms[roomId].messages);
      });

      socket.on('send message', (message: Message) => {
        const roomId = Array.from(socket.rooms)[1]; // The second room is the chat room (first is socket's own room)
        if (roomId && rooms[roomId]) {
          rooms[roomId].messages.push(message);
          io.to(roomId).emit('new message', message);
        }
      });

      socket.on('disconnecting', () => {
        const roomsToLeave = Array.from(socket.rooms);
        roomsToLeave.forEach((room) => {
          if (rooms[room]) {
            rooms[room].users.delete(socket.id);
            if (rooms[room].users.size === 0) {
              delete rooms[room];
            }
          }
        });
      });

      socket.on('disconnect', () => {
        console.log('A user disconnected');
      });
    });

    ((req.socket as any).server as any).io = io;
  }
  return ((req.socket as any).server as any).io;
}

export const dynamic = 'force-dynamic';