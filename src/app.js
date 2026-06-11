import express from 'express';
import {
    registerMiddlewares,
    registerErrorMiddleware
} from './bootstrap/registerMiddlewares.js';
import { registerRoutes } from './bootstrap/registerRoutes.js';

const app = express();

registerMiddlewares(app);
registerRoutes(app);
registerErrorMiddleware(app);

export default app;