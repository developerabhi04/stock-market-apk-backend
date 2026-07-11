import express from 'express';
import {
    registerMiddlewares,
    registerErrorMiddleware
} from './bootstrap/registerMiddlewares.js';
import { registerRoutes } from './bootstrap/registerRoutes.js';

const app = express();

app.set('trust proxy', 1);

registerMiddlewares(app);
registerRoutes(app);
registerErrorMiddleware(app);

export default app;