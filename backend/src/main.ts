import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const allowedOrigins = new Set([
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:5174",
    "http://127.0.0.1:5174",
    "https://uriona.uz",
    "https://www.uriona.uz",
    "https://uriona-frontend.onrender.com",
    ...(process.env.FRONTEND_URL?.split(",").map((value) => value.trim()) ?? [])
  ]);
  app.enableCors({
    origin: (requestOrigin, callback) => {
      const isRenderPreview = requestOrigin?.endsWith(".onrender.com") ?? false;
      callback(null, !requestOrigin || allowedOrigins.has(requestOrigin) || isRenderPreview);
    },
    credentials: true
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true
    })
  );

  app.setGlobalPrefix("api/v1");

  const port = Number(process.env.PORT ?? process.env.APP_PORT ?? 8000);
  await app.listen(port);

  console.log(`Uriona API running on http://localhost:${port}/api/v1`);
}

bootstrap();
