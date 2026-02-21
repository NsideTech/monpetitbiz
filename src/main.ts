import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { ConfigurationValidatorService } from './config/configuration-validator.service';
import { TwilioConfigService } from './config/twilio.config';
import { NestExpressApplication } from '@nestjs/platform-express';
import * as express from 'express';
import * as fs from 'fs';
import * as path from 'path';
import * as bodyParser from 'body-parser';

async function bootstrap() {
    console.log('🚀 Starting MonPetitBiz WhatsApp Bot...');
    
    // HTTPS Configuration
    let httpsOptions = null;
    const useHttps = process.env.USE_HTTPS === 'true';
    
    if (useHttps) {
        const keyPath = process.env.SSL_KEY_PATH || path.join(process.cwd(), 'ssl', 'private-key.pem');
        const certPath = process.env.SSL_CERT_PATH || path.join(process.cwd(), 'ssl', 'certificate.pem');
        
        try {
            httpsOptions = {
                key: fs.readFileSync(keyPath),
                cert: fs.readFileSync(certPath),
            };
            console.log('✅ HTTPS certificates loaded successfully');
        } catch (error) {
            console.error('❌ Failed to load HTTPS certificates:', error.message);
            console.log('💡 To generate self-signed certificates, run: npm run generate:ssl');
            process.exit(1);
        }
    }

    const app = await NestFactory.create<NestExpressApplication>(AppModule, {
        httpsOptions,
    });

    // Serve static files from public directory (for Speed Insights script)
    const publicPath = path.join(process.cwd(), 'public');
    app.useStaticAssets(publicPath);

    // Validate configuration on startup
    console.log('🔍 Validating system configuration...');
    try {
        const configValidator = app.get(ConfigurationValidatorService);
        await configValidator.validateConfigurationOrThrow();
        console.log('✅ Configuration validation completed successfully');
    } catch (error) {
        console.error('❌ Configuration validation failed:', error.message);
        console.error('💡 Please check your environment variables and try again');
        process.exit(1);
    }

    // Configure raw body parsing for webhook signature verification
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

    // Enable CORS for web dashboard and Vercel
    // FRONTEND_URL should point to the admin portal URL (e.g., https://admin.monpetitbiz.com)
    // In development, all origins are allowed for easier testing
    app.enableCors({
        origin: process.env.NODE_ENV === 'production'
            ? [
                process.env.FRONTEND_URL,
                /\.vercel\.app$/,
                process.env.APP_URL
              ].filter(Boolean)
            : true,
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
        .addServer(useHttps ? 'https://localhost:9000' : 'http://localhost:9000', 'Development server')
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

    const configService = app.get(ConfigService);
    const port = configService.get('PORT', 9000);
    const protocol = useHttps ? 'https' : 'http';

    await app.listen(port);
    
    const baseUrl = process.env.NODE_ENV === 'production' 
        ? process.env.APP_URL || `${protocol}://localhost:${port}`
        : `${protocol}://localhost:${port}`;
    
    console.log(`🚀 Application is running on: ${baseUrl}`);
    console.log(`📚 API Documentation available at: ${baseUrl}/api`);
    console.log(`🏥 Health check available at: ${baseUrl}/health`);
    
    if (process.env.NODE_ENV === 'production') {
        console.log('🌐 Production mode - Vercel deployment');
    } else if (useHttps) {
        console.log('🔒 HTTPS is enabled');
    } else {
        console.log('🔓 HTTP mode (set USE_HTTPS=true for HTTPS)');
    }
}

bootstrap();