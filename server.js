import 'dotenv/config';

import app from './src/app.js';
import { getConnectionStats } from './src/shared/database/db.js';
import { connectDatabase } from './src/bootstrap/connectDatabase.js';
import { registerEvents, registerGracefulShutdown } from './src/bootstrap/registerEvents.js';
import { registerJobs } from './src/jobs/index.js';

registerEvents();
await connectDatabase();

app.get('/health/db-stats', (_req, res) => {
  const stats = getConnectionStats();
  res.status(200).json(stats);
});

const PORT = process.env.PORT || 5000;
const PUBLIC_BASE_URL = (process.env.PUBLIC_BASE_URL || '').replace(/\/$/, '');

const server = app.listen(PORT, () => {
  console.log('\n🚀 TradeHub Backend Started Successfully!');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`📡 Server running on port: ${PORT}`);
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