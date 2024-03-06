import * as lumigo from "@lumigo/opentelemetry";
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  await lumigo.init;
  const app = await NestFactory.create(AppModule);
  const port = parseInt(process.env.NEST_JS_PORT) | 3000;
  await app.listen(port);
  console.log(`listening on port ${port}`);
}
bootstrap();
