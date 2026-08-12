import { AppController } from './app.controller';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(() => {
    appController = new AppController();
  });

  describe('health', () => {
    it('should return backend health information', () => {
      expect(appController.getHealth()).toEqual({
        status: 'ok',
        service: 'PWFB Backend',
        message: 'Backend is running',
      });
    });
  });
});
