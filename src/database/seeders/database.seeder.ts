import { DataSource } from 'typeorm';
import { Business } from '../../modules/auth/entities/business.entity';
import { User, UserRole } from '../../modules/auth/entities/user.entity';
import { Transaction, TransactionType } from '../../modules/transaction/entities/transaction.entity';
import { StockItem } from '../../modules/stock/entities/stock-item.entity';

export class DatabaseSeeder {
  constructor(private dataSource: DataSource) {}

  async seed(): Promise<void> {
    console.log('Starting database seeding...');

    // Create sample businesses
    const businesses = await this.seedBusinesses();
    
    // Create sample users
    const users = await this.seedUsers(businesses);
    
    // Create sample stock items
    await this.seedStockItems(businesses);
    
    // Create sample transactions
    await this.seedTransactions(businesses, users);

    console.log('Database seeding completed successfully!');
  }

  private async seedBusinesses(): Promise<Business[]> {
    const businessRepository = this.dataSource.getRepository(Business);
    
    const businessesData = [
      {
        name: 'Boutique Fatou',
        currency: 'XOF',
        timezone: 'Africa/Dakar'
      },
      {
        name: 'Épicerie Mamadou',
        currency: 'XOF',
        timezone: 'Africa/Abidjan'
      },
      {
        name: 'Pharmacie Aïcha',
        currency: 'XOF',
        timezone: 'Africa/Bamako'
      }
    ];

    const businesses: Business[] = [];
    for (const businessData of businessesData) {
      const existingBusiness = await businessRepository.findOne({
        where: { name: businessData.name }
      });

      if (!existingBusiness) {
        const business = businessRepository.create(businessData);
        const savedBusiness = await businessRepository.save(business);
        businesses.push(savedBusiness);
        console.log(`Created business: ${businessData.name}`);
      } else {
        businesses.push(existingBusiness);
        console.log(`Business already exists: ${businessData.name}`);
      }
    }

    return businesses;
  }

  private async seedUsers(businesses: Business[]): Promise<User[]> {
    const userRepository = this.dataSource.getRepository(User);
    
    const usersData = [
      {
        phoneNumber: '+226701234567',
        businessId: businesses[0].id,
        role: UserRole.OWNER,
        language: 'fr'
      },
      {
        phoneNumber: '+226701234568',
        businessId: businesses[0].id,
        role: UserRole.SELLER,
        language: 'fr'
      },
      {
        phoneNumber: '+225701234567',
        businessId: businesses[1].id,
        role: UserRole.OWNER,
        language: 'fr'
      },
      {
        phoneNumber: '+223701234567',
        businessId: businesses[2].id,
        role: UserRole.OWNER,
        language: 'fr'
      }
    ];

    const users: User[] = [];
    for (const userData of usersData) {
      const existingUser = await userRepository.findOne({
        where: { phoneNumber: userData.phoneNumber }
      });

      if (!existingUser) {
        const user = userRepository.create(userData);
        const savedUser = await userRepository.save(user);
        users.push(savedUser);
        console.log(`Created user: ${userData.phoneNumber}`);
      } else {
        users.push(existingUser);
        console.log(`User already exists: ${userData.phoneNumber}`);
      }
    }

    return users;
  }

  private async seedStockItems(businesses: Business[]): Promise<void> {
    const stockRepository = this.dataSource.getRepository(StockItem);
    
    const stockData = [
      // Boutique Fatou
      { businessId: businesses[0].id, product: 'Pain', quantity: 50 },
      { businessId: businesses[0].id, product: 'Lait', quantity: 25 },
      { businessId: businesses[0].id, product: 'Sucre', quantity: 10 },
      { businessId: businesses[0].id, product: 'Riz', quantity: 100 },
      
      // Épicerie Mamadou
      { businessId: businesses[1].id, product: 'Tomate', quantity: 30 },
      { businessId: businesses[1].id, product: 'Oignon', quantity: 40 },
      { businessId: businesses[1].id, product: 'Huile', quantity: 15 },
      
      // Pharmacie Aïcha
      { businessId: businesses[2].id, product: 'Paracétamol', quantity: 200 },
      { businessId: businesses[2].id, product: 'Aspirine', quantity: 150 },
      { businessId: businesses[2].id, product: 'Vitamines', quantity: 80 }
    ];

    for (const stockItemData of stockData) {
      const existingStock = await stockRepository.findOne({
        where: { 
          businessId: stockItemData.businessId, 
          product: stockItemData.product 
        }
      });

      if (!existingStock) {
        const stockItem = stockRepository.create(stockItemData);
        await stockRepository.save(stockItem);
        console.log(`Created stock item: ${stockItemData.product} for business ${stockItemData.businessId}`);
      } else {
        console.log(`Stock item already exists: ${stockItemData.product}`);
      }
    }
  }

  private async seedTransactions(businesses: Business[], users: User[]): Promise<void> {
    const transactionRepository = this.dataSource.getRepository(Transaction);
    
    // Create transactions for the last 7 days
    const now = new Date();
    const transactionsData = [];

    for (let i = 0; i < 7; i++) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);

      // Sales for Boutique Fatou
      transactionsData.push(
        {
          businessId: businesses[0].id,
          userId: users[0].id,
          type: TransactionType.SALE,
          amount: 2500,
          product: 'Pain',
          description: 'Vente de pain',
          createdAt: date
        },
        {
          businessId: businesses[0].id,
          userId: users[1].id,
          type: TransactionType.SALE,
          amount: 1500,
          product: 'Lait',
          description: 'Vente de lait',
          createdAt: date
        },
        {
          businessId: businesses[0].id,
          userId: users[0].id,
          type: TransactionType.EXPENSE,
          amount: 15000,
          description: 'Achat marchandise',
          createdAt: date
        }
      );

      // Sales for Épicerie Mamadou
      transactionsData.push(
        {
          businessId: businesses[1].id,
          userId: users[2].id,
          type: TransactionType.SALE,
          amount: 3000,
          product: 'Tomate',
          description: 'Vente de tomates',
          createdAt: date
        },
        {
          businessId: businesses[1].id,
          userId: users[2].id,
          type: TransactionType.EXPENSE,
          amount: 8000,
          description: 'Transport marchandise',
          createdAt: date
        }
      );
    }

    for (const transactionData of transactionsData) {
      const transaction = transactionRepository.create(transactionData);
      await transactionRepository.save(transaction);
    }

    console.log(`Created ${transactionsData.length} sample transactions`);
  }
}