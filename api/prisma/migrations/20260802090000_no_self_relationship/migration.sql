-- Un personaje no puede tener una relacion consigo mismo.
-- Prisma no expresa CHECK en el schema, asi que va como SQL suelto.
ALTER TABLE "character_relationships"
  ADD CONSTRAINT "character_relationships_no_self"
  CHECK ("character_id" <> "related_character_id");
