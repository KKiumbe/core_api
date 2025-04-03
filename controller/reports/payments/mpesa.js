// mpesaPaymentsReport.js
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const PDFDocument = require("pdfkit");
const { generatePDFHeader } = require("../header.js");


async function getMpesaPaymentsReport(req, res) {
  let doc;
  try {
    const payments = await prisma.payment.findMany({
      where: { modeOfPayment: "MPESA" },
      select: {
        id: true,
        amount: true,
        transactionId: true,
        createdAt: true,
        receipt: {
          select: {
            receiptNumber: true,
            customer: { select: { firstName: true, lastName: true, phoneNumber: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    if (!payments.length) {
      return res.status(404).json({ message: "No MPESA payments found." });
    }

    doc = new PDFDocument({ size: 'A4', margin: 40 });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="mpesa_payments_report.pdf"');
    doc.pipe(res);

    await generatePDFHeader(doc);

    doc.fontSize(14)
       .font('Helvetica-Bold')
       .text('MPESA Payments Report', { align: 'center' })
       .moveDown(1);

    const startX = 40;
    let currentY = doc.y + 20;
    const columnWidths = [120, 80, 80, 80, 80];
    const headers = ['Customer Name', 'Receipt No', 'Amount', 'Trans ID', 'Date'];

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
    for (const payment of payments) {
      if (currentY > 700) {
        doc.addPage();
        await generatePDFHeader(doc);
        currentY = doc.y + 20;
        await drawTableHeaders();
      }

      const customerName = payment.receipt?.customer
        ? `${payment.receipt.customer.firstName} ${payment.receipt.customer.lastName}`
        : 'Unknown';
      const date = payment.createdAt.toLocaleDateString();
      doc.text(customerName.substring(0, 20), startX, currentY)
         .text(payment.receipt?.receiptNumber || '-', startX + columnWidths[0], currentY)
         .text(payment.amount.toFixed(2), startX + columnWidths[0] + columnWidths[1], currentY)
         .text(payment.transactionId || '-', startX + columnWidths[0] + columnWidths[1] + columnWidths[2], currentY)
         .text(date, startX + columnWidths[0] + columnWidths[1] + columnWidths[2] + columnWidths[3], currentY);
      currentY += 15;
    }

    const totalAmount = payments.reduce((sum, p) => sum + p.amount, 0);
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
       .text('TOTAL MPESA AMOUNT:', startX, currentY)
       .text(totalAmount.toFixed(2), startX + columnWidths[0] + columnWidths[1], currentY);

    doc.fontSize(8)
       .font('Helvetica')
       .fillColor('#7f8c8d')
       .text(`Generated on: ${new Date().toLocaleDateString()}`, 40, doc.page.height - 50, { align: 'left' })
       .text(`Page ${doc.page.number}`, 0, doc.page.height - 50, { align: 'right' });

    doc.end();

  } catch (error) {
    console.error('Error generating MPESA payments report:', error);
    if (!res.headersSent) {
      res.status(500).json({ message: 'Error generating report', error: error.message });
    }
    if (doc) doc.end();
  }
};

module.exports = { getMpesaPaymentsReport };