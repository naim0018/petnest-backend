import { Args, Query, Resolver } from '@nestjs/graphql';
import { PetsService } from './pets.service';
import { PetSpeciesModel } from './models/species.model';
import { PetBreedModel } from './models/breed.model';

@Resolver(() => PetSpeciesModel)
export class PetsResolver {
  constructor(private readonly petsService: PetsService) {}

  // Query a single species by ID or Slug
  @Query(() => PetSpeciesModel, { name: 'species', nullable: true })
  async getSpecies(
    @Args('idOrSlug', { type: () => String }) idOrSlug: string,
  ) {
    return this.petsService.findOneSpecies(idOrSlug);
  }

  // Query a single breed by ID or Slug
  @Query(() => PetBreedModel, { name: 'breed', nullable: true })
  async getBreed(
    @Args('idOrSlug', { type: () => String }) idOrSlug: string,
  ) {
    return this.petsService.findOneBreed(idOrSlug);
  }
}