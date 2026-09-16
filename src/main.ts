import './style.css';
import { App } from './app.ts';
import './sim/projectiles.ts';

const canvas = document.querySelector<HTMLCanvasElement>('#game');
if (!canvas) throw new Error('missing #game canvas');

const app = new App(canvas);
app.start();

// Phase 1b: drop straight into a run until the title screen lands.
app.startRun();

// Exposed for poking at the simulation from the console while developing.
(globalThis as unknown as { app: App }).app = app;
