-- CreateTable
CREATE TABLE "chapters" (
    "id" TEXT NOT NULL,
    "book_id" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "synopsis" TEXT,
    "notes" TEXT,
    "text_a_label" TEXT NOT NULL DEFAULT 'Borrador',
    "text_b_label" TEXT NOT NULL DEFAULT 'Reescritura',
    "text_a" TEXT,
    "text_b" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "chapters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chapter_characters" (
    "id" TEXT NOT NULL,
    "chapter_id" TEXT NOT NULL,
    "character_id" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "action" TEXT,

    CONSTRAINT "chapter_characters_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "chapters_book_id_position_idx" ON "chapters"("book_id", "position");

-- CreateIndex
CREATE INDEX "chapter_characters_chapter_id_position_idx" ON "chapter_characters"("chapter_id", "position");

-- CreateIndex
CREATE UNIQUE INDEX "chapter_characters_chapter_id_character_id_key" ON "chapter_characters"("chapter_id", "character_id");

-- AddForeignKey
ALTER TABLE "chapters" ADD CONSTRAINT "chapters_book_id_fkey" FOREIGN KEY ("book_id") REFERENCES "books"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chapter_characters" ADD CONSTRAINT "chapter_characters_chapter_id_fkey" FOREIGN KEY ("chapter_id") REFERENCES "chapters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chapter_characters" ADD CONSTRAINT "chapter_characters_character_id_fkey" FOREIGN KEY ("character_id") REFERENCES "characters"("id") ON DELETE CASCADE ON UPDATE CASCADE;
