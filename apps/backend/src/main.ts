import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

function getCorsOrigins() {
  const configured = (process.env.CORS_ORIGINS || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  const deployedFrontends = [
    process.env.FRONTEND_URL,
    'https://pwfb-financial-portal-web.onrender.com',
    'https://pwfb-financial-portal-web-live.onrender.com',
    'https://pwfb-financial-portal-frontend.onrender.com',
    'https://pwfb-microfinance-staging.onrender.com',
    'https://pwfb-microfinance-965u.onrender.com',
    'https://pwfb-microfinance-1.onrender.com',
    'https://pwfb-frontend.onrender.com',
  ].filter(Boolean) as string[];

  if (process.env.NODE_ENV !== 'production') {
    return Array.from(new Set(['http://localhost:3000', 'http://localhost:3001', ...configured]));
  }
  return Array.from(new Set([...configured, ...deployedFrontends]));
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
