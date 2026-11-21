const { PrismaClient } = require('./generated/prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('DATABASE_URL is not set');
  process.exit(1);
}

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const initialSpeciesData = [
  {
    name: "Dogs (Canine)",
    slug: "dogs",
    scientificGroup: "Canis lupus familiaris",
    shortDescription: "Loyal companions known for high intelligence, protective instincts, and playful devotion.",
    image: "/CareGuideCard/dog-faq-mascot.png",
    categoryIcon: "/CareGuide/categories/dog.png",
    breeds: [
      { name: "Golden Retriever", slug: "golden-retriever", image: "/CareGuide/breeds/dogs/golden-retriever.jpg", originCountry: "Scotland, UK", size: "LARGE", temperament: "Friendly, Intelligent, Devoted", careLevel: "MODERATE" },
      { name: "French Bulldog", slug: "french-bulldog", image: "/CareGuide/breeds/dogs/french-bulldog.jpg", originCountry: "France / England", size: "SMALL", temperament: "Playful, Adaptable, Alert", careLevel: "MODERATE" },
      { name: "German Shepherd", slug: "german-shepherd", image: "/CareGuide/breeds/dogs/german-shepherd.jpg", originCountry: "Germany", size: "LARGE", temperament: "Confident, Courageous, Smart", careLevel: "HIGH" },
      { name: "Siberian Husky", slug: "siberian-husky", image: "/CareGuide/breeds/dogs/husky.jpg", originCountry: "Siberia, Russia", size: "LARGE", temperament: "Energetic, Outgoing, Gentle", careLevel: "HIGH" },
      { name: "Welsh Corgi", slug: "welsh-corgi", image: "/CareGuide/breeds/dogs/corgi.jpg", originCountry: "Wales, UK", size: "SMALL", temperament: "Affectionate, Alert, Smart", careLevel: "MODERATE" },
      { name: "Beagle", slug: "beagle", image: "/CareGuide/breeds/dogs/beagle.jpg", originCountry: "United Kingdom", size: "SMALL", temperament: "Curious, Merry, Friendly", careLevel: "MODERATE" },
      { name: "Pomeranian", slug: "pomeranian", image: "/CareGuide/breeds/dogs/pomeranian.jpg", originCountry: "Germany / Poland", size: "SMALL", temperament: "Lively, Bold, Inquisitive", careLevel: "MODERATE" },
      { name: "Labrador Retriever", slug: "labrador-retriever", image: "/CareGuide/breeds/dogs/labrador.jpg", originCountry: "Canada", size: "LARGE", temperament: "Active, Friendly, Gentle", careLevel: "MODERATE" },
      { name: "Poodle", slug: "poodle", image: "/CareGuide/breeds/dogs/poodle.jpg", originCountry: "Germany / France", size: "MEDIUM", temperament: "Intelligent, Active, Alert", careLevel: "MODERATE" },
      { name: "Rottweiler", slug: "rottweiler", image: "/CareGuide/breeds/dogs/rottweiler.jpg", originCountry: "Germany", size: "LARGE", temperament: "Loyal, Loving, Confident", careLevel: "MODERATE" },
    ],
  },
  {
    name: "Cats (Feline)",
    slug: "cats",
    scientificGroup: "Felis catus",
    shortDescription: "Independent, graceful companions with curious personalities and gentle purring affection.",
    image: "/CareGuideCard/cat-faq-mascot.png",
    categoryIcon: "/CareGuide/categories/cat.png",
    breeds: [
      { name: "Maine Coon", slug: "maine-coon", image: "/CareGuide/breeds/cats/maine-coon.jpg", originCountry: "United States (Maine)", size: "LARGE", temperament: "Gentle giant, playful, sociable", careLevel: "HIGH" },
      { name: "British Shorthair", slug: "british-shorthair", image: "/CareGuide/breeds/cats/british-shorthair.jpg", originCountry: "United Kingdom", size: "MEDIUM", temperament: "Calm, easygoing, quiet", careLevel: "LOW" },
      { name: "Persian", slug: "persian", image: "/CareGuide/breeds/cats/persian.jpg", originCountry: "Iran (Persia)", size: "MEDIUM", temperament: "Quiet, sweet, dociled", careLevel: "HIGH" },
      { name: "Bengal", slug: "bengal", image: "/CareGuide/breeds/cats/bengal.jpg", originCountry: "United States", size: "MEDIUM", temperament: "Active, energetic, curious", careLevel: "HIGH" },
      { name: "Ragdoll", slug: "ragdoll", image: "/CareGuide/breeds/cats/ragdoll.jpg", originCountry: "United States", size: "LARGE", temperament: "Placid, affectionate, gentle", careLevel: "MODERATE" },
      { name: "Scottish Fold", slug: "scottish-fold", image: "/CareGuide/breeds/cats/scottish-fold.jpg", originCountry: "Scotland", size: "MEDIUM", temperament: "Sweet, calm, attached", careLevel: "LOW" },
      { name: "Siamese", slug: "siamese", image: "/CareGuide/breeds/cats/siamese.jpg", originCountry: "Thailand", size: "MEDIUM", temperament: "Vocal, affectionate, playful", careLevel: "MODERATE" },
      { name: "Russian Blue", slug: "russian-blue", image: "/CareGuide/breeds/cats/russian-blue.jpg", originCountry: "Russia", size: "MEDIUM", temperament: "Gentle, quiet, intelligent", careLevel: "LOW" },
    ],
  },
  {
    name: "Birds (Avian)",
    slug: "birds",
    scientificGroup: "Aves domesticus",
    shortDescription: "Vibrant, vocal avian friends with intelligent problem-solving capabilities and social flair.",
    image: "/CareGuideCard/budgie-faq-mascot.png",
    categoryIcon: "/CareGuide/categories/bird.png",
    breeds: [
      { name: "Cockatiel", slug: "cockatiel", image: "/CareGuide/breeds/birds/cockatiel.jpg", originCountry: "Australia", size: "SMALL", temperament: "Vocal, affectionate, curious", careLevel: "MODERATE" },
      { name: "Budgerigar (Parakeet)", slug: "budgerigar-parakeet", image: "/CareGuide/breeds/birds/budgie.jpg", originCountry: "Australia", size: "SMALL", temperament: "Social, cheerful, chatty", careLevel: "LOW" },
      { name: "African Grey Parrot", slug: "african-grey-parrot", image: "/CareGuide/breeds/birds/african-grey.jpg", originCountry: "Central Africa", size: "MEDIUM", temperament: "Extremely intelligent, vocal", careLevel: "HIGH" },
      { name: "Lovebird", slug: "lovebird", image: "/CareGuide/breeds/birds/lovebird.jpg", originCountry: "Africa", size: "SMALL", temperament: "Loyal, spirited, playful", careLevel: "MODERATE" },
      { name: "Canary", slug: "canary", image: "/CareGuide/breeds/birds/canary.jpg", originCountry: "Canary Islands", size: "SMALL", temperament: "Independent, melodious", careLevel: "LOW" },
      { name: "Cockatoo", slug: "cockatoo", image: "/CareGuide/breeds/birds/cockatoo.jpg", originCountry: "Australia / Indonesia", size: "MEDIUM", temperament: "Affectionate, loud, intelligent", careLevel: "HIGH" },
      { name: "Green-Cheeked Conure", slug: "green-cheeked-conure", image: "https://images.unsplash.com/photo-1560813487-803cbe32d18b?auto=format&fit=crop&w=800&q=80", originCountry: "South America (Bolivia, Brazil)", size: "SMALL", temperament: "Playful, Affectionate, Quiet, Inquisitive, Gentle", careLevel: "MODERATE" },
      { name: "Sun Conure", slug: "sun-conure", image: "https://images.unsplash.com/photo-1552728089-57bdde30beb3?auto=format&fit=crop&w=800&q=80", originCountry: "South America (Guyana, Brazil)", size: "SMALL", temperament: "Loud, Vocal, Cuddly, Outgoing, Loyal, Spirited", careLevel: "MODERATE" },
      { name: "Blue-and-Gold Macaw", slug: "blue-and-gold-macaw", image: "https://images.unsplash.com/photo-1752631030404-448d6f3a5689?auto=format&fit=crop&w=800&q=80", originCountry: "South America (Amazon Basin)", size: "LARGE", temperament: "Extremely Intelligent, Social, Affectionate, Demanding, Boisterous", careLevel: "HIGH" },
      { name: "Zebra Finch", slug: "zebra-finch", image: "https://images.unsplash.com/photo-1596706788544-7f12e873b53c?auto=format&fit=crop&w=800&q=80", originCountry: "Australia", size: "SMALL", temperament: "Social, Active, Cheerful, Independent, Peaceful", careLevel: "LOW" },
      { name: "Gouldian Finch", slug: "gouldian-finch", image: "https://images.unsplash.com/photo-1549608276-5786777e6587?auto=format&fit=crop&w=800&q=80", originCountry: "Australia", size: "SMALL", temperament: "Quiet, Peaceful, Gentle, Delicate, Independent", careLevel: "LOW" },
      { name: "Quaker Parrot", slug: "quaker-parrot", image: "https://images.unsplash.com/photo-1520808663317-647b476a81b9?auto=format&fit=crop&w=800&q=80", originCountry: "South America (Argentina, Brazil)", size: "SMALL", temperament: "Curious, Confident, Comical, Vocal, Territorial", careLevel: "MODERATE" },
      { name: "Indian Ringneck Parakeet", slug: "indian-ringneck-parakeet", image: "https://images.unsplash.com/photo-1685790846266-d094716fd3c9?auto=format&fit=crop&w=800&q=80", originCountry: "India & Pakistan", size: "MEDIUM", temperament: "Clever, Independent, Docile, Clear Speaker, Observant", careLevel: "MODERATE" },
      { name: "Diamond Dove", slug: "diamond-dove", image: "https://images.unsplash.com/photo-1516600164266-f3b8166ae679?auto=format&fit=crop&w=800&q=80", originCountry: "Australia", size: "SMALL", temperament: "Gentle, Peaceful, Quiet, Calming, Docile", careLevel: "LOW" },
    ],
  },
  {
    name: "Fish & Aquatic",
    slug: "aquatic",
    scientificGroup: "Actinopterygii",
    shortDescription: "Tranquil underwater species that bring serene, colorful biodiversity to aquatic aquariums.",
    image: "/CareGuideCard/aquatic-faq-mascot.png",
    categoryIcon: "/CareGuide/categories/fish.png",
    breeds: [
      { name: "Freshwater Angelfish", slug: "freshwater-angelfish", image: "/CareGuide/breeds/aquatic/angelfish.jpg", originCountry: "Amazon Basin", size: "SMALL", temperament: "Peaceful, elegant", careLevel: "MODERATE" },
      { name: "Siamese Fighting Fish (Betta)", slug: "siamese-fighting-fish", image: "/CareGuide/breeds/aquatic/betta.jpg", originCountry: "Southeast Asia", size: "SMALL", temperament: "Territorial, colorful", careLevel: "LOW" },
      { name: "Fancy Goldfish", slug: "fancy-goldfish", image: "/CareGuide/breeds/aquatic/goldfish.jpg", originCountry: "East Asia", size: "SMALL", temperament: "Hardy, calm, active", careLevel: "LOW" },
      { name: "Fancy Guppies", slug: "fancy-guppies", image: "/CareGuide/breeds/aquatic/guppies.jpg", originCountry: "South America", size: "SMALL", temperament: "Peaceful, active schooling", careLevel: "LOW" },
      { name: "Clownfish", slug: "clownfish", image: "/CareGuide/breeds/aquatic/clownfish.jpg", originCountry: "Indo-Pacific", size: "SMALL", temperament: "Active, symbiotic reef dweller", careLevel: "MODERATE" },
    ],
  },
  {
    name: "Small Pets & Rodents",
    slug: "small-pets",
    scientificGroup: "Rodentia & Lagomorpha",
    shortDescription: "Cute, compact furry companions perfect for family households and cozy habitats.",
    image: "/CareGuideCard/hamster-faq-mascot.png",
    categoryIcon: "/CareGuide/categories/small-pets.png",
    breeds: [
      { name: "Holland Lop Rabbit", slug: "holland-lop-rabbit", image: "/CareGuide/breeds/small-pets/holland-lop.jpg", originCountry: "Netherlands", size: "SMALL", temperament: "Gentle, friendly, sweet", careLevel: "MODERATE" },
      { name: "Syrian Hamster", slug: "syrian-hamster", image: "/CareGuide/breeds/small-pets/syrian-hamster.jpg", originCountry: "Syria", size: "SMALL", temperament: "Solitary, nocturnal, clean", careLevel: "LOW" },
      { name: "Guinea Pig", slug: "guinea-pig", image: "/CareGuide/breeds/small-pets/guinea-pig.jpg", originCountry: "Andes, South America", size: "SMALL", temperament: "Vocal, sociable, gentle", careLevel: "MODERATE" },
      { name: "Chinchilla", slug: "chinchilla", image: "/CareGuide/breeds/small-pets/chinchilla.jpg", originCountry: "Andes Mountains", size: "SMALL", temperament: "Energetic, soft, agile", careLevel: "HIGH" },
      { name: "Ferret", slug: "ferret", image: "/CareGuide/breeds/small-pets/ferret.jpg", originCountry: "Europe", size: "SMALL", temperament: "Playful, inquisitive, mischievous", careLevel: "HIGH" },
    ],
  },
  {
    name: "Reptiles & Amphibians",
    slug: "reptiles",
    scientificGroup: "Reptilia",
    shortDescription: "Fascinating cold-blooded creatures featuring unique evolutionary adaptations and calm temperaments.",
    image: "/CareGuideCard/reptile-faq-mascot.png",
    categoryIcon: "/CareGuide/categories/reptile.png",
    breeds: [
      { name: "Central Bearded Dragon", slug: "central-bearded-dragon", image: "/CareGuide/breeds/reptiles/bearded-dragon.jpg", originCountry: "Australia", size: "MEDIUM", temperament: "Docile, curious, friendly", careLevel: "MODERATE" },
      { name: "Leopard Gecko", slug: "leopard-gecko", image: "/CareGuide/breeds/reptiles/leopard-gecko.jpg", originCountry: "Middle East", size: "SMALL", temperament: "Gentle, nocturnal, easygoing", careLevel: "LOW" },
      { name: "Veiled Chameleon", slug: "veiled-chameleon", image: "/CareGuide/breeds/reptiles/chameleon.jpg", originCountry: "Yemen / Saudi Arabia", size: "SMALL", temperament: "Quiet, solitary, observant", careLevel: "HIGH" },
      { name: "Box Turtle", slug: "box-turtle", image: "/CareGuide/breeds/reptiles/turtle.jpg", originCountry: "North America", size: "SMALL", temperament: "Calm, long-lived, gentle", careLevel: "MODERATE" },
    ],
  },
];

async function seed() {
  console.log("Seeding pet species and breeds...");
  for (const s of initialSpeciesData) {
    const { breeds, ...speciesData } = s;
    const species = await prisma.petSpecies.upsert({
      where: { slug: speciesData.slug },
      update: speciesData,
      create: speciesData,
    });
    console.log(`Upserted species: ${species.name} (${species.id})`);

    for (const b of breeds) {
      await prisma.petBreed.upsert({
        where: {
          name_speciesId: {
            name: b.name,
            speciesId: species.id,
          },
        },
        update: {
          ...b,
          speciesId: species.id,
        },
        create: {
          ...b,
          speciesId: species.id,
        },
      });
    }
    console.log(`  Seeded ${breeds.length} breeds for ${species.name}`);
  }
  console.log("Seeding complete!");
}

seed()
  .catch((e) => {
    console.error("Seed error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
