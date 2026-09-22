/**
 * The browser entry point.
 *
 * Loads the stylesheet, starts the app on the `#game` canvas, and leaves the
 * app on `globalThis` for poking at from the console. It also imports the
 * projectile module purely so that its factory is registered. Everything else
 * belongs in the app and below it; this file only puts the pieces in place.
 */

import './style.css';
import { App } from './app.ts';
// Registers the projectile factory the weapon system fires through.
import './sim/projectiles.ts';

const canvas = document.querySelector<HTMLCanvasElement>('#game');
if (!canvas) throw new Error('missing #game canvas');

const app = new App(canvas);
app.start();

// Exposed for poking at the simulation from the console while developing.
(globalThis as unknown as { app: App }).app = app;
