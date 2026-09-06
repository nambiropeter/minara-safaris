import * as migration_20260811_181154_initial from './20260811_181154_initial';
import * as migration_20260906_101839_orders_and_processed_events from './20260906_101839_orders_and_processed_events';
import * as migration_20260906_190200_query_presets from './20260906_190200_query_presets';

export const migrations = [
  {
    up: migration_20260811_181154_initial.up,
    down: migration_20260811_181154_initial.down,
    name: '20260811_181154_initial',
  },
  {
    up: migration_20260906_101839_orders_and_processed_events.up,
    down: migration_20260906_101839_orders_and_processed_events.down,
    name: '20260906_101839_orders_and_processed_events',
  },
  {
    up: migration_20260906_190200_query_presets.up,
    down: migration_20260906_190200_query_presets.down,
    name: '20260906_190200_query_presets'
  },
];
