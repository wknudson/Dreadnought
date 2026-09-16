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
