/**
 * Example usage of PhoneValidationService
 * This file demonstrates how to use the PhoneValidationService in the merchant onboarding system
 */

import { PhoneValidationService } from './phone-validation.service';

// Example usage in a service or controller
export class PhoneValidationExample {
  constructor(private readonly phoneValidationService: PhoneValidationService) {}

  /**
   * Example: Validate and extract country from WhatsApp phone number
   */
  async validateWhatsAppNumber(phoneNumber: string) {
    // Extract country information from WhatsApp phone number
    const countryInfo = await this.phoneValidationService.extractCountryFromWhatsApp(phoneNumber);
    
    if (!countryInfo.isValid) {
      throw new Error(`Invalid phone number format: ${phoneNumber}`);
    }

    console.log(`Phone number: ${countryInfo.formattedNumber}`);
    console.log(`Country: ${countryInfo.country} (${this.phoneValidationService.getCountryName(countryInfo.country)})`);
    
    return countryInfo;
  }

  /**
   * Example: Check if phone number already exists in system
   */
  async checkExistingUser(phoneNumber: string) {
    const status = await this.phoneValidationService.checkPhoneNumberStatus(phoneNumber);
    
    if (status.exists) {
      console.log(`Phone number ${phoneNumber} already exists as ${status.userType} in business: ${status.businessName}`);
      return {
        canCreateNewBusiness: status.userType === 'employee', // Employees can create new businesses
        existingUserType: status.userType,
        businessName: status.businessName,
      };
    } else {
      console.log(`Phone number ${phoneNumber} is available for new registration`);
      return {
        canCreateNewBusiness: true,
        existingUserType: null,
        businessName: null,
      };
    }
  }

  /**
   * Example: Complete validation flow for merchant onboarding
   */
  async validateForOnboarding(phoneNumber: string) {
    // Step 1: Validate phone number format
    const isValidFormat = this.phoneValidationService.validatePhoneNumberFormat(phoneNumber);
    if (!isValidFormat) {
      throw new Error(`Invalid phone number format: ${phoneNumber}. Please use E.164 format (e.g., +221701234567)`);
    }

    // Step 2: Extract country information
    const countryInfo = await this.phoneValidationService.extractCountryFromWhatsApp(phoneNumber);
    if (!countryInfo.isValid) {
      throw new Error(`Could not determine country for phone number: ${phoneNumber}`);
    }

    // Step 3: Check if user already exists
    const userStatus = await this.phoneValidationService.checkPhoneNumberStatus(phoneNumber);

    return {
      phoneNumber: countryInfo.formattedNumber,
      country: countryInfo.country,
      countryName: this.phoneValidationService.getCountryName(countryInfo.country),
      userExists: userStatus.exists,
      userType: userStatus.userType,
      businessName: userStatus.businessName,
      canCreateBusiness: !userStatus.exists || userStatus.userType === 'employee',
      conflictType: userStatus.exists ? (userStatus.userType === 'owner' ? 'owner_exists' : 'employee_exists') : null,
    };
  }

  /**
   * Example: Handle different validation scenarios
   */
  async handleValidationScenarios(phoneNumber: string) {
    try {
      const validation = await this.validateForOnboarding(phoneNumber);

      if (!validation.userExists) {
        // New user - can proceed with onboarding
        console.log(`✅ New user from ${validation.countryName} can create business`);
        return { action: 'proceed_onboarding', validation };
      }

      if (validation.userType === 'owner') {
        // Existing owner - cannot create new business
        console.log(`❌ User already owns business: ${validation.businessName}`);
        return { action: 'reject_existing_owner', validation };
      }

      if (validation.userType === 'employee') {
        // Existing employee - offer choice
        console.log(`⚠️ User is employee at ${validation.businessName}. Offer choice to create new business or stay.`);
        return { action: 'offer_choice_to_employee', validation };
      }

    } catch (error) {
      console.error(`❌ Validation failed: ${error.message}`);
      return { action: 'validation_error', error: error.message };
    }
  }
}

// Example test cases
export const EXAMPLE_PHONE_NUMBERS = {
  // Valid Burkina Faso numbers
  burkina_standard: '+226701234567',
  burkina_twilio: 'whatsapp:+221701234567',
  
  // Valid North American numbers
  canada_toronto: '+14161234567',
  canada_vancouver: '+16041234567',
  us_new_york: '+12125551234',
  
  // Valid other West African numbers
  mali: '+223701234567',
  guinea: '+224701234567',
  ivory_coast: '+225701234567',
  burkina_faso: '+226701234567',
  
  // Invalid numbers
  invalid_no_plus: '221701234567',
  invalid_too_short: '+221123',
  invalid_too_long: '+2217012345678901234',
  invalid_format: 'not-a-phone-number',
  empty: '',
};

// Example usage scenarios
export const USAGE_SCENARIOS = {
  new_merchant_burkina: {
    phoneNumber: '+226701234567',
    expectedCountry: 'BF',
    expectedAction: 'proceed_onboarding',
  },
  
  new_merchant_canada: {
    phoneNumber: '+14161234567',
    expectedCountry: 'CA',
    expectedAction: 'proceed_onboarding',
  },
  
  existing_owner: {
    phoneNumber: '+221701234568', // Assume this exists as owner
    expectedAction: 'reject_existing_owner',
  },
  
  existing_employee: {
    phoneNumber: '+221701234569', // Assume this exists as employee
    expectedAction: 'offer_choice_to_employee',
  },
  
  invalid_format: {
    phoneNumber: 'invalid-number',
    expectedAction: 'validation_error',
  },
};