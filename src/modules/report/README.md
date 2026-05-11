# PDF Report Generation Module

This module provides PDF report generation functionality for the WhatsApp Bot MVP. It generates professional-looking financial reports that can be shared via WhatsApp.

## Features

- **PDF Generation**: Creates professional PDF reports using Puppeteer and Handlebars templates
- **Supabase Storage**: Uploads PDFs to a Supabase bucket and returns time-limited signed URLs
- **WhatsApp Integration**: Sends PDF documents directly via WhatsApp
- **Customizable Templates**: Uses Handlebars templates for flexible report layouts
- **Error Handling**: Graceful fallback to text reports if PDF generation fails
- **Multi-language Support**: Templates support French and other languages

## Components

### PDFGenerationService

Main service responsible for:
- Generating PDF reports from business data
- Managing Handlebars templates
- Uploading PDFs to Supabase Storage
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
# Supabase Storage (server only — use service role, never the anon key in the API)
SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
SUPABASE_STORAGE_BUCKET=reports

# WhatsApp API (for document sending)
WHATSAPP_ACCESS_TOKEN=your_token
WHATSAPP_PHONE_NUMBER_ID=your_phone_id
```

### Supabase Storage setup

1. In Supabase Dashboard → **Storage**, create a bucket (e.g. `reports`, or match `SUPABASE_STORAGE_BUCKET`).
2. Policies: uploads use the **service role** from the backend; restrict public access and rely on **signed URLs** for downloads (e.g. Twilio media).
3. Never expose `SUPABASE_SERVICE_ROLE_KEY` to clients or commit it to the repository.

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
2. **Storage upload failure**: Returns error with detailed message from Supabase
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
- **@supabase/supabase-js**: Supabase Storage upload and signed URLs

## Security Considerations

- Signed download URLs expire after 24 hours (configure object lifecycle in Supabase if you need automatic deletion)
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

2. **Supabase upload failed**
   - Verify `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and bucket policies
   - Check `SUPABASE_STORAGE_BUCKET` matches the bucket created in the Supabase dashboard

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