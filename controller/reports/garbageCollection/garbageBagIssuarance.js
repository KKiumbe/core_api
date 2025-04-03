// trashBagsIssuanceReport.js
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const PDFDocument = require("pdfkit");
const { generatePDFHeader } = require("../header");


async function getTrashBagsIssuanceReport(req, res) {
  let doc;
  try {
    const issuances = await prisma.trashBagIssuance.findMany({
      select: {
        id: true,
        issuedDate: true,
        bagsIssued: true,
        customer: {
          select: {
            firstName: true,
            lastName: true,
            phoneNumber: true,
            garbageCollectionDay: true,
          },
        },
        task: {
          select: {
            createdBy: true,
          },
        },
      },
      orderBy: { issuedDate: "desc" },
    });

    if (!issuances.length) {
      return res.status(404).json({ message: "No trash bag issuances found." });
    }

    doc = new PDFDocument({ size: 'A4', margin: 40 });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="trash_bags_issuance_report.pdf"');
    doc.pipe(res);

    await generatePDFHeader(doc);

    doc.fontSize(14)
       .font('Helvetica-Bold')
       .text('Trash Bags Issuance Report', { align: 'center' })
       .moveDown(1);

    const startX = 40;
    let currentY = doc.y + 20;
    const columnWidths = [120, 100, 80, 80, 80];
    const headers = ['Customer Name', 'Phone', 'Issued Date', 'Bags Issued', 'Issued By'];

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
    for (const issuance of issuances) {
      if (currentY > 700) {
        doc.addPage();
        await generatePDFHeader(doc);
        currentY = doc.y + 20;
        await drawTableHeaders();
      }

      const fullName = `${issuance.customer.firstName} ${issuance.customer.lastName}`;
      const date = issuance.issuedDate.toLocaleDateString();
      doc.text(fullName.substring(0, 20), startX, currentY)
         .text(issuance.customer.phoneNumber || '-', startX + columnWidths[0], currentY)
         .text(date, startX + columnWidths[0] + columnWidths[1], currentY)
         .text(issuance.bagsIssued ? 'Yes' : 'No', startX + columnWidths[0] + columnWidths[1] + columnWidths[2], currentY)
         .text(issuance.task.createdBy || '-', startX + columnWidths[0] + columnWidths[1] + columnWidths[2] + columnWidths[3], currentY);
      currentY += 15;
    }

    const totalIssued = issuances.filter(i => i.bagsIssued).length;
    const totalNotIssued = issuances.length - totalIssued;
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
       .text(`Total Bags Issued: ${totalIssued}`, startX, currentY)
       .text(`Total Not Issued: ${totalNotIssued}`, startX + 200, currentY);

    doc.fontSize(8)
       .font('Helvetica')
       .fillColor('#7f8c8d')
       .text(`Generated on: ${new Date().toLocaleDateString()}`, 40, doc.page.height - 50, { align: 'left' })
       .text(`Page ${doc.page.number}`, 0, doc.page.height - 50, { align: 'right' });

    doc.end();

  } catch (error) {
    console.error('Error generating trash bags issuance report:', error);
    if (!res.headersSent) {
      res.status(500).json({ message: 'Error generating report', error: error.message });
    }
    if (doc) doc.end();
  }
};

module.exports = { getTrashBagsIssuanceReport };