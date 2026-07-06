import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * VAT returns, manual purchases, Form 41 returns, and withholding entries.
 */
export class TaxFilingTables1738000000000 implements MigrationInterface {
  name = 'TaxFilingTables1738000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE \`vat_returns\` (
        \`id\` char(36) NOT NULL,
        \`created_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`updated_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        \`deleted_at\` timestamp(6) NULL,
        \`companyId\` char(36) NOT NULL,
        \`year\` int NOT NULL,
        \`month\` int NOT NULL,
        \`status\` enum('draft','ready_to_file','filed') NOT NULL DEFAULT 'draft',
        \`outputVat\` decimal(18,2) NOT NULL DEFAULT 0,
        \`inputVat\` decimal(18,2) NOT NULL DEFAULT 0,
        \`netVat\` decimal(18,2) NOT NULL DEFAULT 0,
        \`salesTotal\` decimal(18,2) NOT NULL DEFAULT 0,
        \`filedAt\` timestamp NULL,
        PRIMARY KEY (\`id\`),
        UNIQUE INDEX \`IDX_vat_returns_company_period\` (\`companyId\`, \`year\`, \`month\`),
        CONSTRAINT \`FK_vat_returns_company\`
          FOREIGN KEY (\`companyId\`) REFERENCES \`companies\` (\`id\`) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await queryRunner.query(`
      CREATE TABLE \`vat_purchases_manual\` (
        \`id\` char(36) NOT NULL,
        \`created_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`updated_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        \`deleted_at\` timestamp(6) NULL,
        \`companyId\` char(36) NOT NULL,
        \`vatReturnId\` char(36) NOT NULL,
        \`supplierName\` varchar(255) NOT NULL,
        \`supplierTaxId\` varchar(32) NULL,
        \`invoiceNumber\` varchar(64) NULL,
        \`invoiceDate\` date NULL,
        \`netAmount\` decimal(18,2) NOT NULL DEFAULT 0,
        \`vatAmount\` decimal(18,2) NOT NULL DEFAULT 0,
        \`grossAmount\` decimal(18,2) NOT NULL DEFAULT 0,
        \`notes\` text NULL,
        PRIMARY KEY (\`id\`),
        INDEX \`IDX_vat_purchases_company_return\` (\`companyId\`, \`vatReturnId\`),
        CONSTRAINT \`FK_vat_purchases_return\`
          FOREIGN KEY (\`vatReturnId\`) REFERENCES \`vat_returns\` (\`id\`) ON DELETE CASCADE,
        CONSTRAINT \`FK_vat_purchases_company\`
          FOREIGN KEY (\`companyId\`) REFERENCES \`companies\` (\`id\`) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await queryRunner.query(`
      CREATE TABLE \`form41_returns\` (
        \`id\` char(36) NOT NULL,
        \`created_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`updated_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        \`deleted_at\` timestamp(6) NULL,
        \`companyId\` char(36) NOT NULL,
        \`year\` int NOT NULL,
        \`quarter\` varchar(2) NOT NULL,
        \`status\` enum('draft','ready_to_file','filed') NOT NULL DEFAULT 'draft',
        \`filedAt\` timestamp NULL,
        PRIMARY KEY (\`id\`),
        UNIQUE INDEX \`IDX_form41_returns_company_period\` (\`companyId\`, \`year\`, \`quarter\`),
        CONSTRAINT \`FK_form41_returns_company\`
          FOREIGN KEY (\`companyId\`) REFERENCES \`companies\` (\`id\`) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await queryRunner.query(`
      CREATE TABLE \`withholding_entries\` (
        \`id\` char(36) NOT NULL,
        \`created_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`updated_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        \`deleted_at\` timestamp(6) NULL,
        \`companyId\` char(36) NOT NULL,
        \`form41ReturnId\` char(36) NOT NULL,
        \`payeeName\` varchar(255) NOT NULL,
        \`payeeId\` varchar(32) NULL,
        \`paymentType\` varchar(64) NOT NULL,
        \`grossAmount\` decimal(18,2) NOT NULL,
        \`withholdingRate\` decimal(5,4) NOT NULL,
        \`withheldAmount\` decimal(18,2) NOT NULL,
        \`paymentDate\` date NULL,
        PRIMARY KEY (\`id\`),
        INDEX \`IDX_withholding_company_return\` (\`companyId\`, \`form41ReturnId\`),
        CONSTRAINT \`FK_withholding_form41\`
          FOREIGN KEY (\`form41ReturnId\`) REFERENCES \`form41_returns\` (\`id\`) ON DELETE CASCADE,
        CONSTRAINT \`FK_withholding_company\`
          FOREIGN KEY (\`companyId\`) REFERENCES \`companies\` (\`id\`) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS `withholding_entries`');
    await queryRunner.query('DROP TABLE IF EXISTS `form41_returns`');
    await queryRunner.query('DROP TABLE IF EXISTS `vat_purchases_manual`');
    await queryRunner.query('DROP TABLE IF EXISTS `vat_returns`');
  }
}
