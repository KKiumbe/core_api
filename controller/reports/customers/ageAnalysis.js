// ageAnalysis.js
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const PDFDocument = require("pdfkit");
const { generatePDFHeader } = require("../header");

const ageAnalysisReport = async (req, res) => {
  let doc;
  try {
    // Fetch all active customers with outstanding balances
    const customers = await prisma.customer.findMany({
      where: {
        status: "ACTIVE",
        closingBalance: {
          gt: 0,
        },
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        phoneNumber: true,
        monthlyCharge: true,
        closingBalance: true,
        garbageCollectionDay: true,
      },
    });

    if (!customers.length) {
      return res.status(404).json({ message: "No customers with outstanding balances found." });
    }

    // Initialize aging buckets
    const ageBuckets = {
      "1 Month": [],
      "2 Months": [],
      "3 Months": [],
      "4 Months": [],
      "5 Months": [],
      "6+ Months": [],
    };

    // Simple aging logic
    customers.forEach(customer => {
      const monthsOverdue = Math.floor(customer.closingBalance / customer.monthlyCharge) || 1;
      if (monthsOverdue <= 1) ageBuckets["1 Month"].push(customer);
      else if (monthsOverdue === 2) ageBuckets["2 Months"].push(customer);
      else if (monthsOverdue === 3) ageBuckets["3 Months"].push(customer);
      else if (monthsOverdue === 4) ageBuckets["4 Months"].push(customer);
      else if (monthsOverdue === 5) ageBuckets["5 Months"].push(customer);
      else ageBuckets["6+ Months"].push(customer);
    });

    // Create PDF document
    doc = new PDFDocument({ size: 'A4', margin: 40 });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="aging_analysis_report.pdf"');
    doc.pipe(res);

    // Generate initial header
    await generatePDFHeader(doc);

    // Report title
    doc.fontSize(14)
       .font('Helvetica-Bold')
       .text('Accounts Receivable Aging Analysis', { align: 'center' })
       .moveDown(1);

    // Table setup
    const startX = 40;
    let currentY = doc.y + 20;
    const columnWidths = [150, 100, 80, 100];
    const headers = ['Customer Name', 'Phone', 'Months Overdue', 'Amount Owed'];

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

    // Process each aging bucket
    doc.fontSize(9).font('Helvetica').fillColor('#34495e');
    for (const [bucket, customersInBucket] of Object.entries(ageBuckets)) {
      if (customersInBucket.length === 0) continue;

      // Check page space
      if (currentY > 650) {
        doc.addPage();
        //await generatePDFHeader(doc); // Now valid in async context
        currentY = doc.y + 20;
      }

      // Bucket title
      doc.fontSize(11)
         .font('Helvetica-Bold')
         .text(`${bucket} Overdue`, startX, currentY)
         .moveDown(0.5);

      currentY = doc.y;
      await drawTableHeaders(); // Call async function

      // Customer rows
      for (const customer of customersInBucket) {
        if (currentY > 700) {
          doc.addPage();
          //await generatePDFHeader(doc); // Now valid in async context
          currentY = doc.y + 20;
          await drawTableHeaders(); // Call async function
        }

        const fullName = `${customer.firstName} ${customer.lastName}`;
        const months = bucket === "6+ Months" ? "6+" : bucket.split(" ")[0];
        doc.text(fullName.substring(0, 25), startX, currentY)
           .text(customer.phoneNumber || '-', startX + columnWidths[0], currentY)
           .text(months, startX + columnWidths[0] + columnWidths[1], currentY)
           .text(customer.closingBalance.toFixed(2), startX + columnWidths[0] + columnWidths[1] + columnWidths[2], currentY);
        currentY += 15;
      }

      // Bucket total
      const bucketTotal = customersInBucket.reduce((sum, c) => sum + c.closingBalance, 0);
      currentY += 5;
      doc.font('Helvetica-Bold')
         .text(`Total for ${bucket}:`, startX, currentY)
         .text(bucketTotal.toFixed(2), startX + columnWidths[0] + columnWidths[1] + columnWidths[2], currentY);
      currentY += 20;
    }

    // Grand total
    const grandTotal = customers.reduce((sum, c) => sum + c.closingBalance, 0);
    if (currentY > 700) {
      doc.addPage();
      //await generatePDFHeader(doc);
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
    console.error('Error generating aging analysis report:', error);
    if (!res.headersSent) {
      res.status(500).json({ 
        message: 'Error generating report', 
        error: error.message 
      });
    }
    if (doc) doc.end();
  }
};

module.exports = { ageAnalysisReport };