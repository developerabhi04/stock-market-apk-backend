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

const server = app.listen(PORT, () => {
  console.log('\n🚀 TradeHub Backend Started Successfully!');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`📡 Server running on port: ${PORT}`);
  console.log(`📍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🌐 Health Check: http://localhost:${PORT}/health`);
  console.log(`📊 Auth API: http://localhost:${PORT}/api/v1/auth`);
  console.log(`📊 User API: http://localhost:${PORT}/api/v1/user`);
  console.log(`📁 Uploads: http://localhost:${PORT}/uploads`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  registerJobs();
});

server.on('error', (error) => {
  console.error('🔴 Server Error:', error);
  process.exit(1);
});

registerGracefulShutdown(server);

export default server;