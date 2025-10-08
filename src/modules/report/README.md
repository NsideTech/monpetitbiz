# PDF Report Generation Module

This module provides PDF report generation functionality for the WhatsApp Bot MVP. It generates professional-looking financial reports that can be shared via WhatsApp.

## Features

- **PDF Generation**: Creates professional PDF reports using Puppeteer and Handlebars templates
- **AWS S3 Integration**: Uploads PDFs to S3 and generates signed URLs for sharing
- **WhatsApp Integration**: Sends PDF documents directly via WhatsApp
- **Customizable Templates**: Uses Handlebars templates for flexible report layouts
- **Error Handling**: Graceful fallback to text reports if PDF generation fails
- **Multi-language Support**: Templates support French and other languages

## Components

### PDFGenerationService

Main service responsible for:
- Generating PDF reports from business data
- Managing Handlebars templates
- Uploading PDFs to AWS S3
- Creating signed URLs for secure access

### Report Templates

Located in `src/modules/report/templates/`:
- `report-template.hbs`: Main PDF template with business branding
- Supports dynamic data binding with Handlebars
- Responsive design optimized for PDF generation

## Usage

### Generate PDF Report

```typescript
import { PDFGenerationService } from './services/pdf-generation.service';

// Inject the service
constructor(private pdfService: PDFGenerationService) {}

// Generate PDF
const result = await this.pdfService.generatePDFReport({
  businessId: 'business-uuid',
  reportData: balanceReport,
  business: businessEntity,
  templateType: 'standard'
});

if (result.success) {
  console.log('PDF URL:', result.url);
  console.log('File name:', result.fileName);
} else {
  console.error('Error:', result.error);
}
```

### Send PDF via WhatsApp

```typescript
import { ReportService } from './report.service';

// Generate and send PDF report
const result = await this.reportService.generateAndSendPDFReport(
  'business-uuid',
  '+1234567890', // User phone number
  ReportPeriod.MONTH
);

console.log(result.message);
```

### API Endpoints

#### Generate PDF Report
```http
POST /reports/:businessId/pdf
Content-Type: application/json

{
  "period": "month",
  "includeTopProducts": true,
  "topProductsLimit": 5
}
```

#### Send PDF via WhatsApp
```http
POST /reports/:businessId/pdf/send
Content-Type: application/json

{
  "phoneNumber": "+1234567890",
  "period": "week"
}
```

## Configuration

### Environment Variables

```bash
# AWS S3 Configuration
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
AWS_S3_BUCKET_NAME=your-bucket-name

# WhatsApp API (for document sending)
WHATSAPP_ACCESS_TOKEN=your_token
WHATSAPP_PHONE_NUMBER_ID=your_phone_id
```

### AWS S3 Setup

1. Create an S3 bucket for storing PDF reports
2. Configure bucket permissions for public read access to signed URLs
3. Set up IAM user with S3 permissions:
   - `s3:PutObject`
   - `s3:GetObject`
   - `s3:DeleteObject`

### Template Customization

The PDF template can be customized by editing `report-template.hbs`:

```handlebars
<!-- Business branding -->
<div class="header">
    <h1>{{business.name}}</h1>
    <p>{{report.period}}</p>
</div>

<!-- Financial summary -->
<div class="summary-cards">
    <div class="card">
        <h3>Ventes Totales</h3>
        <p class="amount">{{report.formattedTotalSales}}</p>
    </div>
    <!-- More cards... -->
</div>

<!-- Top products table -->
{{#if topProducts}}
<table class="products-table">
    {{#each topProducts}}
    <tr>
        <td>{{this.product}}</td>
        <td>{{this.formattedRevenue}}</td>
    </tr>
    {{/each}}
</table>
{{/if}}
```

## Error Handling

The service implements multiple fallback mechanisms:

1. **PDF Generation Failure**: Falls back to text-based reports
2. **S3 Upload Failure**: Returns error with detailed message
3. **WhatsApp Send Failure**: Logs error and notifies user
4. **Template Missing**: Creates default template automatically

## Testing

Run the PDF generation tests:

```bash
npm test -- --testPathPattern="pdf-generation.service.spec.ts"
```

## Dependencies

- **puppeteer**: PDF generation from HTML
- **handlebars**: Template engine
- **@aws-sdk/client-s3**: AWS S3 integration
- **@aws-sdk/s3-request-presigner**: Signed URL generation

## Security Considerations

- PDF files are stored with expiration dates (30 days)
- Signed URLs expire after 24 hours
- Business data is isolated by business ID
- No sensitive information is logged in PDF generation process

## Performance

- PDF generation typically takes 2-5 seconds
- Files are automatically cleaned up after expiration
- Template compilation is cached for better performance
- Concurrent PDF generation is supported

## Troubleshooting

### Common Issues

1. **Puppeteer Launch Failed**
   - Ensure Chrome/Chromium is available in the environment
   - Add `--no-sandbox` flag for Docker environments

2. **S3 Upload Failed**
   - Verify AWS credentials and permissions
   - Check bucket name and region configuration

3. **Template Not Found**
   - Service automatically creates default template
   - Check file permissions in templates directory

4. **WhatsApp Document Send Failed**
   - Verify WhatsApp API credentials
   - Check phone number format
   - Ensure document URL is accessible

### Debug Mode

Enable debug logging:

```typescript
// In your service
private readonly logger = new Logger(PDFGenerationService.name);
this.logger.debug('PDF generation started');
```

## Future Enhancements

- Multiple template themes
- Chart generation in PDFs
- Batch PDF generation
- Email delivery option
- PDF password protection