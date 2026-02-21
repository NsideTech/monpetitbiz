import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { ConfigurationValidatorService } from './config/configuration-validator.service';
import { ConfigService } from '@nestjs/config';
import { ExpressAdapter } from '@nestjs/platform-express';
import * as express from 'express';
import * as bodyParser from 'body-parser';
import * as path from 'path';
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
    // Twilio sends application/x-www-form-urlencoded, not JSON
    // Store raw body for signature verification, then parse as URL-encoded
    app.use('/whatsapp/twilio/webhook', (req: express.Request, res: express.Response, next: express.NextFunction) => {
      // Store raw body for signature verification
      const chunks: Buffer[] = [];
      req.on('data', (chunk: Buffer) => chunks.push(chunk));
      req.on('end', () => {
        (req as any).rawBody = Buffer.concat(chunks);
        // Parse URL-encoded body for NestJS @Body() decorator
        bodyParser.urlencoded({ extended: true })(req, res, next);
      });
    });
    app.use('/whatsapp/webhook', express.raw({ type: 'application/json' }));

    // Global validation pipe
    app.useGlobalPipes(new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
    }));

    // Enable CORS
    // FRONTEND_URL should point to the admin portal URL (e.g., https://admin.monpetitbiz.com)
    // In development, all origins are allowed for easier testing
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

    // Serve static files from public directory (for Speed Insights script)
    const publicPath = path.join(process.cwd(), 'public');
    app.use(express.static(publicPath));

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
        customJs: [
            // Vercel Speed Insights for Web Vitals tracking
            '/vercel-speed-insights.js',
        ],
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


