// pdfHeader.js
const PDFDocument = require('pdfkit');
const path = require('path');
const fs = require('fs');

async function generatePDFHeader(doc) {
  if (!doc || typeof doc !== 'object') {
    throw new Error('PDF document object is required');
  }

  // Header background
  doc.rect(0, 0, 612, 140)
     .fillOpacity(0.8)
     .fill('#f8f9fa');

  // Logo - moved up
  const logoPath = path.join(__dirname, '..', 'assets', 'iconcore.jpeg');
  if (fs.existsSync(logoPath)) {
    try {
      doc.image(logoPath, 40, 10, { 
        width: 70, 
        height: 70,
        align: 'left' 
      });
    } catch (error) {
      console.warn('⚠️ Error adding logo to PDF:', error.message);
    }
  }

  // Company name - adjusted position
  doc.fontSize(20)
     .font('Helvetica-Bold')
     .fillColor('#2c3e50')
     .text('CORE WASTE MANAGEMENT SERVICES', 130, 25, { 
       align: 'center',
       width: 350 
     });

  // Subheader line
  doc.fontSize(10)
     .font('Helvetica-Oblique')
     .fillColor('#7f8c8d')
     .text('', 130, 50, { 
       align: 'center',
       width: 350 
     });

  // Contact details - moved down
  doc.fontSize(9)
     .font('Helvetica')
     .fillColor('#34495e');

  // Left column - increased Y position
  const leftX = 40;
  const detailsY = 85; // Moved down from 75
  doc.text('Street: Juja Town', leftX, detailsY)
     .text('Phone: 0701-444-408', leftX, detailsY + 12)
     .text('Email: corewastemanagementsvcs@gmail.com', leftX, detailsY + 24);

  // Right column
  const rightX = 400;
  doc.text('County: Kiambu', rightX, detailsY)
     .text('Town: Juja', rightX, detailsY + 12)
     .text('P.O Box: 209-01001', rightX, detailsY + 24)
     .text('Building: Gilkan House', rightX, detailsY + 36);

  // Divider line
  doc.moveTo(40, 130)
     .lineTo(572, 130)
     .lineWidth(2)
     .strokeColor('#3498db')
     .stroke();

  // Reset for content below
  doc.fillColor('#000000')
     .fontSize(12)
     .moveDown(1);
}

module.exports = { generatePDFHeader };