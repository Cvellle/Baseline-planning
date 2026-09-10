export interface BaselineRuntimeConfig {
  peopleRemoteEntry: string;
  deliveryRemoteEntry: string;
}

declare global {
  interface Window {
    __BASELINE_CONFIG__: BaselineRuntimeConfig;
  }
}

export {};
