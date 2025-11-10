import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  Request,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {ApiTags, ApiOperation, ApiResponse, ApiBearerAuth} from '@nestjs/swagger';
import {JwtAuthGuard} from '../auth/guards/jwt-auth.guard';
import {BotController} from '../whatsapp/bot.controller';
import {ChatService} from './chat.service';

@ApiTags('Chat')
@Controller('chat')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ChatController {
  constructor(
    private readonly botController: BotController,
    private readonly chatService: ChatService,
  ) {}

  /**
   * Send message to bot
   * POST /chat/message
   */
  @Post('message')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Send message to bot',
    description: 'Sends a text message to the bot and receives a response',
  })
  @ApiResponse({
    status: 200,
    description: 'Message processed successfully',
    schema: {
      type: 'object',
      properties: {
        success: {type: 'boolean', example: true},
        response: {type: 'string', example: '✅ Vente enregistrée: pain - 1500 XOF'},
        messageId: {type: 'string', example: 'msg_123456'},
        timestamp: {type: 'string', format: 'date-time'},
      },
    },
  })
  @ApiResponse({status: 401, description: 'Unauthorized'})
  @ApiResponse({status: 400, description: 'Bad request'})
  async sendMessage(
    @Request() req: any,
    @Body() body: {message: string},
  ): Promise<{
    success: boolean;
    response: string;
    messageId: string;
    timestamp: string;
  }> {
    const user = req.user;
    const phoneNumber = user.phoneNumber;

    // Create a processed message for the bot
    const processedMessage = {
      from: phoneNumber,
      body: body.message,
      messageId: `mobile_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
    };

    // Process message via bot
    const botResponse = await this.botController.processMessage(processedMessage);

    // Save message to history
    await this.chatService.saveMessage({
      userId: user.id,
      businessId: user.businessId,
      message: body.message,
      response: botResponse.message,
      messageId: processedMessage.messageId,
      timestamp: new Date(),
    });

    return {
      success: botResponse.success,
      response: botResponse.message,
      messageId: processedMessage.messageId,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Get chat history
   * GET /chat/history
   */
  @Get('history')
  @ApiOperation({
    summary: 'Get chat history',
    description: 'Retrieves the chat history for the authenticated user',
  })
  @ApiResponse({
    status: 200,
    description: 'Chat history retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        messages: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: {type: 'string'},
              message: {type: 'string'},
              response: {type: 'string'},
              timestamp: {type: 'string', format: 'date-time'},
            },
          },
        },
        total: {type: 'number'},
      },
    },
  })
  async getHistory(
    @Request() req: any,
    @Query('limit') limit?: number,
  ): Promise<{
    messages: Array<{
      id: string;
      message: string;
      response: string;
      timestamp: string;
    }>;
    total: number;
  }> {
    const user = req.user;
    const history = await this.chatService.getHistory(user.id, limit);
    return history;
  }
}

