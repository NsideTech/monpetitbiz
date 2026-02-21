import {
  Controller,
  Get,
  Patch,
  Delete,
  Post,
  Param,
  Query,
  Body,
  UseGuards,
  ParseUUIDPipe,
  ParseIntPipe,
  DefaultValuePipe,
} from '@nestjs/common';
import { ServiceTokenGuard } from './guards/service-token.guard';
import { AdminBusinessService } from './admin-business.service';

@Controller('admin/businesses')
@UseGuards(ServiceTokenGuard)
export class AdminBusinessController {
  constructor(private readonly adminBusinessService: AdminBusinessService) {}

  /**
   * Get paginated list of businesses
   */
  @Get()
  async getBusinesses(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
    @Query('search') search?: string,
  ) {
    return await this.adminBusinessService.getBusinessesPaginated(page, limit, search);
  }

  /**
   * Get all products for a business
   * IMPORTANT: This route must be defined before @Get(':id') to avoid route conflicts
   */
  @Get(':id/products')
  async getBusinessProducts(@Param('id', ParseUUIDPipe) id: string) {
    console.log(`[AdminBusinessController] Getting products for business: ${id}`);
    const products = await this.adminBusinessService.getBusinessProducts(id);
    console.log(`[AdminBusinessController] Found ${products.length} products`);
    return products;
  }

  /**
   * Create multiple products for a business in bulk
   * Products with existing names are skipped (no error)
   * Must be defined before @Post(':id/products') to avoid route conflicts
   */
  @Post(':id/products/bulk-create')
  async bulkCreateProducts(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('products') products: Array<{ name: string; quantity: number; unitPrice?: number }>,
  ) {
    if (!products || !Array.isArray(products)) {
      return {
        success: false,
        message: 'Products array is required',
        created: 0,
        skipped: 0,
        errors: ['Products must be an array'],
      };
    }

    const result = await this.adminBusinessService.bulkCreateProducts(id, products);
    return {
      success: true,
      ...result,
    };
  }

  /**
   * Create a single product for a business
   */
  @Post(':id/products')
  async createProduct(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() productData: { name: string; quantity: number; unitPrice?: number },
  ) {
    return await this.adminBusinessService.createProduct(id, productData);
  }

  /**
   * Update a product for a business
   */
  @Patch(':id/products/:productId')
  async updateProduct(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('productId', ParseUUIDPipe) productId: string,
    @Body() productData: { name?: string; quantity?: number; unitPrice?: number },
  ) {
    return await this.adminBusinessService.updateProduct(id, productId, productData);
  }

  /**
   * Delete a product for a business
   */
  @Delete(':id/products/:productId')
  async deleteProduct(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('productId', ParseUUIDPipe) productId: string,
  ) {
    const result = await this.adminBusinessService.deleteProduct(id, productId);
    return { success: result.success, message: result.message };
  }

  /**
   * Block or unblock a business
   */
  @Patch(':id/block')
  async blockBusiness(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('isActive') isActive: boolean,
  ) {
    return await this.adminBusinessService.blockBusiness(id, isActive);
  }

  /**
   * Block or unblock all users of a business
   */
  @Patch(':id/block-users')
  async blockBusinessUsers(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('isActive') isActive: boolean,
  ) {
    await this.adminBusinessService.blockBusinessUsers(id, isActive);
    return { success: true, message: 'Users blocked/unblocked successfully' };
  }

  /**
   * Get business details with owner information and statistics
   */
  @Get(':id')
  async getBusinessDetails(@Param('id', ParseUUIDPipe) id: string) {
    return await this.adminBusinessService.getBusinessDetails(id);
  }

  /**
   * Soft delete a business
   */
  @Delete(':id')
  async deleteBusiness(@Param('id', ParseUUIDPipe) id: string) {
    await this.adminBusinessService.deleteBusiness(id);
    return { success: true, message: 'Business deleted successfully' };
  }
}

