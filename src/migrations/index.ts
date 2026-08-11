import * as migration_20260811_181154_initial from './20260811_181154_initial';

export const migrations = [
  {
    up: migration_20260811_181154_initial.up,
    down: migration_20260811_181154_initial.down,
    name: '20260811_181154_initial'
  },
];
