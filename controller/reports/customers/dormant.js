// dormantCustomersReport.js
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const PDFDocument = require("pdfkit");
const { generatePDFHeader } = require("../header.js");


const dormantCustomersReport = async (req, res) => {
  let doc;
  try {
    // Fetch all dormant customers
    const customers = await prisma.customer.findMany({
      where: {
        status: "DORMANT", // Filter for dormant customers
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        phoneNumber: true,
        email: true,
        monthlyCharge: true,
        closingBalance: true,
        garbageCollectionDay: true,
      },
    });

    if (!customers.length) {
      return res.status(404).json({ message: "No dormant customers found." });
    }

    // Create PDF document
    doc = new PDFDocument({ size: 'A4', margin: 40 });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="dormant_customers_report.pdf"');
    doc.pipe(res);

    // Generate initial header
    await generatePDFHeader(doc);

    // Report title
    doc.fontSize(14)
       .font('Helvetica-Bold')
       .text('Dormant Customers Report', { align: 'center' })
       .moveDown(1);

    // Table setup
    const startX = 40;
    let currentY = doc.y + 20;
    const columnWidths = [150, 100, 120, 80, 80];
    const headers = ['Customer Name', 'Phone', 'Email', 'Monthly Charge', 'Balance'];

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

    // Draw initial table headers
    await drawTableHeaders();

    // Add customer data
    doc.fontSize(9).font('Helvetica').fillColor('#34495e');
    for (const customer of customers) {
      if (currentY > 700) {
        doc.addPage();
        await generatePDFHeader(doc);
        currentY = doc.y + 20;
        await drawTableHeaders();
      }

      const fullName = `${customer.firstName} ${customer.lastName}`;
      doc.text(fullName.substring(0, 25), startX, currentY)
         .text(customer.phoneNumber || '-', startX + columnWidths[0], currentY)
         .text(customer.email?.substring(0, 20) || '-', startX + columnWidths[0] + columnWidths[1], currentY)
         .text(customer.monthlyCharge?.toFixed(2) || '0.00', startX + columnWidths[0] + columnWidths[1] + columnWidths[2], currentY)
         .text(customer.closingBalance?.toFixed(2) || '0.00', startX + columnWidths[0] + columnWidths[1] + columnWidths[2] + columnWidths[3], currentY);
      currentY += 15;
    }

    // Total balances
    const totalBalance = customers.reduce((sum, c) => sum + (c.closingBalance || 0), 0);
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
       .text('TOTAL OUTSTANDING BALANCE:', startX, currentY)
       .text(totalBalance.toFixed(2), startX + columnWidths[0] + columnWidths[1] + columnWidths[2] + columnWidths[3], currentY);

    // Footer
    doc.fontSize(8)
       .font('Helvetica')
       .fillColor('#7f8c8d')
       .text(`Generated on: ${new Date().toLocaleDateString()}`, 40, doc.page.height - 50, { align: 'left' })
       .text(`Page ${doc.page.number}`, 0, doc.page.height - 50, { align: 'right' });

    doc.end();

  } catch (error) {
    console.error('Error generating dormant customers report:', error);
    if (!res.headersSent) {
      res.status(500).json({ 
        message: 'Error generating report', 
        error: error.message 
      });
    }
    if (doc) doc.end();
  }
};

module.exports = { dormantCustomersReport };