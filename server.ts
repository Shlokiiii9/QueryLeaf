/**
 * QueryLeaf Gateway - Full Stack Express Server Entry Point
 * Hosts the REST API on /api/v1 and mounts Vite middleware in development.
 */

import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { apiRouter } from './src/server/api.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = parseInt(process.env.PORT || '3000', 10);
  const isProduction = process.env.NODE_ENV === 'production';

  app.use(express.json());
  app.use(express.static(path.resolve(__dirname, 'public')));

  // Mount Gateway REST API
  app.use('/api/v1', apiRouter);

  // Fallback for root /health
  app.get('/health', (_req, res) => {
    res.json({ status: 'healthy', service: 'QueryLeaf Gateway', time: new Date().toISOString() });
  });

  if (!isProduction) {
    // Development mode: dynamically import Vite and mount middleware
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Production mode: serve static assets from dist
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[QueryLeaf] Smart IoT Gateway running on http://0.0.0.0:${PORT}`);
    console.log(`[QueryLeaf] REST API ready at http://0.0.0.0:${PORT}/api/v1/health`);
  });
}

startServer().catch((err) => {
  console.error('[QueryLeaf] Failed to start server:', err);
  process.exit(1);
});
