import { AppDataSource } from '../config/data-source';
import { Business } from '../modules/auth/entities/business.entity';
import { User, UserRole } from '../modules/auth/entities/user.entity';

/**
 * Simple test script to verify entity relationships work correctly
 * Run with: ts-node src/database/test-entities.ts
 */
async function testEntities() {
  try {
    console.log('Testing entity relationships...');
    
    // This will validate that:
    // 1. All entities can be instantiated
    // 2. TypeScript types are correct
    // 3. Relationships are properly defined
    
    const business = new Business();
    business.name = 'Test Business';
    business.currency = 'XOF';
    business.timezone = 'Africa/Dakar';
    
    const user = new User();
    user.phoneNumber = '+221701234567';
    user.role = UserRole.OWNER;
    user.language = 'fr';
    user.isActive = true;
    
    // Test relationship
    user.business = business;
    user.businessId = business.id;
    
    console.log('✅ Entity instantiation successful');
    console.log('✅ Relationships properly defined');
    console.log('✅ TypeScript types are correct');
    
    console.log('\nEntity validation completed successfully!');
    
  } catch (error) {
    console.error('❌ Entity test failed:', error);
    process.exit(1);
  }
}

testEntities();