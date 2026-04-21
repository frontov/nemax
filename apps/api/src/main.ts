import "reflect-metadata";
import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { corsOrigin } from "./common/utils/cors-origin";

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    cors: {
      origin: corsOrigin,
      credentials: true,
    },
  });

  app.setGlobalPrefix("api", {
    exclude: ["health"],
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: false,
    }),
  );

  const port = Number(process.env.PORT ?? 3001);
  await app.listen(port, "0.0.0.0");
}

void bootstrap();
