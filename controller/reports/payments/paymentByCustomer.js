// paymentsByCustomerReport.js
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const PDFDocument = require("pdfkit");
const { generatePDFHeader } = require("../header.js");


async function getPaymentsByCustomerReport(req, res) {
  let doc;
  try {
    const customers = await prisma.customer.findMany({
      where: { status: "ACTIVE" },
      select: {
        firstName: true,
        lastName: true,
        phoneNumber: true,
        email: true,
        receipts: {
          select: {
            payment: {
              select: {
                amount: true,
                modeOfPayment: true,
                createdAt: true,
                transactionId: true,
              },
            },
            receiptNumber: true,
          },
        },
      },
      orderBy: { lastName: "asc" },
    });

    if (!customers.length) {
      return res.status(404).json({ message: "No active customers with payments found." });
    }

    doc = new PDFDocument({ size: 'A4', margin: 40 });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="payments_by_customer_report.pdf"');
    doc.pipe(res);

    await generatePDFHeader(doc);

    doc.fontSize(14)
       .font('Helvetica-Bold')
       .text('Payments by Customer Report', { align: 'center' })
       .moveDown(1);

    const startX = 40;
    let currentY = doc.y + 20;
    const columnWidths = [80, 80, 80, 80, 80];
    const headers = ['Receipt No', 'Amount', 'Mode', 'Trans ID', 'Date'];

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

    doc.fontSize(9).font('Helvetica').fillColor('#34495e');
    for (const customer of customers) {
      if (customer.receipts.length === 0) continue;

      if (currentY > 650) {
        doc.addPage();
        await generatePDFHeader(doc);
        currentY = doc.y + 20;
      }

      const fullName = `${customer.firstName} ${customer.lastName}`;
      doc.fontSize(11)
         .font('Helvetica-Bold')
         .text(`Customer: ${fullName}`, startX, currentY)
         .text(`Phone: ${customer.phoneNumber || '-'}`, startX + 200, currentY)
         .moveDown(0.5);

      currentY = doc.y;
      await drawTableHeaders();

      for (const receipt of customer.receipts) {
        if (currentY > 700) {
          doc.addPage();
          await generatePDFHeader(doc);
          currentY = doc.y + 20;
          await drawTableHeaders();
        }

        const payment = receipt.payment;
        const date = payment?.createdAt.toLocaleDateString() || '-';
        doc.text(receipt.receiptNumber || '-', startX, currentY)
           .text(payment?.amount.toFixed(2) || '-', startX + columnWidths[0], currentY)
           .text(payment?.modeOfPayment || '-', startX + columnWidths[0] + columnWidths[1], currentY)
           .text(payment?.transactionId || '-', startX + columnWidths[0] + columnWidths[1] + columnWidths[2], currentY)
           .text(date, startX + columnWidths[0] + columnWidths[1] + columnWidths[2] + columnWidths[3], currentY);
        currentY += 15;
      }

      const customerTotal = customer.receipts.reduce((sum, r) => sum + (r.payment?.amount || 0), 0);
      currentY += 5;
      doc.font('Helvetica-Bold')
         .text(`Total for ${fullName}:`, startX, currentY)
         .text(customerTotal.toFixed(2), startX + columnWidths[0], currentY);
      currentY += 20;
    }

    doc.fontSize(8)
       .font('Helvetica')
       .fillColor('#7f8c8d')
       .text(`Generated on: ${new Date().toLocaleDateString()}`, 40, doc.page.height - 50, { align: 'left' })
       .text(`Page ${doc.page.number}`, 0, doc.page.height - 50, { align: 'right' });

    doc.end();

  } catch (error) {
    console.error('Error generating payments by customer report:', error);
    if (!res.headersSent) {
      res.status(500).json({ message: 'Error generating report', error: error.message });
    }
    if (doc) doc.end();
  }
};

module.exports = { getPaymentsByCustomerReport };