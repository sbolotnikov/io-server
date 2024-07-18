"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';

interface Message {
  id: string;
  userId: string;
  text: string;
  timestamp: number;
}

export default function Home() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [roomId, setRoomId] = useState('');
  const [codeword, setCodeword] = useState('');
  const [userId, setUserId] = useState('');
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const newSocket = io(process.env.NEXT_PUBLIC_SOCKET_URL || 'https://io-server-omega.vercel.app', {
      path: '/api/socketio',
      transports: ['websocket'],
      withCredentials: true,
    });

    newSocket.on('connect', () => {
      console.log('Connected to server');
      setIsConnected(true);
      setUserId("id_" + Math.random().toString(36).substr(2, 9));
    });

    newSocket.on('connect_error', (error) => {
      console.error('Connection error:', error);
      setIsConnected(false);
    });

    newSocket.on('disconnect', () => {
      console.log('Disconnected from server');
      setIsConnected(false);
    });

    newSocket.on('previous messages', (prevMessages: Message[]) => {
      setMessages(prevMessages);
    });

    newSocket.on('new message', (message: Message) => {
      setMessages((prevMessages) => [...prevMessages, message]);
    });

    newSocket.on('error', (error: string) => {
      console.error('Server error:', error);
      alert(error);
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, []);

  const joinRoom = useCallback(() => {
    if (socket && roomId && codeword) {
      socket.emit('join room', { roomId, codeword });
    }
  }, [socket, roomId, codeword]);

  const sendMessage = useCallback(() => {
    if (socket && inputMessage && userId) {
      const message: Message = {
        id: Date.now().toString(),
        userId,
        text: inputMessage,
        timestamp: Date.now(),
      };
      socket.emit('send message', message);
      setInputMessage('');
    }
  }, [socket, inputMessage, userId]);

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Next.js 14 Chat App</h1>
      <div className="mb-4">
        <input
          type="text"
          value={roomId}
          onChange={(e) => setRoomId(e.target.value)}
          placeholder="Room ID"
          className="border p-2 mr-2"
        />
        <input
          type="password"
          value={codeword}
          onChange={(e) => setCodeword(e.target.value)}
          placeholder="Codeword"
          className="border p-2 mr-2"
        />
        <button onClick={joinRoom} className="bg-blue-500 text-white p-2 rounded">
          Join Room
        </button>
      </div>
      <div className="border h-64 overflow-y-auto mb-4 p-2">
        {messages.map((msg) => (
          <div key={msg.id} className={`mb-2 ${msg.userId === userId ? 'text-right' : ''}`}>
            <span className="font-bold">{msg.userId === userId ? 'You' : msg.userId}: </span>
            {msg.text}
          </div>
        ))}
      </div>
      <div className="flex">
        <input
          type="text"
          value={inputMessage}
          onChange={(e) => setInputMessage(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
          placeholder="Type a message..."
          className="border p-2 flex-grow mr-2"
        />
        <button onClick={sendMessage} className="bg-green-500 text-white p-2 rounded">
          Send
        </button>
      </div>
      <div className="mt-4">
        Connection status: {isConnected ? 'Connected' : 'Disconnected'}
      </div>
    </div>
  );
}
