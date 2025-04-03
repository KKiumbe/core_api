// customerBalanceRangeReport.js
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const PDFDocument = require("pdfkit");
const { generatePDFHeader } = require("../header"); // Adjust path as needed

async function getCustomerBalanceRangeReport(req, res) {
  let doc;
  try {
    // Fetch all active customers
    const customers = await prisma.customer.findMany({
      where: { status: 'ACTIVE' },
      select: {
        firstName: true,
        lastName: true,
        phoneNumber: true,
        email: true,
        monthlyCharge: true,
        closingBalance: true,
      }
    });

    if (!customers.length) {
      return res.status(404).json({ message: "No active customers found." });
    }

    // Define balance ranges
    const balanceRanges = {
      "0 - 500": [],
      "501 - 1000": [],
      "1001 - 2000": [],
      "2001 - 5000": [],
      "5001 - 10000": [],
      "10001+": []
    };

    // Group customers into balance ranges
    customers.forEach(customer => {
      const balance = customer.closingBalance || 0;
      if (balance <= 500) balanceRanges["0 - 500"].push(customer);
      else if (balance <= 1000) balanceRanges["501 - 1000"].push(customer);
      else if (balance <= 2000) balanceRanges["1001 - 2000"].push(customer);
      else if (balance <= 5000) balanceRanges["2001 - 5000"].push(customer);
      else if (balance <= 10000) balanceRanges["5001 - 10000"].push(customer);
      else balanceRanges["10001+"].push(customer);
    });

    // Create PDF document
    doc = new PDFDocument({ size: 'A4', margin: 40 });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="customer_balance_range_report.pdf"');
    doc.pipe(res);

    // Generate initial header
    await generatePDFHeader(doc);

    // Report title
    doc.fontSize(14)
       .font('Helvetica-Bold')
       .text('Customer Balance Range Report', { align: 'center' })
       .moveDown(1);

    // Table setup
    const startX = 40;
    let currentY = doc.y + 20;
    const columnWidths = [150, 100, 120, 80];
    const headers = ['Customer Name', 'Phone', 'Email', 'Balance'];

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

    // Process each balance range
    doc.fontSize(9).font('Helvetica').fillColor('#34495e');
    for (const [range, customersInRange] of Object.entries(balanceRanges)) {
      if (customersInRange.length === 0) continue;

      // Check page space
      if (currentY > 650) {
        doc.addPage();
        await generatePDFHeader(doc);
        currentY = doc.y + 20;
      }

      // Range title
      doc.fontSize(11)
         .font('Helvetica-Bold')
         .text(`Balance Range: ${range}`, startX, currentY)
         .moveDown(0.5);

      currentY = doc.y;
      await drawTableHeaders();

      // Customer rows
      for (const customer of customersInRange) {
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
           .text(customer.closingBalance.toFixed(2), startX + columnWidths[0] + columnWidths[1] + columnWidths[2], currentY);
        currentY += 15;
      }

      // Range total
      const rangeTotal = customersInRange.reduce((sum, c) => sum + (c.closingBalance || 0), 0);
      currentY += 5;
      doc.font('Helvetica-Bold')
         .text(`Total for ${range}:`, startX, currentY)
         .text(rangeTotal.toFixed(2), startX + columnWidths[0] + columnWidths[1] + columnWidths[2], currentY);
      currentY += 20;
    }

    // Grand total
    const grandTotal = customers.reduce((sum, c) => sum + (c.closingBalance || 0), 0);
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
       .text('GRAND TOTAL:', startX, currentY)
       .text(grandTotal.toFixed(2), startX + columnWidths[0] + columnWidths[1] + columnWidths[2], currentY);

    // Footer
    doc.fontSize(8)
       .font('Helvetica')
       .fillColor('#7f8c8d')
       .text(`Generated on: ${new Date().toLocaleDateString()}`, 40, doc.page.height - 50, { align: 'left' })
       .text(`Page ${doc.page.number}`, 0, doc.page.height - 50, { align: 'right' });

    doc.end();

  } catch (error) {
    console.error('Error generating customer balance range report:', error);
    if (!res.headersSent) {
      res.status(500).json({ 
        message: 'Error generating report', 
        error: error.message 
      });
    }
    if (doc) doc.end();
  }
};



async function getCustomerMonthlyChargeRangeReport(req, res) {
  let doc;
  try {
    // Fetch all active customers
    const customers = await prisma.customer.findMany({
      where: { status: 'ACTIVE' },
      select: {
        firstName: true,
        lastName: true,
        phoneNumber: true,
        email: true,
        monthlyCharge: true,
        closingBalance: true,
      }
    });

    if (!customers.length) {
      return res.status(404).json({ message: "No active customers found." });
    }

    // Define monthly charge ranges
    const chargeRanges = {
      "0 - 200": [],
      "200 - 300": [],
      "300 - 500": [],
      "500 - 1000": [],
      "1000 - 2000": [],
      "3000 - 5000": [],
      "5000+": []
    };

    // Group customers into monthly charge ranges
    customers.forEach(customer => {
      const charge = customer.monthlyCharge || 0;
      if (charge <= 200) chargeRanges["0 - 200"].push(customer);
      else if (charge <= 300) chargeRanges["200 - 300"].push(customer);
      else if (charge <= 500) chargeRanges["300 - 500"].push(customer);
      else if (charge <= 1000) chargeRanges["500 - 1000"].push(customer);
      else if (charge <= 2000) chargeRanges["1000 - 2000"].push(customer);
      else if (charge <= 5000) chargeRanges["3000 - 5000"].push(customer);
      else chargeRanges["5000+"].push(customer);
    });

    // Create PDF document
    doc = new PDFDocument({ size: 'A4', margin: 40 });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="customer_monthly_charge_range_report.pdf"');
    doc.pipe(res);

    // Generate initial header
    await generatePDFHeader(doc);

    // Report title
    doc.fontSize(14)
       .font('Helvetica-Bold')
       .text('Customer Monthly Charge Range Report', { align: 'center' })
       .moveDown(1);

    // Table setup
    const startX = 40;
    let currentY = doc.y + 20;
    const columnWidths = [150, 100, 120, 80];
    const headers = ['Customer Name', 'Phone', 'Email', 'Monthly Charge'];

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

    // Process each charge range
    doc.fontSize(9).font('Helvetica').fillColor('#34495e');
    for (const [range, customersInRange] of Object.entries(chargeRanges)) {
      if (customersInRange.length === 0) continue;

      // Check page space
      if (currentY > 650) {
        doc.addPage();
        await generatePDFHeader(doc);
        currentY = doc.y + 20;
      }

      // Range title
      doc.fontSize(11)
         .font('Helvetica-Bold')
         .text(`Monthly Charge Range: ${range}`, startX, currentY)
         .moveDown(0.5);

      currentY = doc.y;
      await drawTableHeaders();

      // Customer rows
      for (const customer of customersInRange) {
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
           .text(customer.monthlyCharge.toFixed(2), startX + columnWidths[0] + columnWidths[1] + columnWidths[2], currentY);
        currentY += 15;
      }

      // Range total
      const rangeTotal = customersInRange.reduce((sum, c) => sum + (c.monthlyCharge || 0), 0);
      currentY += 5;
      doc.font('Helvetica-Bold')
         .text(`Total for ${range}:`, startX, currentY)
         .text(rangeTotal.toFixed(2), startX + columnWidths[0] + columnWidths[1] + columnWidths[2], currentY);
      currentY += 20;
    }

    // Grand total
    const grandTotal = customers.reduce((sum, c) => sum + (c.monthlyCharge || 0), 0);
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
       .text('GRAND TOTAL:', startX, currentY)
       .text(grandTotal.toFixed(2), startX + columnWidths[0] + columnWidths[1] + columnWidths[2], currentY);

    // Footer
    doc.fontSize(8)
       .font('Helvetica')
       .fillColor('#7f8c8d')
       .text(`Generated on: ${new Date().toLocaleDateString()}`, 40, doc.page.height - 50, { align: 'left' })
       .text(`Page ${doc.page.number}`, 0, doc.page.height - 50, { align: 'right' });

    doc.end();

  } catch (error) {
    console.error('Error generating customer monthly charge range report:', error);
    if (!res.headersSent) {
      res.status(500).json({ 
        message: 'Error generating report', 
        error: error.message 
      });
    }
    if (doc) doc.end();
  }
};


module.exports = { getCustomerBalanceRangeReport ,getCustomerMonthlyChargeRangeReport};