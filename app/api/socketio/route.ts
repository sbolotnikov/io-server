import { NextApiRequest, NextApiResponse } from 'next';
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

const cors = Cors({
  methods: ['GET', 'HEAD'],
});

function runMiddleware(req: NextApiRequest, res: NextApiResponse, fn: Function) {
  return new Promise((resolve, reject) => {
    fn(req, res, (result: any) => {
      if (result instanceof Error) {
        return reject(result);
      }
      return resolve(result);
    });
  });
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  await runMiddleware(req, res, cors);

  if (req.method === 'GET') {
    try {
      const socketRes = await initSocketIO(res);
      if (socketRes instanceof Error) {
        return res.status(500).json({ error: socketRes.message });
      }
      return res.status(200).json({ success: true });
    } catch (error) {
      console.error('Error initializing Socket.IO:', error);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  } else {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }
}

async function initSocketIO(res: NextApiResponse) {
  if (!(res.socket as any).server.io) {
    console.log('Initializing Socket.IO server...');

    const httpServer: NetServer = (res.socket as any).server as any;
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
      // ... (rest of your socket.io event handlers)
    });

    (res.socket as any).server.io = io;
  }
  return (res.socket as any).server.io;
}

export const config = {
  api: {
    bodyParser: false,
  },
};