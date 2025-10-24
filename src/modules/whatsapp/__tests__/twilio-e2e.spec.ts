import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WhatsappModule } from '../whatsapp.module';
import { AuthModule } from '../../auth/auth.module';
import { TransactionModule } from '../../transaction/transaction.module';
import { StockModule } from '../../stock/stock.module';
import { ReportModule } from '../../report/report.module';
import { TwilioWebhookMock } from '../test-utils/twilio-webhook-mock';
import { Business } from '../../auth/entities/business.entity';
import { User } from '../../auth/entities/user.entity';
import { Transaction } from '../../transaction/entities/transaction.entity';
import { StockItem } from '../../stock/entities/stock-item.entity';
import { Repository } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';

describe('Twilio End-to-End Tests', () => {
  let app: INestApplication;
  let businessRepository: Repository<Business>;
  let userRepository: Repository<User>;
  let transactionRepository: Repository<Transaction>;
  let stockRepository: Repository<StockItem>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          envFilePath: '.env.test',
        }),
        TypeOrmModule.forRoot({
          type: 'sqlite',
          database: ':memory:',
          entities: [__dirname + '/../../**/*.entity{.ts,.js}'],
          synchronize: true,
          logging: false,
        }),
        WhatsappModule,
        AuthModule,
        TransactionModule,
        StockModule,
        ReportModule,
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    businessRepository = moduleFixture.get<Repository<Business>>(getRepositoryToken(Business));
    userRepository = moduleFixture.get<Repository<User>>(getRepositoryToken(User));
    transactionRepository = moduleFixture.get<Repository<Transaction>>(getRepositoryToken(Transaction));
    stockRepository = moduleFixture.get<Repository<StockItem>>(getRepositoryToken(StockItem));

    // Set up test data
    await setupTestData();
  });

  afterAll(async () => {
    await app.close();
  });

  async function setupTestData() {
    // Create test business
    const business = businessRepository.create({
      name: 'Test Business',
      businessCode: 'TEST123',
    });
    await businessRepository.save(business);

    // Create test user
    const user = userRepository.create({
      phoneNumber: '+1234567890',
      employeeName: 'Test User',
      business: business,
      role: 'owner' as any,
    });
    await userRepository.save(user);
  }

  describe('Complete User Journey - New User Registration', () => {
    const newUserPhone = '+1987654321';

    it('should handle complete registration flow', async () => {
      // Step 1: User sends "register"
      const startPayload = TwilioWebhookMock.registrationMessage('start', {
        From: `whatsapp:${newUserPhone}`,
        Body: 'register',
      });

      let response = await request(app.getHttpServer())
        .post('/whatsapp/twilio/webhook')
        .send(TwilioWebhookMock.toUrlEncoded(startPayload))
        .set('Content-Type', 'application/x-www-form-urlencoded')
        .expect(200);

      expect(response.text).toContain('<Response>');
      expect(response.text).toContain('<Message>');

      // Step 2: User provides business code
      const businessCodePayload = TwilioWebhookMock.registrationMessage('business_code', {
        From: `whatsapp:${newUserPhone}`,
        Body: 'TEST123',
      });

      response = await request(app.getHttpServer())
        .post('/whatsapp/twilio/webhook')
        .send(TwilioWebhookMock.toUrlEncoded(businessCodePayload))
        .set('Content-Type', 'application/x-www-form-urlencoded')
        .expect(200);

      expect(response.text).toContain('<Response>');

      // Step 3: User provides employee name
      const employeeNamePayload = TwilioWebhookMock.registrationMessage('employee_name', {
        From: `whatsapp:${newUserPhone}`,
        Body: 'New Employee',
      });

      response = await request(app.getHttpServer())
        .post('/whatsapp/twilio/webhook')
        .send(TwilioWebhookMock.toUrlEncoded(employeeNamePayload))
        .set('Content-Type', 'application/x-www-form-urlencoded')
        .expect(200);

      expect(response.text).toContain('<Response>');

      // Verify user was created in database
      const createdUser = await userRepository.findOne({
        where: { phoneNumber: newUserPhone },
        relations: ['business'],
      });

      expect(createdUser).toBeTruthy();
      expect(createdUser.employeeName).toBe('New Employee');
      expect(createdUser.business.businessCode).toBe('TEST123');
    });
  });

  describe('Complete Business Operations Flow', () => {
    const userPhone = '+1234567890';

    it('should handle complete sales transaction flow', async () => {
      // Record a sale
      const salesPayload = TwilioWebhookMock.businessCommand('vente 150 produit e2e test', {
        From: `whatsapp:${userPhone}`,
      });

      const response = await request(app.getHttpServer())
        .post('/whatsapp/twilio/webhook')
        .send(TwilioWebhookMock.toUrlEncoded(salesPayload))
        .set('Content-Type', 'application/x-www-form-urlencoded')
        .expect(200);

      expect(response.text).toContain('<Response>');

      // Verify transaction was created
      const transaction = await transactionRepository.findOne({
        where: { 
          amount: 150,
          description: 'produit e2e test',
        },
        relations: ['user'],
      });

      expect(transaction).toBeTruthy();
      expect(transaction.user.phoneNumber).toBe(userPhone);
    });

    it('should handle complete expense transaction flow', async () => {
      // Record an expense
      const expensePayload = TwilioWebhookMock.businessCommand('depense 75 transport e2e', {
        From: `whatsapp:${userPhone}`,
      });

      const response = await request(app.getHttpServer())
        .post('/whatsapp/twilio/webhook')
        .send(TwilioWebhookMock.toUrlEncoded(expensePayload))
        .set('Content-Type', 'application/x-www-form-urlencoded')
        .expect(200);

      expect(response.text).toContain('<Response>');

      // Verify transaction was created
      const transaction = await transactionRepository.findOne({
        where: { 
          amount: 75,
          description: 'transport e2e',
        },
        relations: ['user'],
      });

      expect(transaction).toBeTruthy();
      expect(transaction.user.phoneNumber).toBe(userPhone);
    });

    it('should handle complete stock management flow', async () => {
      // Add stock
      const stockPayload = TwilioWebhookMock.businessCommand('stock produit e2e 50', {
        From: `whatsapp:${userPhone}`,
      });

      const response = await request(app.getHttpServer())
        .post('/whatsapp/twilio/webhook')
        .send(TwilioWebhookMock.toUrlEncoded(stockPayload))
        .set('Content-Type', 'application/x-www-form-urlencoded')
        .expect(200);

      expect(response.text).toContain('<Response>');

      // Verify stock item was created/updated
      const stockItem = await stockRepository.findOne({
        where: { product: 'produit e2e' },
        relations: ['business'],
      });

      expect(stockItem).toBeTruthy();
      expect(stockItem.quantity).toBe(50);
    });

    it('should handle report generation flow', async () => {
      // Request report
      const reportPayload = TwilioWebhookMock.businessCommand('rapport', {
        From: `whatsapp:${userPhone}`,
      });

      const response = await request(app.getHttpServer())
        .post('/whatsapp/twilio/webhook')
        .send(TwilioWebhookMock.toUrlEncoded(reportPayload))
        .set('Content-Type', 'application/x-www-form-urlencoded')
        .expect(200);

      expect(response.text).toContain('<Response>');
      // Report generation is async, so we just verify the response was sent
    });

    it('should handle status inquiry flow', async () => {
      // Request status
      const statusPayload = TwilioWebhookMock.businessCommand('status', {
        From: `whatsapp:${userPhone}`,
      });

      const response = await request(app.getHttpServer())
        .post('/whatsapp/twilio/webhook')
        .send(TwilioWebhookMock.toUrlEncoded(statusPayload))
        .set('Content-Type', 'application/x-www-form-urlencoded')
        .expect(200);

      expect(response.text).toContain('<Response>');
    });

    it('should handle help command flow', async () => {
      // Request help
      const helpPayload = TwilioWebhookMock.businessCommand('help', {
        From: `whatsapp:${userPhone}`,
      });

      const response = await request(app.getHttpServer())
        .post('/whatsapp/twilio/webhook')
        .send(TwilioWebhookMock.toUrlEncoded(helpPayload))
        .set('Content-Type', 'application/x-www-form-urlencoded')
        .expect(200);

      expect(response.text).toContain('<Response>');
    });
  });

  describe('Complex Business Scenarios', () => {
    const userPhone = '+1234567890';

    it('should handle multiple transactions in sequence', async () => {
      const transactions = [
        'vente 100 produit 1',
        'vente 200 produit 2',
        'depense 50 frais',
        'vente 150 produit 3',
      ];

      for (const transaction of transactions) {
        const payload = TwilioWebhookMock.businessCommand(transaction, {
          From: `whatsapp:${userPhone}`,
        });

        const response = await request(app.getHttpServer())
          .post('/whatsapp/twilio/webhook')
          .send(TwilioWebhookMock.toUrlEncoded(payload))
          .set('Content-Type', 'application/x-www-form-urlencoded')
          .expect(200);

        expect(response.text).toContain('<Response>');

        // Small delay between transactions
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // Verify all transactions were recorded
      const allTransactions = await transactionRepository.find({
        relations: ['user'],
      });

      const userTransactions = allTransactions.filter(t => t.user.phoneNumber === userPhone);
      expect(userTransactions.length).toBeGreaterThanOrEqual(4);
    });

    it('should handle stock updates and sales affecting inventory', async () => {
      const productName = 'produit inventory test';
      
      // Add initial stock
      const stockPayload = TwilioWebhookMock.businessCommand(`stock ${productName} 100`, {
        From: `whatsapp:${userPhone}`,
      });

      await request(app.getHttpServer())
        .post('/whatsapp/twilio/webhook')
        .send(TwilioWebhookMock.toUrlEncoded(stockPayload))
        .set('Content-Type', 'application/x-www-form-urlencoded')
        .expect(200);

      // Make a sale that should affect inventory
      const salePayload = TwilioWebhookMock.businessCommand(`vente 25 ${productName}`, {
        From: `whatsapp:${userPhone}`,
      });

      await request(app.getHttpServer())
        .post('/whatsapp/twilio/webhook')
        .send(TwilioWebhookMock.toUrlEncoded(salePayload))
        .set('Content-Type', 'application/x-www-form-urlencoded')
        .expect(200);

      // Verify inventory was updated (if implemented)
      const stockItem = await stockRepository.findOne({
        where: { product: productName },
      });

      expect(stockItem).toBeTruthy();
      // Note: Inventory reduction logic would depend on business rules implementation
    });

    it('should handle conversation state across multiple messages', async () => {
      // This tests the conversation state management
      const messages = [
        'hello',
        'help',
        'vente 100 produit conversation test',
        'status',
      ];

      for (const message of messages) {
        const payload = TwilioWebhookMock.incomingMessage({
          From: `whatsapp:${userPhone}`,
          Body: message,
        });

        const response = await request(app.getHttpServer())
          .post('/whatsapp/twilio/webhook')
          .send(TwilioWebhookMock.toUrlEncoded(payload))
          .set('Content-Type', 'application/x-www-form-urlencoded')
          .expect(200);

        expect(response.text).toContain('<Response>');

        await new Promise(resolve => setTimeout(resolve, 100));
      }
    });
  });

  describe('Error Handling in Real Scenarios', () => {
    it('should handle invalid business commands gracefully', async () => {
      const invalidCommands = [
        'vente invalid amount produit',
        'depense -50 negative expense',
        'stock produit invalid quantity',
        'unknown command',
      ];

      for (const command of invalidCommands) {
        const payload = TwilioWebhookMock.businessCommand(command, {
          From: `whatsapp:+1234567890`,
        });

        const response = await request(app.getHttpServer())
          .post('/whatsapp/twilio/webhook')
          .send(TwilioWebhookMock.toUrlEncoded(payload))
          .set('Content-Type', 'application/x-www-form-urlencoded')
          .expect(200);

        expect(response.text).toContain('<Response>');
        // Should contain error message or help text
      }
    });

    it('should handle unregistered user attempts', async () => {
      const unregisteredPhone = '+1999888777';
      const payload = TwilioWebhookMock.businessCommand('vente 100 test', {
        From: `whatsapp:${unregisteredPhone}`,
      });

      const response = await request(app.getHttpServer())
        .post('/whatsapp/twilio/webhook')
        .send(TwilioWebhookMock.toUrlEncoded(payload))
        .set('Content-Type', 'application/x-www-form-urlencoded')
        .expect(200);

      expect(response.text).toContain('<Response>');
      // Should prompt for registration
    });

    it('should handle malformed webhook payloads', async () => {
      const malformedPayloads = [
        'Body=test', // Missing required fields
        'MessageSid=invalid&Body=test', // Invalid MessageSid format
        'From=invalid-phone&Body=test', // Invalid phone format
      ];

      for (const payload of malformedPayloads) {
        const response = await request(app.getHttpServer())
          .post('/whatsapp/twilio/webhook')
          .send(payload)
          .set('Content-Type', 'application/x-www-form-urlencoded');

        // Should handle gracefully, either 400 or 200 with error response
        expect([200, 400]).toContain(response.status);
      }
    });
  });

  describe('Performance and Load Scenarios', () => {
    it('should handle concurrent webhook requests', async () => {
      const concurrentRequests = 10;
      const promises = [];

      for (let i = 0; i < concurrentRequests; i++) {
        const payload = TwilioWebhookMock.businessCommand(`vente ${100 + i} produit concurrent ${i}`, {
          From: `whatsapp:+1234567890`,
        });

        const promise = request(app.getHttpServer())
          .post('/whatsapp/twilio/webhook')
          .send(TwilioWebhookMock.toUrlEncoded(payload))
          .set('Content-Type', 'application/x-www-form-urlencoded');

        promises.push(promise);
      }

      const responses = await Promise.all(promises);

      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.text).toContain('<Response>');
      });
    });

    it('should handle rapid sequential messages from same user', async () => {
      const rapidMessages = [
        'vente 10 rapid 1',
        'vente 20 rapid 2',
        'vente 30 rapid 3',
        'status',
        'help',
      ];

      const promises = rapidMessages.map(message => {
        const payload = TwilioWebhookMock.businessCommand(message, {
          From: `whatsapp:+1234567890`,
        });

        return request(app.getHttpServer())
          .post('/whatsapp/twilio/webhook')
          .send(TwilioWebhookMock.toUrlEncoded(payload))
          .set('Content-Type', 'application/x-www-form-urlencoded');
      });

      const responses = await Promise.all(promises);

      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.text).toContain('<Response>');
      });
    });
  });

  describe('Data Consistency Verification', () => {
    it('should maintain data consistency across operations', async () => {
      const initialTransactionCount = await transactionRepository.count();
      const initialStockCount = await stockRepository.count();

      // Perform various operations
      const operations = [
        'vente 100 consistency test 1',
        'depense 50 consistency expense',
        'stock consistency product 25',
        'vente 75 consistency test 2',
      ];

      for (const operation of operations) {
        const payload = TwilioWebhookMock.businessCommand(operation, {
          From: `whatsapp:+1234567890`,
        });

        await request(app.getHttpServer())
          .post('/whatsapp/twilio/webhook')
          .send(TwilioWebhookMock.toUrlEncoded(payload))
          .set('Content-Type', 'application/x-www-form-urlencoded')
          .expect(200);
      }

      // Verify data consistency
      const finalTransactionCount = await transactionRepository.count();
      const finalStockCount = await stockRepository.count();

      expect(finalTransactionCount).toBeGreaterThan(initialTransactionCount);
      expect(finalStockCount).toBeGreaterThanOrEqual(initialStockCount);

      // Verify specific data integrity
      const transactions = await transactionRepository.find({
        where: { description: 'consistency test 1' },
      });
      expect(transactions.length).toBe(1);
      expect(transactions[0].amount).toBe(100);
    });
  });
});