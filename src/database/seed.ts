import { config } from 'dotenv';
import { AppDataSource } from '../config/data-source';
import { DatabaseSeeder } from './seeders/database.seeder';

// Load environment variables
config();

async function runSeeder() {
  try {
    console.log('Initializing database connection...');
    await AppDataSource.initialize();
    
    console.log('Database connection established.');
    
    const seeder = new DatabaseSeeder(AppDataSource);
    await seeder.seed();
    
    console.log('Seeding completed successfully!');
  } catch (error) {
    console.error('Error during seeding:', error);
    process.exit(1);
  } finally {
    if (AppDataSource.isInitialized) {
      await AppDataSource.destroy();
      console.log('Database connection closed.');
    }
  }
}

runSeeder();