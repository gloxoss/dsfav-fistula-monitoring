import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { HttpExceptionFilter } from './common/http-exception.filter.js';
import { DsfavWsAdapter } from './realtime/dsfav-ws.adapter.js';

async function bootstrap() {
  const envPath = resolve(dirname(fileURLToPath(import.meta.url)), '../.env');
  if (existsSync(envPath)) process.loadEnvFile(envPath);

  const { AppModule } = await import('./app.module.js');
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.useBodyParser('json', { limit: '16mb' });
  app.use((err: any, _req: any, res: any, next: any) => {
    if (err?.status === 413 || err?.type === 'entity.too.large') {
      return res.status(413).json({
        code: 'PAYLOAD_TOO_LARGE',
        message_fr: 'Taille de requête excessive',
        retryable: false,
      });
    }
    if (err instanceof SyntaxError && 'body' in err) {
      return res.status(400).json({
        code: 'INVALID_JSON',
        message_fr: 'Corps de requête JSON malformé',
        retryable: false,
      });
    }
    next(err);
  });
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useWebSocketAdapter(new DsfavWsAdapter(app));
  await app.listen(process.env.PORT ?? 3101);
}
await bootstrap();
