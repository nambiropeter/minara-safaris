import * as migration_20260811_181154_initial from './20260811_181154_initial';
import * as migration_20260906_101839_orders_and_processed_events from './20260906_101839_orders_and_processed_events';
import * as migration_20260906_190200_query_presets from './20260906_190200_query_presets';
import * as migration_20261016_093425_packages_accommodation from './20261016_093425_packages_accommodation';
import * as migration_20261016_095411_destinations_hotel_destination from './20261016_095411_destinations_hotel_destination';
import * as migration_20261016_161719_hotel_cache_calls_settings from './20261016_161719_hotel_cache_calls_settings';

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
    name: '20260906_190200_query_presets',
  },
  {
    up: migration_20261016_093425_packages_accommodation.up,
    down: migration_20261016_093425_packages_accommodation.down,
    name: '20261016_093425_packages_accommodation',
  },
  {
    up: migration_20261016_095411_destinations_hotel_destination.up,
    down: migration_20261016_095411_destinations_hotel_destination.down,
    name: '20261016_095411_destinations_hotel_destination',
  },
  {
    up: migration_20261016_161719_hotel_cache_calls_settings.up,
    down: migration_20261016_161719_hotel_cache_calls_settings.down,
    name: '20261016_161719_hotel_cache_calls_settings'
  },
];
