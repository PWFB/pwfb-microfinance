import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

function getCorsOrigins() {
  const configured = (process.env.CORS_ORIGINS || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  if (configured.length) return configured;
  if (process.env.NODE_ENV !== 'production') {
    return ['http://localhost:3000', 'http://localhost:3001'];
  }
  return [
    process.env.FRONTEND_URL || 'https://pwfb-microfinance-1.onrender.com',
    'https://pwfb-frontend.onrender.com',
  ].filter(Boolean);
}

async function bootstrap() {
  if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET?.trim()) {
    throw new Error('JWT_SECRET must be configured before starting PWFB in production.');
  }

  const app = await NestFactory.create(AppModule, { rawBody: true });

  app.enableCors({
    origin: getCorsOrigins(),
    credentials: true,
  });

  await app.listen(process.env.PORT ?? 3000);

  console.log(
    `PWFB Backend running on http://localhost:${process.env.PORT ?? 3000}`,
  );
}

bootstrap();
