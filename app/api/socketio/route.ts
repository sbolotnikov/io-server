// app/api/socketio/route.ts
import { NextResponse } from 'next/server';
import { Server as NetServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import Cors from 'cors';

interface Message {
  id: string;
  userId: string;
  text: string;
  timestamp: number;
}

const rooms: { [key: string]: { users: Set<string>; messages: Message[] } } = {};

// Helper method to wait for a middleware to execute before continuing
// And to throw an error when an error happens in a middleware
function runMiddleware(req: Request, res: NextResponse, fn: Function) {
  return new Promise((resolve, reject) => {
    fn(req, res, (result: any) => {
      if (result instanceof Error) {
        return reject(result);
      }
      return resolve(result);
    });
  });
}

// Initialize the cors middleware
const cors = Cors({
  methods: ['GET', 'HEAD'],
});

export async function GET(request: Request) {
  const res = NextResponse.next();
  
  // Run the cors middleware
  await runMiddleware(request, res, cors);

  const socketRes = await initSocketIO(request);
  if (socketRes instanceof Error) {
    return NextResponse.json({ error: socketRes.message }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}

async function initSocketIO(request: Request) {
  const res = NextResponse.next();
  // @ts-ignore
  if (!res.socket.server.io) {
    console.log('Initializing Socket.IO server...');

    // @ts-ignore
    const httpServer: NetServer = res.socket.server as any;
    const io = new SocketIOServer(httpServer, {
      path: '/api/socketio',
      addTrailingSlash: false,
      cors: {
        origin: process.env.SITE_URL || "http://localhost:3000" || "https://io-server-omega.vercel.app/",
        methods: ["GET", "POST"],
        credentials: true
      }
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

    // @ts-ignore
    res.socket.server.io = io;
  }
  // @ts-ignore
  return res.socket.server.io;
}

export const dynamic = 'force-dynamic';