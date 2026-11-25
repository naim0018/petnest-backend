import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface SearchResultItem {
  id: string;
  title: string;
  slug: string;
  coverImage?: string | null;
  readTimeMinutes?: number;
  category?: { name: string; slug: string } | null;
  species?: { name: string; slug: string } | null;
}

export interface SearchBreedItem {
  id: string;
  name: string;
  slug: string;
  image?: string | null;
  species: { name: string; slug: string };
}

export interface SearchSpeciesItem {
  id: string;
  name: string;
  slug: string;
  image?: string | null;
  categoryIcon?: string | null;
}

export interface SearchAuthorItem {
  id: string;
  name: string;
  role: string;
  avatar?: string | null;
}

export interface UniversalSearchResult {
  guides: SearchResultItem[];
  breeds: SearchBreedItem[];
  species: SearchSpeciesItem[];
  authors: SearchAuthorItem[];
  totalMatches: number;
}

@Injectable()
export class SearchService {
  constructor(private readonly prisma: PrismaService) {}

  async search(query: string, limit = 5): Promise<UniversalSearchResult> {
    const trimmed = (query || '').trim();
    if (trimmed.length < 2) {
      return {
        guides: [],
        breeds: [],
        species: [],
        authors: [],
        totalMatches: 0,
      };
    }

    const safeLimit = Math.min(Math.max(1, Number(limit) || 5), 20);

    const [guides, breeds, species, users] = await Promise.all([
      // 1. Guides Search (Published only)
      this.prisma.guide.findMany({
        where: {
          status: 'PUBLISHED',
          OR: [
            { title: { contains: trimmed, mode: 'insensitive' } },
            { excerpt: { contains: trimmed, mode: 'insensitive' } },
            { tags: { has: trimmed.toLowerCase() } },
          ],
        },
        take: safeLimit,
        orderBy: [{ displayOrder: 'asc' }, { createdAt: 'desc' }],
        select: {
          id: true,
          title: true,
          slug: true,
          coverImage: true,
          readTimeMinutes: true,
          category: {
            select: { name: true, slug: true },
          },
          species: {
            select: { name: true, slug: true },
          },
        },
      }),

      // 2. Pet Breeds Search
      this.prisma.petBreed.findMany({
        where: {
          OR: [
            { name: { contains: trimmed, mode: 'insensitive' } },
            { tags: { has: trimmed.toLowerCase() } },
          ],
        },
        take: 4,
        orderBy: { name: 'asc' },
        select: {
          id: true,
          name: true,
          slug: true,
          image: true,
          species: {
            select: { name: true, slug: true },
          },
        },
      }),

      // 3. Pet Species Search
      this.prisma.petSpecies.findMany({
        where: {
          OR: [
            { name: { contains: trimmed, mode: 'insensitive' } },
            { slug: { contains: trimmed.toLowerCase(), mode: 'insensitive' } },
          ],
        },
        take: 3,
        orderBy: { name: 'asc' },
        select: {
          id: true,
          name: true,
          slug: true,
          image: true,
          categoryIcon: true,
        },
      }),

      // 4. Authors / Vets / Editorial Team Search
      this.prisma.user.findMany({
        where: {
          role: { in: ['AUTHOR', 'VET', 'ADMIN', 'SUPERADMIN'] },
          OR: [
            { name: { contains: trimmed, mode: 'insensitive' } },
            { email: { contains: trimmed, mode: 'insensitive' } },
          ],
        },
        take: 3,
        orderBy: { name: 'asc' },
        select: {
          id: true,
          name: true,
          role: true,
          profile: {
            select: { avatar: true },
          },
        },
      }),
    ]);

    const formattedAuthors: SearchAuthorItem[] = users.map((u) => ({
      id: u.id,
      name: u.name,
      role: u.role,
      avatar: u.profile?.avatar || null,
    }));

    const totalMatches =
      guides.length + breeds.length + species.length + formattedAuthors.length;

    return {
      guides,
      breeds,
      species,
      authors: formattedAuthors,
      totalMatches,
    };
  }
}
