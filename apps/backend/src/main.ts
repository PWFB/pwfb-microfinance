import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

function getCorsOrigins() {
  const configured = (process.env.CORS_ORIGINS || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  const defaults = process.env.NODE_ENV !== 'production'
    ? ['http://localhost:3000', 'http://localhost:3001']
    : [
        process.env.FRONTEND_URL || 'https://pwfb-microfinance-965u.onrender.com',
        'https://pwfb-microfinance-1.onrender.com',
        'https://pwfb-frontend.onrender.com',
      ];

  // The staging web client is hosted on Vercel and must be allowed even when
  // CORS_ORIGINS is explicitly configured. Keep every existing configured
  // origin and add the stable staging-branch alias.
  const stagingFrontendOrigin = process.env.STAGING_FRONTEND_URL?.trim();

  return [
    ...new Set([
      ...defaults,
      ...configured,
      ...(stagingFrontendOrigin ? [stagingFrontendOrigin] : []),
    ]),
  ];
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
