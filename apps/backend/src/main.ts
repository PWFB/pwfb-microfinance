import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';

const KNOWN_FRONTEND_ORIGINS = [
  'https://pwfb-microfinance-965u.onrender.com',
  'https://pwfb-microfinance-1.onrender.com',
  'https://pwfb-microfinance-staging.onrender.com',
  'https://pwfb-frontend.onrender.com',
  'https://pwfb-financial-portal-web.onrender.com',
  'https://pwfb-financial-portal-web-live.onrender.com',
  'https://pwfb-financial-portal-frontend.onrender.com',
];

function getCorsOrigins() {
  const configured = (process.env.CORS_ORIGINS || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  const defaults = process.env.NODE_ENV !== 'production'
    ? ['http://localhost:3000', 'http://localhost:3001']
    : [
        process.env.FRONTEND_URL || 'https://pwfb-microfinance-965u.onrender.com',
        ...KNOWN_FRONTEND_ORIGINS,
      ];

  // Keep explicitly configured origins and the exact deployed portal hosts.
  // No wildcard origins: credentialed bearer/session flows remain origin-scoped.
  return Array.from(new Set([...configured, ...defaults]));
}

async function bootstrap() {
  if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET?.trim()) {
    throw new Error('JWT_SECRET must be configured before starting PWFB in production.');
  }

  const app = await NestFactory.create<NestExpressApplication>(AppModule, { rawBody: true });

  // Receipt attachments are base64-encoded inside the customer AI JSON body.
  // 12 MB accommodates the 8 MB decoded attachment cap plus JSON/base64 overhead.
  // useBodyParser preserves Nest's rawBody option for webhook signature checks.
  app.useBodyParser('json', { limit: '12mb' });

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
