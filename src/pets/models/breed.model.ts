import { Field, ID, ObjectType, registerEnumType } from '@nestjs/graphql';
import { PetSize, CareLevel } from 'prisma/generated/prisma/enums';
import { PetSpeciesModel } from './species.model';
 

// Register Prisma enums with GraphQL so queries can use them
registerEnumType(PetSize, { name: 'PetSize' });
registerEnumType(CareLevel, { name: 'CareLevel' });

@ObjectType('PetBreed')
export class PetBreedModel {
  @Field(() => ID)
  id: string;

  @Field()
  speciesId: string;

  @Field()
  name: string;

  @Field()
  slug: string;

  @Field({ nullable: true })
  originCountry?: string;

  @Field(() => PetSize, { nullable: true })
  size?: PetSize;

  @Field(() => CareLevel, { nullable: true })
  careLevel?: CareLevel;

  @Field({ nullable: true })
  temperament?: string;

  @Field({ nullable: true })
  image?: string;

  // Relation: parent species
  @Field(() => PetSpeciesModel, { nullable: true })
  species?: PetSpeciesModel;
}