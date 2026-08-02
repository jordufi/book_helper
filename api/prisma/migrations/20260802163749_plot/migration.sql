-- CreateTable
CREATE TABLE "plot_events" (
    "id" TEXT NOT NULL,
    "book_id" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "plot_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plot_promises" (
    "id" TEXT NOT NULL,
    "book_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "setup_event_id" TEXT NOT NULL,
    "payoff_event_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "plot_promises_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "plot_events_book_id_position_idx" ON "plot_events"("book_id", "position");

-- CreateIndex
CREATE INDEX "plot_promises_book_id_idx" ON "plot_promises"("book_id");

-- CreateIndex
CREATE INDEX "plot_promises_setup_event_id_idx" ON "plot_promises"("setup_event_id");

-- CreateIndex
CREATE INDEX "plot_promises_payoff_event_id_idx" ON "plot_promises"("payoff_event_id");

-- AddForeignKey
ALTER TABLE "plot_events" ADD CONSTRAINT "plot_events_book_id_fkey" FOREIGN KEY ("book_id") REFERENCES "books"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plot_promises" ADD CONSTRAINT "plot_promises_book_id_fkey" FOREIGN KEY ("book_id") REFERENCES "books"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plot_promises" ADD CONSTRAINT "plot_promises_setup_event_id_fkey" FOREIGN KEY ("setup_event_id") REFERENCES "plot_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plot_promises" ADD CONSTRAINT "plot_promises_payoff_event_id_fkey" FOREIGN KEY ("payoff_event_id") REFERENCES "plot_events"("id") ON DELETE SET NULL ON UPDATE CASCADE;
