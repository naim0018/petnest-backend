import { Field, ID, Int, ObjectType } from '@nestjs/graphql';
import { PetBreedModel } from './breed.model';

@ObjectType('SpeciesCount')
export class SpeciesCountModel {
  @Field(() => Int)
  breeds: number;
}

@ObjectType('PetSpecies')
export class PetSpeciesModel {
  @Field(() => ID)
  id: string;

  @Field()
  name: string;

  @Field()
  slug: string;

  @Field({ nullable: true })
  categoryIcon?: string;

  @Field({ nullable: true })
  image?: string;

  @Field({ nullable: true })
  scientificGroup?: string;

  @Field({ nullable: true })
  shortDescription?: string;

  // Relation: child breeds
  @Field(() => [PetBreedModel], { nullable: 'itemsAndList' })
  breeds?: PetBreedModel[];

  @Field(() => SpeciesCountModel, { nullable: true })
  _count?: SpeciesCountModel;
}