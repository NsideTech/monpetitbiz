import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddBusinessCodeToBusiness1729225200000 implements MigrationInterface {
    name = 'AddBusinessCodeToBusiness1729225200000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Check if the businessCode column already exists
        const table = await queryRunner.getTable('businesses');
        const businessCodeColumn = table?.findColumnByName('businessCode');
        
        if (!businessCodeColumn) {
            // Add the businessCode column as nullable first
            await queryRunner.addColumn('businesses', new TableColumn({
                name: 'businessCode',
                type: 'varchar',
                length: '6',
                isNullable: true,
                isUnique: false, // We'll add unique constraint after populating data
            }));

            // Generate business codes for existing businesses
            const businesses = await queryRunner.query('SELECT id FROM businesses WHERE "businessCode" IS NULL');
            
            for (const business of businesses) {
                let businessCode: string;
                let isUnique = false;
                let attempts = 0;
                const maxAttempts = 100;

                // Generate unique business code
                while (!isUnique && attempts < maxAttempts) {
                    businessCode = this.generateBusinessCode();
                    
                    // Check if code already exists
                    const existing = await queryRunner.query(
                        'SELECT id FROM businesses WHERE "businessCode" = $1',
                        [businessCode]
                    );
                    
                    if (existing.length === 0) {
                        isUnique = true;
                    }
                    attempts++;
                }

                if (!isUnique) {
                    throw new Error(`Failed to generate unique business code after ${maxAttempts} attempts`);
                }

                // Update the business with the generated code
                await queryRunner.query(
                    'UPDATE businesses SET "businessCode" = $1 WHERE id = $2',
                    [businessCode, business.id]
                );
            }

            // Now make the column NOT NULL and add unique constraint
            await queryRunner.changeColumn('businesses', 'businessCode', new TableColumn({
                name: 'businessCode',
                type: 'varchar',
                length: '6',
                isNullable: false,
                isUnique: true,
            }));
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Check if the businessCode column exists before trying to drop it
        const table = await queryRunner.getTable('businesses');
        const businessCodeColumn = table?.findColumnByName('businessCode');
        
        if (businessCodeColumn) {
            await queryRunner.dropColumn('businesses', 'businessCode');
        }
    }

    private generateBusinessCode(): string {
        // Generate 6-character code using A-Z and 2-9 (excluding confusing characters)
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ23456789';
        let result = '';
        for (let i = 0; i < 6; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    }
}