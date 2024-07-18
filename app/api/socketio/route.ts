// app/api/socketio/route.ts
import { NextApiResponseServerIO } from '@/types/next';
import { Server as NetServer } from 'http';
import { NextApiRequest } from 'next';
import { Server as ServerIO } from 'socket.io';

export const config = {
  api: {
    bodyParser: false,
  },
};

interface Message {
  id: string;
  userId: string;
  text: string;
  timestamp: number;
}

const rooms: { [key: string]: { users: Set<string>; messages: Message[] } } = {};

const ioHandler = (req: NextApiRequest, res: NextApiResponseServerIO) => {
  if (!res.socket.server.io) {
    const httpServer: NetServer = res.socket.server as any;
    const io = new ServerIO(httpServer, {
      path: '/api/socketio',
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

    res.socket.server.io = io;
  }
  res.end();
};

export { ioHandler as GET, ioHandler as POST };
export const dynamic = 'force-dynamic';
// types/next.d.ts
