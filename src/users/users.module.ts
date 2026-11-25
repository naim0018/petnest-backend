import { Module } from '@nestjs/common';
import { MediaModule } from 'src/media/media.module';
import { NotificationsModule } from 'src/notifications/notifications.module';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  imports: [MediaModule, NotificationsModule],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
