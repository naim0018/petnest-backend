import { Module } from '@nestjs/common';
import { MediaModule } from 'src/media/media.module';
import { SettingsModule } from 'src/settings/settings.module';
import { GuideAiService } from './guide-ai.service';
import { GuideCategoriesService } from './guide-categories.service';
import { GuideFaqsService } from './guide-faqs.service';
import { GuidesController } from './guides.controller';
import { GuidesService } from './guides.service';

@Module({
  imports: [MediaModule, SettingsModule],
  controllers: [GuidesController],
  providers: [
    GuideAiService,
    GuideCategoriesService,
    GuideFaqsService,
    GuidesService,
  ],
  exports: [
    GuideAiService,
    GuideCategoriesService,
    GuideFaqsService,
    GuidesService,
  ],
})
export class GuidesModule {}
