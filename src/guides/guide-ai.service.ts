import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import type { AuthenticatedUser } from 'src/common/guards/jwt-auth.guard';
import { PrismaService } from 'src/prisma/prisma.service';
import { SettingsService } from 'src/settings/settings.service';
import { GenerateGuideAiDto } from './dto/generate-guide-ai.dto';
import { GuideFaqsService } from './guide-faqs.service';
import { GuidesService } from './guides.service';

export interface GeneratedSection {
  heading: string;
  bodyHtml: string;
  imagePrompt: string;
}

export interface GeneratedFaq {
  question: string;
  answer: string;
}

export interface GeneratedGuideAiResult {
  title: string;
  summary: string;
  readTime: number;
  keyTakeaways: string[];
  tags: string[];
  heroImagePrompt: string;
  coverImage: string;
  content: string;
  sections: GeneratedSection[];
  faqs: GeneratedFaq[];
  savedGuideId: string | null;
  savedGuideSlug: string | null;
}

interface GeminiGuideResponse {
  title: string;
  summary: string;
  readTime: number;
  keyTakeaways?: string[];
  tags?: string[];
  heroImagePrompt?: string;
  sections: GeneratedSection[];
  faqs: GeneratedFaq[];
}

const GEMINI_MODELS = [
  'gemini-2.5-flash',
  'gemini-2.0-flash',
  'gemini-1.5-flash',
];

const GEMINI_RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    title: {
      type: 'STRING',
      description: 'Engaging veterinary-backed guide title',
    },
    summary: {
      type: 'STRING',
      description:
        '1-2 sentence meta executive summary of the guide for readers',
    },
    readTime: {
      type: 'INTEGER',
      description: 'Estimated reading time in minutes (typically 4-10)',
    },
    keyTakeaways: {
      type: 'ARRAY',
      items: { type: 'STRING' },
      description: '3 to 5 crucial bullet points for pet owners',
    },
    tags: {
      type: 'ARRAY',
      items: { type: 'STRING' },
      description:
        '4 to 6 lowercase pet care tags (e.g. nutrition, budgies, symptoms)',
    },
    heroImagePrompt: {
      type: 'STRING',
      description:
        'Descriptive prompt for generating a high-quality article hero photo',
    },
    sections: {
      type: 'ARRAY',
      description: '3 to 6 comprehensive article chapters',
      items: {
        type: 'OBJECT',
        properties: {
          heading: {
            type: 'STRING',
            description: 'Chapter heading without markdown hashes',
          },
          bodyHtml: {
            type: 'STRING',
            description:
              'Clean semantic HTML for this chapter containing <p>, <ul>, <li>, and optionally <blockquote>. No <h1> or <h2> tags.',
          },
          imagePrompt: {
            type: 'STRING',
            description:
              'Detailed visual prompt to illustrate the medical or behavioral concept of this section',
          },
        },
        required: ['heading', 'bodyHtml', 'imagePrompt'],
      },
    },
    faqs: {
      type: 'ARRAY',
      description: '4 to 5 frequently asked questions and answers',
      items: {
        type: 'OBJECT',
        properties: {
          question: {
            type: 'STRING',
            description: 'Common question asked by pet owners',
          },
          answer: {
            type: 'STRING',
            description:
              'Accurate, empathetic veterinary-backed answer of 2 to 4 sentences',
          },
        },
        required: ['question', 'answer'],
      },
    },
  },
  required: ['title', 'summary', 'readTime', 'sections', 'faqs'],
};

@Injectable()
export class GuideAiService {
  private readonly logger = new Logger(GuideAiService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly guidesService: GuidesService,
    private readonly faqsService: GuideFaqsService,
    private readonly settingsService: SettingsService,
  ) {}

  async generate(
    dto: GenerateGuideAiDto,
    requester: AuthenticatedUser,
  ): Promise<GeneratedGuideAiResult> {
    const apiKey = await this.settingsService.getResolvedGeminiKey();
    if (!apiKey) {
      throw new BadRequestException(
        'Gemini API key is not configured. Please add your GEMINI_API_KEY in Admin Settings or server environment variables.',
      );
    }

    // Resolve optional Category & Species names for contextual prompting
    let categoryName = 'General Care';
    if (dto.categoryId) {
      const category = await this.prisma.guideCategory.findUnique({
        where: { id: dto.categoryId },
        select: { name: true },
      });
      if (category) categoryName = category.name;
    }

    let speciesName = 'Pets';
    if (dto.speciesId) {
      const species = await this.prisma.petSpecies.findUnique({
        where: { id: dto.speciesId },
        select: { name: true },
      });
      if (species) speciesName = species.name;
    }

    const systemPrompt = `You are a licensed veterinary doctor (DVM) and professional pet care editorial director writing for PetNest, a trusted digital pet health portal.
Write an authoritative, empathetic, well-structured pet care guide based on the user's topic.
Ensure veterinary accuracy: provide actionable guidance, clear warning signs for when to see a veterinarian, and safe preventive habits.
Target topic: "${dto.topic}".
Category Pillar: "${categoryName}".
Target Species: "${speciesName}".
Ensure sections contain clean HTML (<p>, <ul>, <li>, <blockquote>) with zero raw markdown markers inside bodyHtml.`;

    const userPrompt = `Generate a complete, publishable pet care guide on the topic: "${dto.topic}".
Include:
1. Title: clear, engaging, SEO-friendly.
2. Summary: 1-2 sentence executive meta summary.
3. Read time in minutes.
4. 3-5 Key Takeaways.
5. 4-6 relevant lowercase tags.
6. A descriptive hero image prompt.
7. 3-5 comprehensive sections with headings, clean bodyHtml (<p>, <ul>, <li>, <blockquote>), and descriptive image prompts.
8. 4-5 frequently asked questions (FAQs) with veterinary answers.`;

    let generated: GeminiGuideResponse | null = null;
    let lastError: string | null = null;

    for (const model of GEMINI_MODELS) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [
              {
                role: 'user',
                parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }],
              },
            ],
            generationConfig: {
              responseMimeType: 'application/json',
              responseSchema: GEMINI_RESPONSE_SCHEMA,
              temperature: 0.7,
            },
          }),
        });

        if (!response.ok) {
          const errText = await response.text();
          this.logger.warn(
            `Gemini model ${model} failed (${response.status}): ${errText}`,
          );
          lastError = errText;
          // Try next fallback model if 404 (not found) or 400 model name issue
          if (response.status === 404 || response.status === 400) {
            continue;
          }
          break;
        }

        const data = await response.json();
        const candidate = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!candidate) {
          throw new Error('Gemini returned an empty candidate response.');
        }

        generated = JSON.parse(candidate) as GeminiGuideResponse;
        break;
      } catch (err: unknown) {
        lastError = err instanceof Error ? err.message : String(err);
        this.logger.warn(`Error invoking ${model}: ${lastError}`);
      }
    }

    if (!generated) {
      throw new InternalServerErrorException(
        `Failed to generate guide with Gemini API. Details: ${lastError || 'Unknown error'}`,
      );
    }

    // Assemble rich article content with headings, paragraphs, and visual figure placeholders
    const sectionBlocks = generated.sections.map((section) => {
      const heading = section.heading.replace(/^#+\s*/, '').trim();
      const safePrompt = (section.imagePrompt || '').replace(/"/g, '&quot;');
      const placeholderUrl = `https://placehold.co/1200x630/FFF5F5/FF6B6B?text=${encodeURIComponent(
        heading.slice(0, 36),
      )}`;

      return `<h2>${heading}</h2>\n${section.bodyHtml}\n\n<figure class="my-6 rounded-2xl overflow-hidden border border-border-peach bg-surface-muted/30 shadow-xs">\n  <img src="${placeholderUrl}" alt="${safePrompt}" class="w-full h-64 object-cover" />\n  <figcaption class="p-2.5 text-center text-xs font-medium text-ink-muted bg-card border-t border-border-peach">📷 Visual Reference: ${section.imagePrompt}</figcaption>\n</figure>`;
    });

    const assembledContent = sectionBlocks.join('\n\n');
    const heroCoverPlaceholder = `https://placehold.co/1200x630/FFF5F5/FF6B6B?text=${encodeURIComponent(
      generated.title.slice(0, 36),
    )}`;

    let savedGuideId: string | null = null;
    let savedGuideSlug: string | null = null;

    // Save directly to database if saveToDb is requested (default: true)
    if (dto.saveToDb !== false) {
      try {
        const createdGuide = await this.guidesService.create(
          {
            title: generated.title,
            excerpt: generated.summary,
            content: assembledContent,
            coverImage: heroCoverPlaceholder,
            coverImageAlt: generated.heroImagePrompt || generated.title,
            keyTakeaways: generated.keyTakeaways ?? [],
            tags: generated.tags ?? [],
            categoryId: dto.categoryId,
            speciesId: dto.speciesId,
            status: 'DRAFT',
          },
          requester,
        );

        savedGuideId = createdGuide.id;
        savedGuideSlug = createdGuide.slug;

        // Bulk-attach the generated FAQs
        if (generated.faqs && generated.faqs.length > 0) {
          await this.faqsService.createBulk(
            {
              guideId: createdGuide.id,
              faqs: generated.faqs.map((f, idx) => ({
                question: f.question,
                answer: f.answer,
                displayOrder: idx,
                isActive: true,
              })),
            },
            requester,
          );
        }
      } catch (err: unknown) {
        this.logger.error('Failed to auto-save AI guide to database', err);
        // Continue and return the populated content even if auto-save failed
      }
    }

    return {
      title: generated.title,
      summary: generated.summary,
      readTime: generated.readTime,
      keyTakeaways: generated.keyTakeaways ?? [],
      tags: generated.tags ?? [],
      heroImagePrompt: generated.heroImagePrompt ?? '',
      coverImage: heroCoverPlaceholder,
      content: assembledContent,
      sections: generated.sections,
      faqs: generated.faqs,
      savedGuideId,
      savedGuideSlug,
    };
  }
}
