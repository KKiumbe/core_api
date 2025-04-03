// paymentModeSummaryReport.js
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const PDFDocument = require("pdfkit");
const { generatePDFHeader } = require("../header");


async function getPaymentModeSummaryReport(req, res) {
  let doc;
  try {
    const payments = await prisma.payment.findMany({
      select: {
        amount: true,
        modeOfPayment: true,
      },
    });

    if (!payments.length) {
      return res.status(404).json({ message: "No payments found." });
    }

    const modeSummary = {
      CASH: { count: 0, amount: 0 },
      MPESA: { count: 0, amount: 0 },
      BANK: { count: 0, amount: 0 },
    };

    payments.forEach(payment => {
      modeSummary[payment.modeOfPayment].count += 1;
      modeSummary[payment.modeOfPayment].amount += payment.amount;
    });

    doc = new PDFDocument({ size: 'A4', margin: 40 });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="payment_mode_summary_report.pdf"');
    doc.pipe(res);

    await generatePDFHeader(doc);

    doc.fontSize(14)
       .font('Helvetica-Bold')
       .text('Payment Mode Summary Report', { align: 'center' })
       .moveDown(1);

    const startX = 40;
    let currentY = doc.y + 20;
    const columnWidths = [100, 80, 100];
    const headers = ['Mode', 'Count', 'Total Amount'];

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
    for (const [mode, data] of Object.entries(modeSummary)) {
      if (currentY > 700) {
        doc.addPage();
        await generatePDFHeader(doc);
        currentY = doc.y + 20;
        await drawTableHeaders();
      }

      doc.text(mode, startX, currentY)
         .text(data.count.toString(), startX + columnWidths[0], currentY)
         .text(data.amount.toFixed(2), startX + columnWidths[0] + columnWidths[1], currentY);
      currentY += 15;
    }

    const totalCount = Object.values(modeSummary).reduce((sum, m) => sum + m.count, 0);
    const totalAmount = Object.values(modeSummary).reduce((sum, m) => sum + m.amount, 0);
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
       .text(totalCount.toString(), startX + columnWidths[0], currentY)
       .text(totalAmount.toFixed(2), startX + columnWidths[0] + columnWidths[1], currentY);

    doc.fontSize(8)
       .font('Helvetica')
       .fillColor('#7f8c8d')
       .text(`Generated on: ${new Date().toLocaleDateString()}`, 40, doc.page.height - 50, { align: 'left' })
       .text(`Page ${doc.page.number}`, 0, doc.page.height - 50, { align: 'right' });

    doc.end();

  } catch (error) {
    console.error('Error generating payment mode summary report:', error);
    if (!res.headersSent) {
      res.status(500).json({ message: 'Error generating report', error: error.message });
    }
    if (doc) doc.end();
  }
};

module.exports = { getPaymentModeSummaryReport };