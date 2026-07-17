export const LEVEL_LENGTH = -112;

export const platforms = [
  { id: 'start', x: 0, y: 0, z: 4, w: 14, d: 16, h: 2.8, type: 'grass' },
  { id: 'tutorial-1', x: 0, y: 0.6, z: -10, w: 8, d: 8, h: 3, type: 'grass' },
  { id: 'tutorial-2', x: 0, y: 1.4, z: -21, w: 7, d: 7, h: 3.4, type: 'grass', moving: { axis: 'y', amount: 1.2, speed: 0.7, phase: 0 } },
  { id: 'waterfall-a', x: -3.4, y: 2.4, z: -31, w: 6.2, d: 6.2, h: 4, type: 'stone', moving: { axis: 'y', amount: 2.1, speed: 0.9, phase: 0 } },
  { id: 'waterfall-b', x: 3.2, y: 4.2, z: -39, w: 6.2, d: 6.2, h: 4.2, type: 'stone', moving: { axis: 'y', amount: 2.5, speed: 0.82, phase: 1.8 } },
  { id: 'waterfall-top', x: 0, y: 6.4, z: -48, w: 11, d: 9, h: 5, type: 'grass' },
  { id: 'feather-detour', x: -10, y: 4.4, z: -39, w: 6, d: 6, h: 4, type: 'grass', moving: { axis: 'y', amount: 1.5, speed: 0.65, phase: 2.4 } },
  { id: 'enemy-detour', x: 10, y: 6.2, z: -55, w: 7, d: 7, h: 4, type: 'grass' },
  { id: 'wind-entry', x: 0, y: 7.4, z: -59, w: 9, d: 8, h: 4.6, type: 'stone' },
  { id: 'collapse-1', x: -2.8, y: 8.1, z: -69, w: 5.5, d: 6, h: 3.2, type: 'collapse' },
  { id: 'collapse-2', x: 2.8, y: 8.9, z: -77, w: 5.5, d: 6, h: 3.2, type: 'collapse' },
  { id: 'collapse-3', x: -2.2, y: 9.6, z: -85, w: 5.5, d: 6, h: 3.2, type: 'collapse' },
  { id: 'temple-yard', x: 0, y: 10.0, z: -95, w: 16, d: 13, h: 6, type: 'temple' },
  { id: 'secret-room', x: 11, y: 10.4, z: -98, w: 6, d: 7, h: 4, type: 'secret' },
  { id: 'sanctum', x: 0, y: 11.1, z: -108, w: 12, d: 12, h: 7, type: 'temple' },
];

export const coins = [
  [0, 2.4, -4], [0, 3.1, -10], [0, 4.1, -17], [0, 5.5, -23],
  [-3.4, 7.1, -31], [3.2, 8.6, -39], [0, 10.8, -47],
  [-4.5, 10.3, -49], [-7, 9.3, -45], [-10, 8.7, -40],
  [3.4, 11.2, -56], [0, 12.0, -61], [-2.8, 12.3, -69],
  [2.8, 13.1, -77], [-2.2, 13.8, -85], [0, 15.2, -92],
  [4, 15.1, -94], [7, 14.6, -96], [10, 14.5, -98], [0, 16.5, -104],
];

export const feathers = [
  { id: 'detour', x: -10, y: 9.3, z: -39 },
  { id: 'guarded', x: 10, y: 11.3, z: -55 },
  { id: 'secret', x: 11, y: 15.4, z: -99, hidden: true },
];
