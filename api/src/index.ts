import express from 'express';
import cors from 'cors';
import { booksRouter } from './routes/books.js';
import {
  bookCharactersRouter,
  charactersRouter,
  relationshipsRouter,
} from './routes/characters.js';
import { errorHandler } from './lib/http.js';
import { uploadsRoot } from './lib/upload.js';

const app = express();
const port = Number(process.env.API_PORT ?? 3000);

// Abierto a propósito: la app corre en red local sin auth y hay que poder
// abrirla desde el móvil, cuyo origen no conocemos de antemano.
app.use(cors());
app.use(express.json({ limit: '1mb' }));

app.get('/api/health', (_req, res) => res.json({ ok: true }));

app.use('/api/books', booksRouter);
app.use('/api/books/:bookId/characters', bookCharactersRouter);
app.use('/api/characters', charactersRouter);
app.use('/api/relationships', relationshipsRouter);

app.use('/uploads', express.static(uploadsRoot, { maxAge: '1h' }));

app.use((_req, res) => res.status(404).json({ error: 'Ruta no encontrada' }));
app.use(errorHandler);

// 0.0.0.0 y no localhost: si no, el móvil no puede alcanzar la API.
app.listen(port, '0.0.0.0', () => {
  console.log(`API escuchando en http://0.0.0.0:${port}`);
  console.log(`Ficheros servidos desde ${uploadsRoot}`);
});
