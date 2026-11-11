import { Module } from '@nestjs/common';
import { PetsController } from './pets.controller';
import { PetsService } from './pets.service';
import { PetsResolver } from './pets.resolver';

@Module({
  controllers: [PetsController],
  providers: [PetsService,PetsResolver],
  exports: [PetsService],
})
export class PetsModule {}
