export interface BulkImportFaqItem {
  question: string;
  answer: string;
  displayOrder?: number;
  isActive?: boolean;
}

export interface BulkImportSectionItem {
  heading: string;
  image?: string;
  imageCaption?: string;
  caption?: string;
  body: string;
}

export interface BulkImportGuideItem {
  id?: string;
  title: string;
  slug?: string;
  category?: string;
  categoryId?: string;
  species?: string;
  speciesId?: string;
  breeds?: string[];
  breedIds?: string[];
  summary?: string;
  excerpt?: string;
  keyTakeaways?: string[];
  type?: 'PILLAR' | 'ARTICLE' | 'CHECKLIST';
  heroImage?: string;
  coverImage?: string;
  coverImageAlt?: string;
  faqImage?: string;
  videoUrl?: string;
  readTime?: number;
  readTimeMinutes?: number;
  displayOrder?: number;
  order?: number;
  tags?: string[];
  status?: 'DRAFT' | 'IN_REVIEW' | 'PUBLISHED' | 'NEEDS_REVISION' | 'ARCHIVED';
  isFeatured?: boolean;
  metaTitle?: string;
  metaDescription?: string;

  // Content options: either sections[] or direct body/content (or both)
  sections?: BulkImportSectionItem[];
  body?: string;
  content?: string;

  // Full FAQ support
  faqs?: BulkImportFaqItem[];

  // Optional language tag / nested translations
  lang?: string;
  language?: string;
  translations?: Record<string, any>;
}

export interface BulkImportGuideResult {
  index: number;
  id?: string;
  title: string;
  slug?: string;
  status?: string;
  faqsCount: number;
  imagesLinked: number;
  hasTranslation?: boolean;
  success: boolean;
  error?: string;
}

export interface BulkImportZipResponse {
  success: boolean;
  message: string;
  totalProcessed: number;
  successCount: number;
  failureCount: number;
  uploadedImagesCount: number;
  results: BulkImportGuideResult[];
}
