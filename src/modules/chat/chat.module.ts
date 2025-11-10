import {Module} from '@nestjs/common';
import {TypeOrmModule} from '@nestjs/typeorm';
import {ChatController} from './chat.controller';
import {ChatService} from './chat.service';
import {ChatMessage} from './entities/chat-message.entity';
import {WhatsappModule} from '../whatsapp/whatsapp.module';
import {AuthModule} from '../auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([ChatMessage]),
    WhatsappModule,
    AuthModule,
  ],
  controllers: [ChatController],
  providers: [ChatService],
  exports: [ChatService],
})
export class ChatModule {}

