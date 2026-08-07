import 'dotenv/config';
import { createServer } from 'http';
import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';

import app from './src/app.js';
import { getConnectionStats } from './src/shared/database/db.js';
import { connectDatabase } from './src/bootstrap/connectDatabase.js';
import { registerEvents, registerGracefulShutdown } from './src/bootstrap/registerEvents.js';
import { registerJobs } from './src/jobs/index.js';
import { setSocketInstance } from './src/modules/notification/socket.js';

registerEvents();
await connectDatabase();

app.get('/health/db-stats', (_req, res) => {
  const stats = getConnectionStats();
  res.status(200).json(stats);
});

const PORT = process.env.PORT || 5000;
const PUBLIC_BASE_URL = (process.env.PUBLIC_BASE_URL || '').replace(/\/$/, '');

// ✅ NEW: Create raw HTTP server so Socket.IO can attach to it
const httpServer = createServer(app);

// ✅ NEW: Socket.IO instance
const io = new Server(httpServer, {
  cors: {
    origin: '*', // tighten this to your app's domain/scheme in production
    methods: ['GET', 'POST'],
  },
});

// ✅ NEW: Authenticate socket connections using the same JWT the app already uses
io.use((socket, next) => {
  try {
    const token = socket.handshake.auth?.token || socket.handshake.query?.token;
    if (!token) return next(new Error('Authentication token missing'));

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    socket.userId = decoded.userId || decoded.id;
    socket.role = decoded.role;
    socket.isAdmin = decoded.role === 'admin' || decoded.role === 'super_admin';


    next();
  } catch (err) {
    next(new Error('Invalid or expired token'));
  }
});

// ✅ NEW: Join each connected user to a private room named after their userId
// io.on('connection', (socket) => {
//   socket.join(socket.userId);
//   console.log(`🔌 User connected & joined room: ${socket.userId}`);

//   socket.on('disconnect', () => {
//     console.log(`❌ User disconnected: ${socket.userId}`);
//   });
// });

io.on('connection', (socket) => {
  if (socket.isAdmin) {
    socket.join('admins');
    console.log(`🔌 Admin connected & joined room: ${socket.userId}`);
  } else {
    socket.join(socket.userId);
    console.log(`🔌 User connected & joined room: ${socket.userId}`);
  }
});

// ✅ NEW: Make `io` accessible anywhere in the app (services/controllers)
setSocketInstance(io);

const server = httpServer.listen(PORT, () => {
  console.log('\n🚀 TradeHub Backend Started Successfully!');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`📡 Server running on port: ${PORT}`);
  console.log(`🔌 Socket.IO ready for real-time notifications`);
  console.log(`📍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🌐 Base URL: ${PUBLIC_BASE_URL || `http://localhost:${PORT}`}`);
  console.log(`❤️ Health Check: ${PUBLIC_BASE_URL ? `${PUBLIC_BASE_URL}/health` : `http://localhost:${PORT}/health`}`);
  console.log(`🔐 Auth API: ${PUBLIC_BASE_URL ? `${PUBLIC_BASE_URL}/api/v1/auth` : `http://localhost:${PORT}/api/v1/auth`}`);
  console.log(`👤 User API: ${PUBLIC_BASE_URL ? `${PUBLIC_BASE_URL}/api/v1/user` : `http://localhost:${PORT}/api/v1/user`}`);
  console.log(`🖼️ Uploads: ${PUBLIC_BASE_URL ? `${PUBLIC_BASE_URL}/uploads` : `http://localhost:${PORT}/uploads`}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  registerJobs();
});


server.on('error', (error) => {
  console.error('🔴 Server Error:', error);
  process.exit(1);
});

registerGracefulShutdown(server);

export default server;