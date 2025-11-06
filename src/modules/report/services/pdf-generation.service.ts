import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import * as puppeteer from 'puppeteer';
import * as Handlebars from 'handlebars';
import * as fs from 'fs';
import * as path from 'path';
import { BalanceReport } from '../dto/report.dto';
import { Business } from '../../auth/entities/business.entity';

export interface PDFGenerationOptions {
    businessId: string;
    reportData: BalanceReport;
    business: Business;
    templateType?: 'standard' | 'detailed';
}

export interface PDFResult {
    success: boolean;
    url?: string;
    fileName?: string;
    error?: string;
}

@Injectable()
export class PDFGenerationService {
    private readonly logger = new Logger(PDFGenerationService.name);
    private s3Client: S3Client;
    private bucketName: string;

    constructor(private configService: ConfigService) {
        // Initialize AWS S3 client only if credentials are provided
        const awsAccessKey = this.configService.get('AWS_ACCESS_KEY_ID');
        const awsSecretKey = this.configService.get('AWS_SECRET_ACCESS_KEY');
        
        if (awsAccessKey && awsSecretKey) {
            this.s3Client = new S3Client({
                region: this.configService.get('AWS_REGION', 'us-east-1'),
                credentials: {
                    accessKeyId: awsAccessKey,
                    secretAccessKey: awsSecretKey,
                },
            });
            this.bucketName = this.configService.get('AWS_S3_BUCKET_NAME', 'monpetitbiz-reports');
            this.logger.log('AWS S3 client initialized for PDF storage');
        } else {
            this.logger.warn('AWS credentials not found. PDF generation will be disabled or use alternative storage.');
            // S3 client will remain undefined
        }

        // Register Handlebars helpers
        this.registerHandlebarsHelpers();
    }

    /**
     * Register custom Handlebars helpers
     */
    private registerHandlebarsHelpers(): void {
        Handlebars.registerHelper('gt', function (a, b) {
            return a > b;
        });

        Handlebars.registerHelper('eq', function (a, b) {
            return a === b;
        });

        Handlebars.registerHelper('formatNumber', function (number) {
            return new Intl.NumberFormat('fr-FR').format(number);
        });
    }

    /**
     * Generate PDF report and upload to S3
     */
    async generatePDFReport(options: PDFGenerationOptions): Promise<PDFResult> {
        try {
            // Check if S3 is configured
            if (!this.s3Client) {
                this.logger.warn('AWS S3 not configured, PDF generation disabled');
                return {
                    success: false,
                    error: 'PDF generation requires AWS S3 configuration (AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_S3_BUCKET_NAME)'
                };
            }

            this.logger.log(`Generating PDF report for business ${options.businessId}`);

            // Generate PDF buffer
            const pdfBuffer = await this.generatePDFBuffer(options);

            // Upload to S3
            const fileName = this.generateFileName(options.businessId, options.reportData.period);
            const s3Url = await this.uploadToS3(pdfBuffer, fileName);

            this.logger.log(`PDF report generated successfully: ${fileName}`);

            return {
                success: true,
                url: s3Url,
                fileName
            };
        } catch (error) {
            this.logger.error(`Failed to generate PDF report: ${error.message}`, error.stack);
            
            // On Vercel or if Puppeteer is disabled, return helpful error message
            if (process.env.VERCEL === '1' || process.env.DISABLE_PUPPETEER === 'true') {
                return {
                    success: false,
                    error: 'PDF generation is not available on this platform. Please use an external PDF service or configure Puppeteer with Chrome Lambda layer.'
                };
            }
            
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Generate PDF buffer using Puppeteer
     */
    private async generatePDFBuffer(options: PDFGenerationOptions): Promise<Buffer> {
        // Check if Puppeteer is disabled (e.g., on Vercel)
        const puppeteerDisabled = process.env.DISABLE_PUPPETEER === 'true' || process.env.VERCEL === '1';
        
        if (puppeteerDisabled) {
            throw new Error('PDF generation is disabled on this platform. Use a serverless PDF service or enable Puppeteer.');
        }

        let browser: puppeteer.Browser | null = null;

        try {
            // Launch browser with Vercel-compatible options
            const launchOptions: any = {
                headless: true,
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-gpu',
                    '--single-process'
                ]
            };

            // For Vercel/serverless environments
            if (process.env.VERCEL === '1' || process.env.AWS_LAMBDA_FUNCTION_NAME) {
                // Try to use Chrome from layer or fallback
                launchOptions.executablePath = process.env.CHROME_EXECUTABLE_PATH;
            }

            browser = await puppeteer.launch(launchOptions);

            const page = await browser.newPage();

            // Generate HTML content
            const htmlContent = await this.generateHTMLContent(options);

            // Set content and generate PDF
            await page.setContent(htmlContent, { waitUntil: 'networkidle0' });

            const pdfBuffer = await page.pdf({
                format: 'A4',
                printBackground: true,
                margin: {
                    top: '20mm',
                    right: '15mm',
                    bottom: '20mm',
                    left: '15mm'
                }
            });

            return Buffer.from(pdfBuffer);
        } catch (error) {
            this.logger.warn(`Puppeteer PDF generation failed: ${error.message}`);
            // Re-throw to be handled by caller
            throw error;
        } finally {
            if (browser) {
                try {
                    await browser.close();
                } catch (error) {
                    this.logger.warn(`Failed to close browser: ${error.message}`);
                }
            }
        }
    }

    /**
     * Generate HTML content from template
     */
    private async generateHTMLContent(options: PDFGenerationOptions): Promise<string> {
        const templatePath = path.join(__dirname, '../templates', 'report-template.hbs');

        // Check if template exists, if not create a default one
        if (!fs.existsSync(templatePath)) {
            await this.createDefaultTemplate();
        }

        const templateSource = fs.readFileSync(templatePath, 'utf8');
        const template = Handlebars.compile(templateSource);

        // Prepare template data
        const templateData = this.prepareTemplateData(options);

        return template(templateData);
    }

    /**
     * Prepare data for template rendering
     */
    private prepareTemplateData(options: PDFGenerationOptions) {
        const { reportData, business } = options;

        return {
            business: {
                name: business.name,
                currency: business.currency || 'XOF'
            },
            report: {
                ...reportData,
                formattedTotalSales: this.formatCurrency(reportData.totalSales, business.currency),
                formattedTotalExpenses: this.formatCurrency(reportData.totalExpenses, business.currency),
                formattedNetProfit: this.formatCurrency(reportData.netProfit, business.currency),
                profitMargin: reportData.totalSales > 0
                    ? ((reportData.netProfit / reportData.totalSales) * 100).toFixed(1)
                    : '0',
                generatedAt: new Date().toLocaleDateString('fr-FR', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                })
            },
            topProducts: reportData.topProducts?.map(product => ({
                ...product,
                formattedRevenue: this.formatCurrency(product.revenue, business.currency),
                averagePrice: product.quantity > 0
                    ? this.formatCurrency(product.revenue / product.quantity, business.currency)
                    : '0'
            })) || []
        };
    }

    /**
     * Format currency for display
     */
    private formatCurrency(amount: number, currency: string = 'XOF'): string {
        return new Intl.NumberFormat('fr-FR', {
            style: 'currency',
            currency: currency,
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        }).format(amount);
    }

    /**
     * Upload PDF to S3 and return signed URL
     * Includes response-content-type parameter to ensure Twilio receives proper Content-Type header
     */
    private async uploadToS3(pdfBuffer: Buffer, fileName: string): Promise<string> {
        if (!this.s3Client) {
            throw new Error('S3 client not initialized. AWS credentials are required.');
        }

        const key = `reports/${fileName}`;

        const command = new PutObjectCommand({
            Bucket: this.bucketName,
            Key: key,
            Body: pdfBuffer,
            ContentType: 'application/pdf',
            ContentDisposition: `attachment; filename="${fileName}"`,
            // Set expiration for 30 days
            Expires: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            // Ensure metadata is set for proper Content-Type
            Metadata: {
                'content-type': 'application/pdf'
            }
        });

        await this.s3Client.send(command);

        // Generate signed URL valid for 24 hours
        // Include response-content-type parameter to force correct Content-Type header
        // This is required for Twilio to properly process the media URL
        const getCommand = new GetObjectCommand({
            Bucket: this.bucketName,
            Key: key,
            ResponseContentType: 'application/pdf',
            ResponseContentDisposition: `attachment; filename="${fileName}"`
        });

        let signedUrl = await getSignedUrl(this.s3Client, getCommand, { expiresIn: 24 * 60 * 60 });
        
        // Ensure response-content-type parameter is in the URL for Twilio compatibility
        // Some AWS SDK versions may not include it properly, so we add it manually if missing
        if (!signedUrl.includes('response-content-type')) {
            const separator = signedUrl.includes('?') ? '&' : '?';
            signedUrl = `${signedUrl}${separator}response-content-type=application%2Fpdf`;
        }
        
        this.logger.debug(`Generated S3 signed URL for ${fileName} with Content-Type: application/pdf`);
        
        return signedUrl;
    }

    /**
     * Generate unique filename for PDF
     */
    private generateFileName(businessId: string, period: string): string {
        const timestamp = new Date().toISOString().split('T')[0];
        const sanitizedPeriod = period.replace(/[^a-zA-Z0-9]/g, '-');
        return `rapport-${businessId}-${sanitizedPeriod}-${timestamp}.pdf`;
    }

    /**
     * Create default PDF template if it doesn't exist
     */
    private async createDefaultTemplate(): Promise<void> {
        const templateDir = path.join(__dirname, '../templates');
        const templatePath = path.join(templateDir, 'report-template.hbs');

        // Create templates directory if it doesn't exist
        if (!fs.existsSync(templateDir)) {
            fs.mkdirSync(templateDir, { recursive: true });
        }

        const defaultTemplate = `
<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Rapport Financier - {{business.name}}</title>
    <style>
        body {
            font-family: 'Arial', sans-serif;
            margin: 0;
            padding: 0;
            color: #333;
            line-height: 1.6;
        }
        
        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 30px;
            text-align: center;
        }
        
        .header h1 {
            margin: 0;
            font-size: 28px;
            font-weight: bold;
        }
        
        .header p {
            margin: 10px 0 0 0;
            font-size: 16px;
            opacity: 0.9;
        }
        
        .content {
            padding: 30px;
        }
        
        .summary-cards {
            display: flex;
            justify-content: space-between;
            margin-bottom: 30px;
            gap: 20px;
        }
        
        .card {
            flex: 1;
            background: #f8f9fa;
            border-radius: 8px;
            padding: 20px;
            text-align: center;
            border-left: 4px solid #667eea;
        }
        
        .card.expenses {
            border-left-color: #e74c3c;
        }
        
        .card.profit {
            border-left-color: #27ae60;
        }
        
        .card h3 {
            margin: 0 0 10px 0;
            font-size: 14px;
            text-transform: uppercase;
            color: #666;
            font-weight: normal;
        }
        
        .card .amount {
            font-size: 24px;
            font-weight: bold;
            color: #333;
            margin: 0;
        }
        
        .section {
            margin-bottom: 30px;
        }
        
        .section h2 {
            color: #667eea;
            border-bottom: 2px solid #667eea;
            padding-bottom: 10px;
            margin-bottom: 20px;
        }
        
        .metrics-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 20px;
            margin-bottom: 20px;
        }
        
        .metric {
            background: #f8f9fa;
            padding: 15px;
            border-radius: 6px;
        }
        
        .metric-label {
            font-size: 12px;
            color: #666;
            text-transform: uppercase;
            margin-bottom: 5px;
        }
        
        .metric-value {
            font-size: 18px;
            font-weight: bold;
            color: #333;
        }
        
        .products-table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 20px;
        }
        
        .products-table th,
        .products-table td {
            padding: 12px;
            text-align: left;
            border-bottom: 1px solid #ddd;
        }
        
        .products-table th {
            background-color: #667eea;
            color: white;
            font-weight: bold;
        }
        
        .products-table tr:hover {
            background-color: #f5f5f5;
        }
        
        .footer {
            margin-top: 40px;
            padding-top: 20px;
            border-top: 1px solid #ddd;
            text-align: center;
            color: #666;
            font-size: 12px;
        }
        
        .profit-positive {
            color: #27ae60;
        }
        
        .profit-negative {
            color: #e74c3c;
        }
        
        @media print {
            body {
                -webkit-print-color-adjust: exact;
            }
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>{{business.name}}</h1>
        <p>Rapport Financier - {{report.period}}</p>
    </div>
    
    <div class="content">
        <div class="summary-cards">
            <div class="card">
                <h3>Ventes Totales</h3>
                <p class="amount">{{report.formattedTotalSales}}</p>
            </div>
            <div class="card expenses">
                <h3>Dépenses Totales</h3>
                <p class="amount">{{report.formattedTotalExpenses}}</p>
            </div>
            <div class="card profit">
                <h3>Bénéfice Net</h3>
                <p class="amount {{#if (gt report.netProfit 0)}}profit-positive{{else}}profit-negative{{/if}}">
                    {{report.formattedNetProfit}}
                </p>
            </div>
        </div>
        
        <div class="section">
            <h2>Résumé des Activités</h2>
            <div class="metrics-grid">
                <div class="metric">
                    <div class="metric-label">Nombre de Transactions</div>
                    <div class="metric-value">{{report.transactionCount}}</div>
                </div>
                <div class="metric">
                    <div class="metric-label">Nombre de Ventes</div>
                    <div class="metric-value">{{report.salesCount}}</div>
                </div>
                <div class="metric">
                    <div class="metric-label">Nombre de Dépenses</div>
                    <div class="metric-value">{{report.expenseCount}}</div>
                </div>
                <div class="metric">
                    <div class="metric-label">Marge Bénéficiaire</div>
                    <div class="metric-value">{{report.profitMargin}}%</div>
                </div>
            </div>
        </div>
        
        {{#if topProducts}}
        <div class="section">
            <h2>Produits les Plus Vendus</h2>
            <table class="products-table">
                <thead>
                    <tr>
                        <th>Produit</th>
                        <th>Chiffre d'Affaires</th>
                        <th>Quantité</th>
                        <th>Prix Moyen</th>
                        <th>Transactions</th>
                    </tr>
                </thead>
                <tbody>
                    {{#each topProducts}}
                    <tr>
                        <td>{{this.product}}</td>
                        <td>{{this.formattedRevenue}}</td>
                        <td>{{this.quantity}}</td>
                        <td>{{this.averagePrice}}</td>
                        <td>{{this.transactionCount}}</td>
                    </tr>
                    {{/each}}
                </tbody>
            </table>
        </div>
        {{/if}}
        
        <div class="footer">
            <p>Rapport généré le {{report.generatedAt}} par MonPetitBiz</p>
            <p>Ce rapport est confidentiel et destiné uniquement à l'usage interne de {{business.name}}</p>
        </div>
    </div>
</body>
</html>`;

        fs.writeFileSync(templatePath, defaultTemplate);
        this.logger.log('Default PDF template created');
    }
}