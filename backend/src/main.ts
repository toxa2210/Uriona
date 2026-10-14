import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const allowedOrigins = new Set(
    [
      "http://localhost:5173",
      "http://127.0.0.1:5173",
      "http://localhost:5174",
      "http://127.0.0.1:5174",
      "https://uriona.uz",
      "https://www.uriona.uz",
      ...(process.env.FRONTEND_URL?.split(",").map((value) => value.trim()).filter(Boolean) ?? [])
    ].filter(Boolean)
  );

  const trustedPreviewHosts = (process.env.TRUSTED_PREVIEW_HOSTS ?? "")
    .split(",")
    .map((host) => host.trim())
    .filter(Boolean);

  app.enableCors({
    origin: (requestOrigin, callback) => {
      if (!requestOrigin) {
        return callback(null, false);
      }

      if (allowedOrigins.has(requestOrigin)) {
        return callback(null, true);
      }

      const isTrustedPreview =
        process.env.NODE_ENV !== "production" &&
        trustedPreviewHosts.some((host) => requestOrigin.endsWith(host));

      if (isTrustedPreview) {
        return callback(null, true);
      }

      return callback(null, false);
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"]
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
