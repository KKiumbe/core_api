const PDFDocument = require('pdfkit');
const { generatePDFHeader } = require('../header.js');

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();



async function getAllActiveCustomersReport(req, res) {
  let doc;
  try {
    // Fetch active customers
    const customers = await prisma.customer.findMany({
      where: {
        status: 'ACTIVE',
      },
      select: {
        firstName: true,
        lastName: true,
        phoneNumber: true,
        email: true,
        monthlyCharge: true,
        closingBalance: true,
        garbageCollectionDay: true
      }
    });

    if (!customers.length) {
      return res.status(404).json({ message: "No active customers found." });
    }

    // Create PDF document
    doc = new PDFDocument({
      size: 'A4',
      margin: 50
    });

    // Set response headers
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="active_customers_report.pdf"');

    // Pipe the PDF to response
    doc.pipe(res);

    // Generate header
    await generatePDFHeader(doc);

    // Rest of your report generation code...
    doc.fontSize(14)
       .font('Helvetica-Bold')
       .text('Active Customers Report', { align: 'center' })
       .moveDown(1);

    const startX = 50;
    const startY = doc.y + 20;
    const columnWidths = [100, 100, 80, 120, 60, 60];
    
    doc.fontSize(10)
       .font('Helvetica-Bold')
       .text('Name', startX, startY)
       .text('Phone', startX + columnWidths[0], startY)
       .text('Email', startX + columnWidths[0] + columnWidths[1], startY)
       .text('Collection Day', startX + columnWidths[0] + columnWidths[1] + columnWidths[2], startY)
       .text('Monthly', startX + columnWidths[0] + columnWidths[1] + columnWidths[2] + columnWidths[3], startY)
       .text('Balance', startX + columnWidths[0] + columnWidths[1] + columnWidths[2] + columnWidths[3] + columnWidths[4], startY);

    doc.moveTo(startX, startY + 15)
       .lineTo(562, startY + 15)
       .stroke();

    let currentY = startY + 25;
    doc.font('Helvetica').fontSize(9);

    customers.forEach(customer => {
      const fullName = `${customer.firstName} ${customer.lastName}`;
      if (currentY > 700) {
        doc.addPage();
        currentY = 50;
      }

      doc.text(fullName.substring(0, 20), startX, currentY)
         .text(customer.phoneNumber || '-', startX + columnWidths[0], currentY)
         .text(customer.email?.substring(0, 20) || '-', startX + columnWidths[0] + columnWidths[1], currentY)
         .text(customer.garbageCollectionDay || '-', startX + columnWidths[0] + columnWidths[1] + columnWidths[2], currentY)
         .text(customer.monthlyCharge?.toFixed(2) || '0.00', startX + columnWidths[0] + columnWidths[1] + columnWidths[2] + columnWidths[3], currentY)
         .text(customer.closingBalance?.toFixed(2) || '0.00', startX + columnWidths[0] + columnWidths[1] + columnWidths[2] + columnWidths[3] + columnWidths[4], currentY);

      currentY += 20;
    });

    // Finalize PDF
    doc.end();

  } catch (error) {
    console.error('Error generating customer report:', error);
    if (!res.headersSent) {
      res.status(500).json({ 
        message: 'Error generating report', 
        error: error.message 
      });
    }
    if (doc) {
      doc.end(); // Ensure document is closed if it exists
    }
  }
}



module.exports = { getAllActiveCustomersReport };