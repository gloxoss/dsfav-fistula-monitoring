import { HealthController } from './health.controller.js';

describe('HealthController', () => {
  it('[HEALTH] api health returns ok', () => {
    const controller = new HealthController();
    expect(controller.check()).toEqual({ status: 'ok', service: 'api' });
  });
});
