-- CreateEnum
CREATE TYPE "CharacterRole" AS ENUM ('PROTAGONIST', 'ANTAGONIST', 'SECONDARY', 'EXTRA');

-- CreateTable
CREATE TABLE "books" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "author" TEXT,
    "synopsis" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "books_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "characters" (
    "id" TEXT NOT NULL,
    "book_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "CharacterRole" NOT NULL DEFAULT 'SECONDARY',
    "age" TEXT,
    "photo_url" TEXT,
    "physical_description" TEXT,
    "personality" TEXT,
    "backstory" TEXT,
    "personal_plot" TEXT,
    "arc_summary" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "characters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "character_arc_stages" (
    "id" TEXT NOT NULL,
    "character_id" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,

    CONSTRAINT "character_arc_stages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "character_relationships" (
    "id" TEXT NOT NULL,
    "character_id" TEXT NOT NULL,
    "related_character_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "description" TEXT,

    CONSTRAINT "character_relationships_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "characters_book_id_idx" ON "characters"("book_id");

-- CreateIndex
CREATE INDEX "character_arc_stages_character_id_position_idx" ON "character_arc_stages"("character_id", "position");

-- CreateIndex
CREATE INDEX "character_relationships_character_id_idx" ON "character_relationships"("character_id");

-- CreateIndex
CREATE UNIQUE INDEX "character_relationships_character_id_related_character_id_t_key" ON "character_relationships"("character_id", "related_character_id", "type");

-- AddForeignKey
ALTER TABLE "characters" ADD CONSTRAINT "characters_book_id_fkey" FOREIGN KEY ("book_id") REFERENCES "books"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "character_arc_stages" ADD CONSTRAINT "character_arc_stages_character_id_fkey" FOREIGN KEY ("character_id") REFERENCES "characters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "character_relationships" ADD CONSTRAINT "character_relationships_character_id_fkey" FOREIGN KEY ("character_id") REFERENCES "characters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "character_relationships" ADD CONSTRAINT "character_relationships_related_character_id_fkey" FOREIGN KEY ("related_character_id") REFERENCES "characters"("id") ON DELETE CASCADE ON UPDATE CASCADE;
