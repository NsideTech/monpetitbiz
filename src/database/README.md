# Database Setup

This directory contains the database configuration, entities, migrations, and seeders for the WhatsApp Bot MVP.

## Structure

```
src/database/
├── entities/           # Entity exports
├── seeders/           # Database seeders
├── seed.ts           # Seeder CLI script
└── README.md         # This file
```

## Entities

The following entities are defined:

- **Business**: Represents a business using the bot
- **User**: Represents users (owners/sellers) of businesses
- **Transaction**: Records sales and expenses
- **StockItem**: Tracks product inventory
- **OtpSession**: Manages OTP authentication sessions

## Database Commands

### Migrations

```bash
# Generate a new migration (after entity changes)
npm run migration:generate src/migrations/MigrationName

# Run pending migrations
npm run migration:run

# Revert the last migration
npm run migration:revert
```

### Seeding

```bash
# Seed the database with sample data
npm run seed
```

## Environment Variables

Make sure to set the following environment variables:

```env
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=password
DB_NAME=whatsapp_bot
NODE_ENV=development
```

## Sample Data

The seeder creates:

- 3 sample businesses (Boutique Fatou, Épicerie Mamadou, Pharmacie Aïcha)
- 4 sample users with different roles
- Stock items for each business
- 7 days of sample transactions

## Performance Indexes

The following indexes are created for optimal performance:

- `IDX_transactions_business_date`: For transaction queries by business and date
- `IDX_transactions_business_type`: For filtering transactions by type
- `IDX_stock_items_business`: For stock queries by business
- `IDX_users_phone_number`: Unique index for phone number lookups

## Relationships

- Business → Users (One-to-Many)
- Business → Transactions (One-to-Many)
- Business → StockItems (One-to-Many)
- User → Transactions (One-to-Many)