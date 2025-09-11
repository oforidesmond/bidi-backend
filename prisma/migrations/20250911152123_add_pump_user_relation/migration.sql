-- CreateTable
CREATE TABLE "_PumpAttendantAssignment" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL,

    CONSTRAINT "_PumpAttendantAssignment_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "_PumpAttendantAssignment_B_index" ON "_PumpAttendantAssignment"("B");

-- AddForeignKey
ALTER TABLE "_PumpAttendantAssignment" ADD CONSTRAINT "_PumpAttendantAssignment_A_fkey" FOREIGN KEY ("A") REFERENCES "Pump"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_PumpAttendantAssignment" ADD CONSTRAINT "_PumpAttendantAssignment_B_fkey" FOREIGN KEY ("B") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
