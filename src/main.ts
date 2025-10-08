import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import * as express from 'express';

async function bootstrap() {
    const app = await NestFactory.create(AppModule);

    // Configure raw body parsing for webhook signature verification
    app.use('/whatsapp/webhook', express.raw({ type: 'application/json' }));

    // Global validation pipe
    app.useGlobalPipes(new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
    }));

    // Enable CORS for web dashboard
    app.enableCors({
        origin: process.env.NODE_ENV === 'production'
            ? process.env.FRONTEND_URL
            : 'http://localhost:3001',
        credentials: true,
    });

    // Setup Swagger/OpenAPI documentation
    const config = new DocumentBuilder()
        .setTitle('MonPetitBiz WhatsApp Bot API')
        .setDescription(`
            A WhatsApp bot API for micro-businesses in Africa to record transactions, 
            track inventory, and generate financial reports through natural language conversations.
            
            ## Features
            - WhatsApp webhook integration
            - Natural language processing for business commands
            - Transaction recording (sales & expenses)
            - Inventory management
            - Financial report generation
            - PDF report delivery via WhatsApp
            - Comprehensive health monitoring
            
            ## Authentication
            Most endpoints require JWT authentication. Use the /auth/send-otp and 
            /auth/verify-otp endpoints to obtain an access token.
            
            ## Supported WhatsApp Commands
            
            ### Sales Recording
            - "vente 1000" - Record a sale of 1000 CFA
            - "vente pain 1500" - Record sale of bread for 1500 CFA
            - "j'ai vendu du pain à 2000" - Natural language sale
            
            ### Expense Recording
            - "dépense 500" - Record an expense of 500 CFA
            - "dépense 500 marchandise" - Record expense with description
            - "j'ai acheté du sucre à 1000" - Natural language expense
            
            ### Stock Management
            - "stock pain 50" - Update bread stock to 50 units
            - "stock pain" - Check bread stock level
            - "stock" - Check all stock levels
            
            ### Reports
            - "bilan jour" - Daily balance report
            - "bilan semaine" - Weekly balance report
            - "bilan mois" - Monthly balance report
            - "rapport PDF" - Generate and send PDF report
        `)
        .setVersion('1.0.0')
        .setContact('MonPetitBiz Support', 'https://monpetitbiz.com', 'support@monpetitbiz.com')
        .setLicense('MIT', 'https://opensource.org/licenses/MIT')
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
        .addTag('Authentication', 'User authentication and registration')
        .addTag('WhatsApp', 'WhatsApp webhook and messaging')
        .addTag('Health', 'System health and monitoring')
        .addTag('Dashboard', 'Web dashboard API (read-only)')
        .addServer('http://localhost:3000', 'Development server')
        .addServer('https://api.monpetitbiz.com', 'Production server')
        .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api', app, document, {
        customSiteTitle: 'MonPetitBiz API Documentation',
        customfavIcon: '/favicon.ico',
        customCss: `
            .swagger-ui .topbar { display: none }
            .swagger-ui .info .title { color: #2c5aa0 }
        `,
        swaggerOptions: {
            persistAuthorization: true,
            displayRequestDuration: true,
            filter: true,
            showExtensions: true,
            showCommonExtensions: true,
        },
    });

    const configService = app.get(ConfigService);
    const port = configService.get('PORT', 3000);

    await app.listen(port);
    console.log(`Application is running on: http://localhost:${port}`);
    console.log(`API Documentation available at: http://localhost:${port}/api`);
}

bootstrap();