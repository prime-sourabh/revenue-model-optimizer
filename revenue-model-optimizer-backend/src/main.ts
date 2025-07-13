import { NestFactory } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Enable CORS for all origins (development only)
  app.enableCors();

  // Global validation pipe (relaxed for API testing)
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: false,
      forbidNonWhitelisted: false,
      transform: true,
    })
  );

  // Global prefix for API routes
  app.setGlobalPrefix("api/v1");

  const port = process.env.PORT || 3000;
  await app.listen(port);

  console.log(`🚀 Revenue Model Optimizer API running on port ${port}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV || "development"}`);
  console.log(`🌐 API Base URL: http://localhost:${port}/api/v1`);
}

bootstrap();
