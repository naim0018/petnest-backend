import { Module } from '@nestjs/common';
import { MediaModule } from 'src/media/media.module';
import { SettingsModule } from 'src/settings/settings.module';
import { GuideAiService } from './guide-ai.service';
import { GuideCategoriesService } from './guide-categories.service';
import { GuideEditorialService } from './guide-editorial.service';
import { GuideEngagementService } from './guide-engagement.service';
import { GuideExplorerService } from './guide-explorer.service';
import { GuideFaqsService } from './guide-faqs.service';
import { GuidesController } from './guides.controller';
import { GuidesResolver } from './guides.resolver';
import { GuidesService } from './guides.service';

@Module({
  imports: [MediaModule, SettingsModule],
  controllers: [GuidesController],
  providers: [
    GuideAiService,
    GuideCategoriesService,
    GuideFaqsService,
    GuideExplorerService,
    GuideEditorialService,
    GuideEngagementService,
    GuidesService,
    GuidesResolver,
  ],
  exports: [
    GuideAiService,
    GuideCategoriesService,
    GuideFaqsService,
    GuideExplorerService,
    GuideEditorialService,
    GuideEngagementService,
    GuidesService,
    GuidesResolver,
  ],
})
export class GuidesModule {}
