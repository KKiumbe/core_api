const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const PDFDocument = require("pdfkit");
const { generatePDFHeader } = require("../header.js");

async function getGarbageCollectionDaySummaryReport(req, res) {
  let doc;
  try {
    const customers = await prisma.customer.findMany({
      where: { status: "ACTIVE" },
      select: {
        garbageCollectionDay: true,
        garbageCollectionHistory: {
          select: { collected: true },
        },
      },
    });

    if (!customers.length) {
      return res.status(404).json({ message: "No active customers with garbage collection history found." });
    }

    const daySummary = {
      MONDAY: { total: 0, collected: 0 },
      TUESDAY: { total: 0, collected: 0 },
      WEDNESDAY: { total: 0, collected: 0 },
      THURSDAY: { total: 0, collected: 0 },
      FRIDAY: { total: 0, collected: 0 },
      SATURDAY: { total: 0, collected: 0 },
      SUNDAY: { total: 0, collected: 0 },
    };

    // Valid days for validation
    const validDays = Object.keys(daySummary);

    customers.forEach(customer => {
      let day = customer.garbageCollectionDay;
      
      // Log the raw day value for debugging
      if (!day) {
        console.log('Customer with missing garbageCollectionDay:', customer);
        return; // Skip this customer
      }

      // Normalize the day by removing trailing 'y' and converting to uppercase
      day = day.replace(/y$/i, '').toUpperCase();

      // Check if the normalized day is valid
      if (!validDays.includes(day)) {
        console.log(`Invalid garbageCollectionDay found: ${day} (original: ${customer.garbageCollectionDay})`);
        return; // Skip this customer
      }

      daySummary[day].total += customer.garbageCollectionHistory.length;
      daySummary[day].collected += customer.garbageCollectionHistory.filter(h => h.collected).length;
    });

    doc = new PDFDocument({ size: 'A4', margin: 40 });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="garbage_collection_day_summary_report.pdf"');
    doc.pipe(res);

    await generatePDFHeader(doc);

    doc.fontSize(14)
       .font('Helvetica-Bold')
       .text('Garbage Collection Day Summary Report', { align: 'center' })
       .moveDown(1);

    const startX = 40;
    let currentY = doc.y + 20;
    const columnWidths = [100, 80, 80, 80];
    const headers = ['Day', 'Total Collections', 'Collected', 'Not Collected'];

    const drawTableHeaders = async () => {
      doc.fontSize(10)
         .font('Helvetica-Bold')
         .fillColor('#2c3e50');
      headers.forEach((header, i) => {
        doc.text(header, startX + columnWidths.slice(0, i).reduce((a, b) => a + b, 0), currentY);
      });
      doc.moveTo(startX, currentY + 15)
         .lineTo(startX + columnWidths.reduce((a, b) => a + b, 0), currentY + 15)
         .strokeColor('#3498db')
         .stroke();
      currentY += 25;
    };

    await drawTableHeaders();

    doc.fontSize(9).font('Helvetica').fillColor('#34495e');
    for (const [day, data] of Object.entries(daySummary)) {
      if (currentY > 700) {
        doc.addPage();
        await generatePDFHeader(doc);
        currentY = doc.y + 20;
        await drawTableHeaders();
      }

      const notCollected = data.total - data.collected;
      doc.text(day, startX, currentY)
         .text(data.total.toString(), startX + columnWidths[0], currentY)
         .text(data.collected.toString(), startX + columnWidths[0] + columnWidths[1], currentY)
         .text(notCollected.toString(), startX + columnWidths[0] + columnWidths[1] + columnWidths[2], currentY);
      currentY += 15;
    }

    const totalCollections = Object.values(daySummary).reduce((sum, d) => sum + d.total, 0);
    const totalCollected = Object.values(daySummary).reduce((sum, d) => sum + d.collected, 0);
    const totalNotCollected = totalCollections - totalCollected;
    currentY += 10;
    if (currentY > 700) {
      doc.addPage();
      await generatePDFHeader(doc);
      currentY = doc.y + 20;
    }
    doc.moveTo(startX, currentY)
       .lineTo(startX + columnWidths.reduce((a, b) => a + b, 0), currentY)
       .stroke();
    currentY += 10;
    doc.font('Helvetica-Bold')
       .text('TOTAL:', startX, currentY)
       .text(totalCollections.toString(), startX + columnWidths[0], currentY)
       .text(totalCollected.toString(), startX + columnWidths[0] + columnWidths[1], currentY)
       .text(totalNotCollected.toString(), startX + columnWidths[0] + columnWidths[1] + columnWidths[2], currentY);

    doc.fontSize(8)
       .font('Helvetica')
       .fillColor('#7f8c8d')
       .text(`Generated on: ${new Date().toLocaleDateString()}`, 40, doc.page.height - 50, { align: 'left' })
       .text(`Page ${doc.page.number}`, 0, doc.page.height - 50, { align: 'right' });

    doc.end();

  } catch (error) {
    console.error('Error generating garbage collection day summary report:', error);
    if (!res.headersSent) {
      res.status(500).json({ message: 'Error generating report', error: error.message });
    }
    if (doc) doc.end();
  }
};

module.exports = { getGarbageCollectionDaySummaryReport };