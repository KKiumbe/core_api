// invoiceStatusSummaryReport.js
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const PDFDocument = require("pdfkit");
const { generatePDFHeader } = require("../header");


async function getInvoiceStatusSummaryReport(req, res) {
  let doc;
  try {
    const invoices = await prisma.invoice.findMany({
      where: { customer: { status: "ACTIVE" } },
      select: {
        invoiceAmount: true,
        closingBalance: true,
        status: true,
      },
    });

    if (!invoices.length) {
      return res.status(404).json({ message: "No invoices found for active customers." });
    }

    const statusSummary = {
      UNPAID: { count: 0, amount: 0, balance: 0 },
      PAID: { count: 0, amount: 0, balance: 0 },
      PPAID: { count: 0, amount: 0, balance: 0 },
      CANCELLED: { count: 0, amount: 0, balance: 0 },
    };

    invoices.forEach(invoice => {
      statusSummary[invoice.status].count += 1;
      statusSummary[invoice.status].amount += invoice.invoiceAmount;
      statusSummary[invoice.status].balance += invoice.closingBalance;
    });

    doc = new PDFDocument({ size: 'A4', margin: 40 });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="invoice_status_summary_report.pdf"');
    doc.pipe(res);

    await generatePDFHeader(doc);

    doc.fontSize(14)
       .font('Helvetica-Bold')
       .text('Invoice Status Summary Report', { align: 'center' })
       .moveDown(1);

    const startX = 40;
    let currentY = doc.y + 20;
    const columnWidths = [100, 80, 100, 100];
    const headers = ['Status', 'Count', 'Total Amount', 'Total Balance'];

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
    for (const [status, data] of Object.entries(statusSummary)) {
      if (currentY > 700) {
        doc.addPage();
        await generatePDFHeader(doc);
        currentY = doc.y + 20;
        await drawTableHeaders();
      }

      doc.text(status, startX, currentY)
         .text(data.count.toString(), startX + columnWidths[0], currentY)
         .text(data.amount.toFixed(2), startX + columnWidths[0] + columnWidths[1], currentY)
         .text(data.balance.toFixed(2), startX + columnWidths[0] + columnWidths[1] + columnWidths[2], currentY);
      currentY += 15;
    }

    const totalCount = Object.values(statusSummary).reduce((sum, s) => sum + s.count, 0);
    const totalAmount = Object.values(statusSummary).reduce((sum, s) => sum + s.amount, 0);
    const totalBalance = Object.values(statusSummary).reduce((sum, s) => sum + s.balance, 0);
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
       .text(totalAmount.toFixed(2), startX + columnWidths[0] + columnWidths[1], currentY)
       .text(totalBalance.toFixed(2), startX + columnWidths[0] + columnWidths[1] + columnWidths[2], currentY);

    doc.fontSize(8)
       .font('Helvetica')
       .fillColor('#7f8c8d')
       .text(`Generated on: ${new Date().toLocaleDateString()}`, 40, doc.page.height - 50, { align: 'left' })
       .text(`Page ${doc.page.number}`, 0, doc.page.height - 50, { align: 'right' });

    doc.end();

  } catch (error) {
    console.error('Error generating invoice status summary report:', error);
    if (!res.headersSent) {
      res.status(500).json({ message: 'Error generating report', error: error.message });
    }
    if (doc) doc.end();
  }
};

module.exports = { getInvoiceStatusSummaryReport };