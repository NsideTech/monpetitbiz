import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { ConfigurationValidatorService } from './config/configuration-validator.service';
import { ConfigService } from '@nestjs/config';
import { ExpressAdapter } from '@nestjs/platform-express';
import * as express from 'express';
import type { NestApplicationOptions } from '@nestjs/common';

export async function createNestApplication(expressInstance?: express.Express, options?: NestApplicationOptions) {
    const app = expressInstance
        ? await NestFactory.create(AppModule, new ExpressAdapter(expressInstance))
        : await NestFactory.create(AppModule, options);

    // Validate configuration on startup (skip in production for faster cold starts)
    if (process.env.NODE_ENV !== 'production') {
        const configValidator = app.get(ConfigurationValidatorService);
        await configValidator.validateConfigurationOrThrow();
    }

    // Raw body for webhook signature verification
    app.use('/whatsapp/webhook', express.raw({ type: 'application/json' }));

    // Global validation pipe
    app.useGlobalPipes(new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
    }));

    // Enable CORS
    app.enableCors({
        origin: process.env.NODE_ENV === 'production'
            ? [
                process.env.FRONTEND_URL,
                /\.vercel\.app$/,
                process.env.APP_URL,
            ].filter(Boolean) as any
            : true,
        credentials: true,
    });

    // Swagger/OpenAPI
    const useHttps = process.env.USE_HTTPS === 'true';
    const config = new DocumentBuilder()
        .setTitle('MonPetitBiz WhatsApp Bot API')
        .setDescription('API for WhatsApp bot and dashboard')
        .setVersion('1.0.0')
        .addBearerAuth(
            {
                type: 'http',
                scheme: 'bearer',
                bearerFormat: 'JWT',
                name: 'JWT',
                description: 'Enter JWT token',
                in: 'header',
            },
            'JWT-auth'
        )
        .addServer(useHttps ? 'https://localhost:3000' : 'http://localhost:3000', 'Development server')
        .addServer('https://api.monpetitbiz.com', 'Production server')
        .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api', app, document, {
        customSiteTitle: 'MonPetitBiz API Documentation',
        customfavIcon: '/favicon.ico',
        swaggerOptions: {
            persistAuthorization: true,
            displayRequestDuration: true,
            filter: true,
            showExtensions: true,
            showCommonExtensions: true,
        },
    });

    // Expose config service for callers if needed
    const configService = app.get(ConfigService);
    return { app, configService };
}


