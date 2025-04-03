// monthlyInvoiceReport.js
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const PDFDocument = require("pdfkit");
const { generatePDFHeader } = require("../header.js");


async function getMonthlyInvoiceReport(req, res) {
  let doc;
  try {
    // Fetch all invoices for active customers
    const invoices = await prisma.invoice.findMany({
      where: {
        customer: { status: "ACTIVE" },
      },
      select: {
        id: true,
        invoiceNumber: true,
        invoicePeriod: true,
        invoiceAmount: true,
        closingBalance: true,
        status: true,
        customer: {
          select: {
            firstName: true,
            lastName: true,
            phoneNumber: true,
            email: true,
          },
        },
      },
      orderBy: {
        invoicePeriod: "asc",
      },
    });

    if (!invoices.length) {
      return res.status(404).json({ message: "No invoices found for active customers." });
    }

    // Group invoices by month
    const monthlyGroups = {};
    invoices.forEach(invoice => {
      const monthYear = invoice.invoicePeriod.toLocaleString('default', { month: 'long', year: 'numeric' });
      if (!monthlyGroups[monthYear]) {
        monthlyGroups[monthYear] = [];
      }
      monthlyGroups[monthYear].push(invoice);
    });

    // Create PDF document
    doc = new PDFDocument({ size: 'A4', margin: 40 });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="monthly_invoice_report.pdf"');
    doc.pipe(res);

    // Generate initial header
    await generatePDFHeader(doc);

    // Report title
    doc.fontSize(14)
       .font('Helvetica-Bold')
       .text('Monthly Invoice Report', { align: 'center' })
       .moveDown(1);

    // Table setup
    const startX = 40;
    let currentY = doc.y + 20;
    const columnWidths = [120, 100, 80, 80, 80, 70];
    const headers = ['Customer Name', 'Phone', 'Invoice No', 'Amount', 'Balance', 'Status'];

    // Async function to draw table headers
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

    // Process each month
    doc.fontSize(9).font('Helvetica').fillColor('#34495e');
    for (const [monthYear, invoicesInMonth] of Object.entries(monthlyGroups)) {
      if (invoicesInMonth.length === 0) continue;

      // Check page space
      if (currentY > 650) {
        doc.addPage();
        await generatePDFHeader(doc);
        currentY = doc.y + 20;
      }

      // Month title
      doc.fontSize(11)
         .font('Helvetica-Bold')
         .text(`Month: ${monthYear}`, startX, currentY)
         .moveDown(0.5);

      currentY = doc.y;
      await drawTableHeaders();

      // Invoice rows
      for (const invoice of invoicesInMonth) {
        if (currentY > 700) {
          doc.addPage();
          await generatePDFHeader(doc);
          currentY = doc.y + 20;
          await drawTableHeaders();
        }

        const fullName = `${invoice.customer.firstName} ${invoice.customer.lastName}`;
        doc.text(fullName.substring(0, 20), startX, currentY)
           .text(invoice.customer.phoneNumber || '-', startX + columnWidths[0], currentY)
           .text(invoice.invoiceNumber.substring(0, 12), startX + columnWidths[0] + columnWidths[1], currentY)
           .text(invoice.invoiceAmount.toFixed(2), startX + columnWidths[0] + columnWidths[1] + columnWidths[2], currentY)
           .text(invoice.closingBalance.toFixed(2), startX + columnWidths[0] + columnWidths[1] + columnWidths[2] + columnWidths[3], currentY)
           .text(invoice.status, startX + columnWidths[0] + columnWidths[1] + columnWidths[2] + columnWidths[3] + columnWidths[4], currentY);
        currentY += 15;
      }

      // Month totals
      const monthTotalAmount = invoicesInMonth.reduce((sum, i) => sum + i.invoiceAmount, 0);
      const monthTotalBalance = invoicesInMonth.reduce((sum, i) => sum + i.closingBalance, 0);
      currentY += 5;
      doc.font('Helvetica-Bold')
         .text(`Total Amount for ${monthYear}:`, startX, currentY)
         .text(monthTotalAmount.toFixed(2), startX + columnWidths[0] + columnWidths[1] + columnWidths[2], currentY)
         .text(`Total Balance:`, startX + columnWidths[0] + columnWidths[1] + columnWidths[2] + columnWidths[3] - 50, currentY)
         .text(monthTotalBalance.toFixed(2), startX + columnWidths[0] + columnWidths[1] + columnWidths[2] + columnWidths[3], currentY);
      currentY += 20;
    }

    // Grand totals
    const grandTotalAmount = invoices.reduce((sum, i) => sum + i.invoiceAmount, 0);
    const grandTotalBalance = invoices.reduce((sum, i) => sum + i.closingBalance, 0);
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
       .text('GRAND TOTAL AMOUNT:', startX, currentY)
       .text(grandTotalAmount.toFixed(2), startX + columnWidths[0] + columnWidths[1] + columnWidths[2], currentY)
       .text('GRAND TOTAL BALANCE:', startX + columnWidths[0] + columnWidths[1] + columnWidths[2] + columnWidths[3] - 50, currentY)
       .text(grandTotalBalance.toFixed(2), startX + columnWidths[0] + columnWidths[1] + columnWidths[2] + columnWidths[3], currentY);

    // Footer
    doc.fontSize(8)
       .font('Helvetica')
       .fillColor('#7f8c8d')
       .text(`Generated on: ${new Date().toLocaleDateString()}`, 40, doc.page.height - 50, { align: 'left' })
       .text(`Page ${doc.page.number}`, 0, doc.page.height - 50, { align: 'right' });

    doc.end();

  } catch (error) {
    console.error('Error generating monthly invoice report:', error);
    if (!res.headersSent) {
      res.status(500).json({ 
        message: 'Error generating report', 
        error: error.message 
      });
    }
    if (doc) doc.end();
  }
};

module.exports = { getMonthlyInvoiceReport };