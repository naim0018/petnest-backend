import { BadRequestException } from '@nestjs/common';
import sanitizeHtml from 'sanitize-html';

const ALLOWED_VIDEO_HOSTS = new Set([
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'youtu.be',
  'youtube-nocookie.com',
  'www.youtube-nocookie.com',
  'facebook.com',
  'www.facebook.com',
  'web.facebook.com',
  'fb.watch',
]);

const ALLOWED_IFRAME_HOSTNAMES = [
  'www.youtube.com',
  'youtube.com',
  'www.youtube-nocookie.com',
  'www.facebook.com',
  'facebook.com',
  'web.facebook.com',
];

export function sanitizeGuideHtml(rawHtml: string): string {
  // Block raw base64 images inside HTML (regardless of attribute spacing/quotes) so DB never bloats
  if (/data:image\//i.test(rawHtml)) {
    throw new BadRequestException(
      'Base64 inline images are not allowed. Upload images via POST /media/upload first.',
    );
  }

  return sanitizeHtml(rawHtml, {
    allowedTags: [
      'p',
      'br',
      'h1',
      'h2',
      'h3',
      'h4',
      'strong',
      'b',
      'em',
      'i',
      'u',
      's',
      'blockquote',
      'ul',
      'ol',
      'li',
      'a',
      'img',
      'figure',
      'figcaption',
      'table',
      'thead',
      'tbody',
      'tr',
      'th',
      'td',
      'code',
      'pre',
      'div',
      'span',
      'hr',
      'iframe',
    ],
    allowedAttributes: {
      a: ['href', 'name', 'target', 'rel'],
      img: ['src', 'alt', 'title', 'width', 'height', 'loading', 'data-media-id'],
      iframe: [
        'src',
        'width',
        'height',
        'title',
        'frameborder',
        'allow',
        'allowfullscreen',
      ],
      div: ['class', 'data-video-embed', 'data-callout-type'],
      span: ['class'],
      p: ['class'],
      th: ['colspan', 'rowspan'],
      td: ['colspan', 'rowspan'],
    },
    allowedSchemes: ['http', 'https'],
    allowedSchemesByTag: {
      a: ['http', 'https', 'mailto'],
      img: ['http', 'https'],
      iframe: ['https'],
    },
    allowProtocolRelative: false,
    allowedIframeHostnames: ALLOWED_IFRAME_HOSTNAMES,
    transformTags: {
      a: sanitizeHtml.simpleTransform('a', {
        rel: 'noopener noreferrer',
      }),
      img: (tagName, attribs) => ({
        tagName,
        attribs: {
          ...attribs,
          loading: attribs.loading || 'lazy',
        },
      }),
    },
  });
}

export function calculateReadTimeMinutes(html: string): number {
  const plainText = html
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!plainText) return 1;

  const wordCount = plainText.split(' ').length;
  return Math.max(1, Math.ceil(wordCount / 200));
}

export function validateExternalVideoUrl(videoUrl?: string | null): string | null {
  if (!videoUrl || videoUrl.trim() === '') return null;

  let parsed: URL;
  try {
    parsed = new URL(videoUrl.trim());
  } catch {
    throw new BadRequestException('Invalid videoUrl format');
  }

  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new BadRequestException('videoUrl must use http or https');
  }

  if (!ALLOWED_VIDEO_HOSTS.has(parsed.hostname.toLowerCase())) {
    throw new BadRequestException(
      'Only YouTube and Facebook video URLs are currently supported',
    );
  }

  return parsed.toString();
}
