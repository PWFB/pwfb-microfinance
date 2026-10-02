import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

function getAllowedOrigins(): Set<string> {
  const configured = String(process.env.CORS_ALLOWED_ORIGINS || '')
    .split(',')
    .map((value) => value.trim().replace(/\/$/, ''))
    .filter(Boolean);
  const defaults = process.env.NODE_ENV === 'production'
    ? ['https://pwfb-frontend.onrender.com']
    : ['http://localhost:3000', 'http://127.0.0.1:3000', 'https://pwfb-frontend.onrender.com'];
  return new Set([...defaults, ...configured]);
}

async function bootstrap() {
  if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET must be configured in production');
  }
  const app = await NestFactory.create(AppModule, { rawBody: true });
  const allowedOrigins = getAllowedOrigins();
  app.enableCors({
    origin: (requestOrigin, callback) => {
      if (!requestOrigin || allowedOrigins.has(requestOrigin.replace(/\/$/, ''))) {
        callback(null, true);
        return;
      }
      callback(new Error('Origin is not allowed by PWFB CORS policy'), false);
    },
    credentials: true,
  });
  await app.listen(process.env.PORT ?? 3000);
  console.log(`PWFB Backend listening on port ${process.env.PORT ?? 3000}`);
}

bootstrap();