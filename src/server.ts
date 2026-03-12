import http from 'http';
import path from 'path';
import express from 'express';
import cors from 'cors';
import generationRoutes from './routes/generation.routes';
import { initSocket } from './lib/socket';

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 4000;

initSocket(server);

app.use(cors());
app.use(express.json());
app.use('/images', express.static(path.join(__dirname, '../public/images')));

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/generations', generationRoutes);

server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

export default app;
