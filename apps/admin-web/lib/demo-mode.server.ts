export class DemoModeDisabledError extends Error {
  constructor() {
    super("Synthetic demo routes are unavailable unless DEMO_MODE=true.");
  }
}

export function assertDemoMode(): void {
  if (process.env.DEMO_MODE !== "true") throw new DemoModeDisabledError();
}
