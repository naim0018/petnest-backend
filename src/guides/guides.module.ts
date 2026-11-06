import { Module } from '@nestjs/common';
import { MediaModule } from 'src/media/media.module';
import { GuideCategoriesService } from './guide-categories.service';
import { GuideFaqsService } from './guide-faqs.service';
import { GuidesController } from './guides.controller';
import { GuidesService } from './guides.service';

@Module({
  imports: [MediaModule],
  controllers: [GuidesController],
  providers: [GuideCategoriesService, GuideFaqsService, GuidesService],
  exports: [GuideCategoriesService, GuideFaqsService, GuidesService],
})
export class GuidesModule {}
