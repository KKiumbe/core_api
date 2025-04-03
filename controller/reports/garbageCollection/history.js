// garbageCollectionHistoryReport.js
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const PDFDocument = require("pdfkit");
const { generatePDFHeader } = require("../header.js");


async function getGarbageCollectionHistoryReport(req, res) {
  let doc;
  try {
    const collections = await prisma.garbageCollectionHistory.findMany({
      select: {
        id: true,
        collectionDate: true,
        collected: true,
        customer: {
          select: {
            firstName: true,
            lastName: true,
            phoneNumber: true,
            garbageCollectionDay: true,
          },
        },
      },
      orderBy: { collectionDate: "desc" },
    });

    if (!collections.length) {
      return res.status(404).json({ message: "No garbage collection history found." });
    }

    doc = new PDFDocument({ size: 'A4', margin: 40 });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="garbage_collection_history_report.pdf"');
    doc.pipe(res);

    await generatePDFHeader(doc);

    doc.fontSize(14)
       .font('Helvetica-Bold')
       .text('Garbage Collection History Report', { align: 'center' })
       .moveDown(1);

    const startX = 40;
    let currentY = doc.y + 20;
    const columnWidths = [120, 100, 80, 80, 80];
    const headers = ['Customer Name', 'Phone', 'Collection Date', 'Collected', 'Scheduled Day'];

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
    for (const collection of collections) {
      if (currentY > 700) {
        doc.addPage();
        await generatePDFHeader(doc);
        currentY = doc.y + 20;
        await drawTableHeaders();
      }

      const fullName = `${collection.customer.firstName} ${collection.customer.lastName}`;
      const date = collection.collectionDate.toLocaleDateString();
      doc.text(fullName.substring(0, 20), startX, currentY)
         .text(collection.customer.phoneNumber || '-', startX + columnWidths[0], currentY)
         .text(date, startX + columnWidths[0] + columnWidths[1], currentY)
         .text(collection.collected ? 'Yes' : 'No', startX + columnWidths[0] + columnWidths[1] + columnWidths[2], currentY)
         .text(collection.customer.garbageCollectionDay, startX + columnWidths[0] + columnWidths[1] + columnWidths[2] + columnWidths[3], currentY);
      currentY += 15;
    }

    const totalCollected = collections.filter(c => c.collected).length;
    const totalNotCollected = collections.length - totalCollected;
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
       .text(`Total Collected: ${totalCollected}`, startX, currentY)
       .text(`Total Not Collected: ${totalNotCollected}`, startX + 200, currentY);

    doc.fontSize(8)
       .font('Helvetica')
       .fillColor('#7f8c8d')
       .text(`Generated on: ${new Date().toLocaleDateString()}`, 40, doc.page.height - 50, { align: 'left' })
       .text(`Page ${doc.page.number}`, 0, doc.page.height - 50, { align: 'right' });

    doc.end();

  } catch (error) {
    console.error('Error generating garbage collection history report:', error);
    if (!res.headersSent) {
      res.status(500).json({ message: 'Error generating report', error: error.message });
    }
    if (doc) doc.end();
  }
};

module.exports = { getGarbageCollectionHistoryReport };