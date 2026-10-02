import { Controller, Get } from '@nestjs/common';

@Controller()
export class AppController {
  @Get()
  getRoot() {
    return {
      status: 'ok',
      service: 'PWFB Backend',
      message: 'Backend is running',
    };
  }

  @Get('health')
  getHealth() {
    return {
      status: 'ok',
      service: 'PWFB Backend',
    };
  }
}