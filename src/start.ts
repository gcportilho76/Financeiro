import { createStartHandler } from '@tanstack/react-start/client';
import { createRouter } from './router';

export const start = createStartHandler({
  createRouter,
});

start();