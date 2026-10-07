import { execFileSync } from 'node:child_process';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  if (process.env.PWFB_STAGING_SEED_ON_START === 'true') {
    console.log('PWFB staging seed requested; synchronizing staging database...');
    execFileSync('npm', ['run', 'prisma:seed', '--workspace=backend'], {
      stdio: 'inherit',
      env: process.env,
    });
    console.log('PWFB staging seed completed.');
  }

  const app = await NestFactory.create(AppModule, { rawBody: true });

  app.enableCors({
    origin: true,
    credentials: true,
  });

  await app.listen(process.env.PORT ?? 3000);

  console.log(
    `PWFB Backend running on http://localhost:${process.env.PORT ?? 3000}`,
  );
}

bootstrap();
