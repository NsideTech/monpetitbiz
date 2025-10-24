import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, UserRole } from '../entities/user.entity';
import { Business } from '../entities/business.entity';

export interface PhoneValidationResult {
    country: string;
    formattedNumber: string;
    isValid: boolean;
}

export interface PhoneNumberStatus {
    exists: boolean;
    userType?: 'owner' | 'employee';
    businessName?: string;
    businessId?: string;
    userId?: string;
}

/**
 * Service for validating phone numbers and extracting country information
 * from WhatsApp messages in the merchant onboarding system
 */
@Injectable()
export class PhoneValidationService {
    private readonly logger = new Logger(PhoneValidationService.name);

    // Country code mapping for common West African countries and North America
    private readonly countryCodeMap = new Map<string, string>([
        ['1', 'CA'], // Canada (and US - will be handled by area code logic)
        ['221', 'SN'], // Senegal
        ['223', 'ML'], // Mali
        ['224', 'GN'], // Guinea
        ['225', 'CI'], // Côte d'Ivoire
        ['226', 'BF'], // Burkina Faso
        ['227', 'NE'], // Niger
        ['228', 'TG'], // Togo
        ['229', 'BJ'], // Benin
        ['230', 'MU'], // Mauritius
        ['231', 'LR'], // Liberia
        ['232', 'SL'], // Sierra Leone
        ['233', 'GH'], // Ghana
        ['234', 'NG'], // Nigeria
        ['235', 'TD'], // Chad
        ['236', 'CF'], // Central African Republic
        ['237', 'CM'], // Cameroon
        ['238', 'CV'], // Cape Verde
        ['239', 'ST'], // São Tomé and Príncipe
        ['240', 'GQ'], // Equatorial Guinea
        ['241', 'GA'], // Gabon
        ['242', 'CG'], // Republic of the Congo
        ['243', 'CD'], // Democratic Republic of the Congo
        ['244', 'AO'], // Angola
        ['245', 'GW'], // Guinea-Bissau
        ['246', 'IO'], // British Indian Ocean Territory
        ['247', 'AC'], // Ascension Island
        ['248', 'SC'], // Seychelles
        ['249', 'SD'], // Sudan
        ['250', 'RW'], // Rwanda
        ['251', 'ET'], // Ethiopia
        ['252', 'SO'], // Somalia
        ['253', 'DJ'], // Djibouti
        ['254', 'KE'], // Kenya
        ['255', 'TZ'], // Tanzania
        ['256', 'UG'], // Uganda
        ['257', 'BI'], // Burundi
        ['258', 'MZ'], // Mozambique
        ['260', 'ZM'], // Zambia
        ['261', 'MG'], // Madagascar
        ['262', 'RE'], // Réunion
        ['263', 'ZW'], // Zimbabwe
        ['264', 'NA'], // Namibia
        ['265', 'MW'], // Malawi
        ['266', 'LS'], // Lesotho
        ['267', 'BW'], // Botswana
        ['268', 'SZ'], // Eswatini
        ['269', 'KM'], // Comoros
        ['290', 'SH'], // Saint Helena
        ['291', 'ER'], // Eritrea
        ['297', 'AW'], // Aruba
        ['298', 'FO'], // Faroe Islands
        ['299', 'GL'], // Greenland
    ]);

    constructor(
        @InjectRepository(User)
        private readonly userRepository: Repository<User>,
        @InjectRepository(Business)
        private readonly businessRepository: Repository<Business>,
    ) { }

    /**
     * Extract country and format phone number from WhatsApp
     * Supports both Meta and Twilio WhatsApp formats
     */
    async extractCountryFromWhatsApp(phoneNumber: string): Promise<PhoneValidationResult> {
        try {
            // Clean and normalize the phone number
            const cleanedNumber = this.cleanPhoneNumber(phoneNumber);

            if (!cleanedNumber) {
                return {
                    country: '',
                    formattedNumber: '',
                    isValid: false,
                };
            }

            // Extract country code and determine country
            const countryInfo = this.extractCountryCode(cleanedNumber);

            if (!countryInfo.isValid) {
                this.logger.warn(`Could not extract valid country from phone number: ${phoneNumber}`);
                return {
                    country: '',
                    formattedNumber: cleanedNumber,
                    isValid: false,
                };
            }

            this.logger.debug(`Extracted country ${countryInfo.country} from phone number ${phoneNumber}`);

            return {
                country: countryInfo.country,
                formattedNumber: cleanedNumber,
                isValid: true,
            };
        } catch (error) {
            this.logger.error(`Error extracting country from phone number ${phoneNumber}:`, error);
            return {
                country: '',
                formattedNumber: '',
                isValid: false,
            };
        }
    }

    /**
     * Check if phone number already exists in the system and return status
     */
    async checkPhoneNumberStatus(phoneNumber: string): Promise<PhoneNumberStatus> {
        try {
            const cleanedNumber = this.cleanPhoneNumber(phoneNumber);

            if (!cleanedNumber) {
                return { exists: false };
            }

            // Find user with this phone number
            const user = await this.userRepository.findOne({
                where: { phoneNumber: cleanedNumber },
                relations: ['business'],
            });

            if (!user) {
                return { exists: false };
            }

            // Determine user type based on role
            const userType = user.role === UserRole.OWNER ? 'owner' : 'employee';

            this.logger.debug(`Phone number ${cleanedNumber} exists as ${userType} in business ${user.business?.name}`);

            return {
                exists: true,
                userType,
                businessName: user.business?.name,
                businessId: user.businessId,
                userId: user.id,
            };
        } catch (error) {
            this.logger.error(`Error checking phone number status for ${phoneNumber}:`, error);
            return { exists: false };
        }
    }

    /**
     * Validate phone number format
     * Supports E.164 format and common variations
     */
    validatePhoneNumberFormat(phoneNumber: string): boolean {
        try {
            if (!phoneNumber || typeof phoneNumber !== 'string') {
                return false;
            }

            let cleaned = phoneNumber.trim();

            // Handle Twilio WhatsApp format: whatsapp:+221701234567
            if (cleaned.startsWith('whatsapp:')) {
                cleaned = cleaned.replace('whatsapp:', '');
            }

            // Remove all non-digit characters except +
            cleaned = cleaned.replace(/[^\d+]/g, '');

            // Must start with + for valid E.164 format
            if (!cleaned.startsWith('+')) {
                return false;
            }

            // Validate length (E.164 allows 1-15 digits after +)
            const digitsOnly = cleaned.substring(1);
            if (digitsOnly.length < 10 || digitsOnly.length > 15) {
                return false;
            }

            // Check E.164 format: +[country_code][number]
            const e164Regex = /^\+\d{1,3}\d{4,14}$/;

            if (!e164Regex.test(cleaned)) {
                return false;
            }

            // Additional validation: check if country code is recognized
            const countryInfo = this.extractCountryCode(cleaned);

            return countryInfo.isValid;
        } catch (error) {
            this.logger.error(`Error validating phone number format for ${phoneNumber}:`, error);
            return false;
        }
    }

    /**
     * Clean and normalize phone number from various WhatsApp formats
     */
    private cleanPhoneNumber(phoneNumber: string): string {
        if (!phoneNumber || typeof phoneNumber !== 'string') {
            return '';
        }

        let cleaned = phoneNumber.trim();

        // Handle Twilio WhatsApp format: whatsapp:+221701234567
        if (cleaned.startsWith('whatsapp:')) {
            cleaned = cleaned.replace('whatsapp:', '');
        }

        // Remove all non-digit characters except +
        cleaned = cleaned.replace(/[^\d+]/g, '');

        // Ensure it starts with +
        if (!cleaned.startsWith('+')) {
            // If it doesn't start with +, try to add it
            if (cleaned.length >= 10) {
                cleaned = '+' + cleaned;
            } else {
                return '';
            }
        }

        // Validate length (E.164 allows 1-15 digits after +)
        const digitsOnly = cleaned.substring(1);
        if (digitsOnly.length < 10 || digitsOnly.length > 15) {
            return '';
        }

        return cleaned;
    }

    /**
     * Extract country code from phone number
     */
    private extractCountryCode(phoneNumber: string): { country: string; countryCode: string; isValid: boolean } {
        if (!phoneNumber.startsWith('+')) {
            return { country: '', countryCode: '', isValid: false };
        }

        const digitsOnly = phoneNumber.substring(1);

        // Special handling for North American Numbering Plan (country code 1)
        if (digitsOnly.startsWith('1') && digitsOnly.length === 11) {
            const areaCode = digitsOnly.substring(1, 4);
            // Canadian area codes (partial list - common ones)
            const canadianAreaCodes = [
                '204', '226', '236', '249', '250', '289', '306', '343', '365', '403', '416', '418', '431', '437',
                '438', '450', '506', '514', '519', '548', '579', '581', '587', '604', '613', '639', '647', '672',
                '705', '709', '742', '778', '780', '782', '807', '819', '825', '867', '873', '902', '905'
            ];
            
            if (canadianAreaCodes.includes(areaCode)) {
                return {
                    country: 'CA',
                    countryCode: '1',
                    isValid: true,
                };
            } else {
                // Default to US for other NANP numbers
                return {
                    country: 'US',
                    countryCode: '1',
                    isValid: true,
                };
            }
        }

        // Try to match other country codes (1-3 digits)
        for (let i = 1; i <= 3 && i <= digitsOnly.length; i++) {
            const potentialCode = digitsOnly.substring(0, i);
            const country = this.countryCodeMap.get(potentialCode);

            if (country && potentialCode !== '1') { // Skip country code 1 as it's handled above
                // Validate that remaining digits form a reasonable phone number
                const remainingDigits = digitsOnly.substring(i);
                if (remainingDigits.length >= 7 && remainingDigits.length <= 12) {
                    return {
                        country,
                        countryCode: potentialCode,
                        isValid: true,
                    };
                }
            }
        }

        // If no exact match found, try to infer from common patterns
        // For West African numbers, most are 3-digit country codes
        if (digitsOnly.length >= 10) {
            const potentialCode = digitsOnly.substring(0, 3);
            const country = this.countryCodeMap.get(potentialCode);

            if (country) {
                return {
                    country,
                    countryCode: potentialCode,
                    isValid: true,
                };
            }
        }

        // Default fallback for unrecognized numbers - assume Burkina for now
        // This can be configured based on business requirements
        this.logger.warn(`Could not determine country for phone number: ${phoneNumber}, defaulting to Burkina Faso`);
        return {
            country: 'BF',
            countryCode: '226',
            isValid: false, // Mark as invalid since we couldn't determine it properly
        };
    }

    /**
     * Get country name from country code
     */
    getCountryName(countryCode: string): string {
        const countryNames = new Map<string, string>([
            ['CA', 'Canada'],
            ['US', 'United States'],
            ['SN', 'Sénégal'],
            ['ML', 'Mali'],
            ['GN', 'Guinée'],
            ['CI', 'Côte d\'Ivoire'],
            ['BF', 'Burkina Faso'],
            ['NE', 'Niger'],
            ['TG', 'Togo'],
            ['BJ', 'Bénin'],
            ['GH', 'Ghana'],
            ['NG', 'Nigeria'],
            ['CM', 'Cameroun'],
            ['GA', 'Gabon'],
            ['CG', 'Congo'],
            ['CD', 'République Démocratique du Congo'],
            ['AO', 'Angola'],
            ['KE', 'Kenya'],
            ['TZ', 'Tanzanie'],
            ['UG', 'Ouganda'],
            ['RW', 'Rwanda'],
            ['ET', 'Éthiopie'],
            ['ZA', 'Afrique du Sud'],
            ['MA', 'Maroc'],
            ['DZ', 'Algérie'],
            ['TN', 'Tunisie'],
            ['EG', 'Égypte'],
        ]);

        return countryNames.get(countryCode) || countryCode;
    }

    /**
     * Check if a phone number belongs to a specific country
     */
    isFromCountry(phoneNumber: string, countryCode: string): boolean {
        try {
            const result = this.extractCountryCode(this.cleanPhoneNumber(phoneNumber));
            return result.isValid && result.country === countryCode;
        } catch (error) {
            this.logger.error(`Error checking if phone number ${phoneNumber} is from country ${countryCode}:`, error);
            return false;
        }
    }

    /**
     * Get statistics about phone numbers in the system by country
     */
    async getPhoneNumberStatsByCountry(): Promise<Record<string, { owners: number; employees: number; total: number }>> {
        try {
            const users = await this.userRepository.find({
                relations: ['business'],
            });

            const stats: Record<string, { owners: number; employees: number; total: number }> = {};

            for (const user of users) {
                const countryInfo = this.extractCountryCode(user.phoneNumber);
                const country = countryInfo.isValid ? countryInfo.country : 'UNKNOWN';

                if (!stats[country]) {
                    stats[country] = { owners: 0, employees: 0, total: 0 };
                }

                stats[country].total++;
                if (user.role === UserRole.OWNER) {
                    stats[country].owners++;
                } else {
                    stats[country].employees++;
                }
            }

            return stats;
        } catch (error) {
            this.logger.error('Error getting phone number statistics by country:', error);
            return {};
        }
    }
}