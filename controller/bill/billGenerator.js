const { PrismaClient } = require('@prisma/client');
const schedule = require('node-schedule'); // For scheduling jobs
const invoiceQueue = require('./jobFunction.js');
const prisma = new PrismaClient();

// Function to generate a unique invoice number
function generateInvoiceNumber(customerId) {
  const invoiceSuffix = Math.floor(Math.random() * 1000000).toString().padStart(3, '0');
  return `INV${invoiceSuffix}-${customerId}`;
}

// Fetch the customer's current closing balance
async function getCurrentClosingBalance(customerId) {
  try {
    const customer = await prisma.customer.findUnique({ where: { id: customerId } });
    if (!customer) throw new Error(`Customer with ID ${customerId} not found.`);
    return customer.closingBalance;
  } catch (error) {
    console.error('Error fetching closing balance:', error);
    throw error;
  }
}

// Get the current month's bill (monthly charge)
async function getCurrentMonthBill(customerId) {
  try {
    const customer = await prisma.customer.findUnique({ where: { id: customerId } });
    return customer ? customer.monthlyCharge : 0;
  } catch (error) {
    console.error('Error fetching current month bill:', error);
    throw error;
  }
}





// Generate invoices for active customers
async function generateInvoices() {
  const currentMonth = new Date().getMonth() + 1;

  try {
    const customers = await prisma.customer.findMany({ where: { status: 'ACTIVE' } });
    console.log(`Found ${customers.length} active customers.`);

    const invoices = await Promise.all(
      customers.map(async (customer) => {
        const invoiceNumber = generateInvoiceNumber(customer.id);
        const invoicePeriod = new Date(new Date().getFullYear(), currentMonth - 1, 1);
        const currentClosingBalance = await getCurrentClosingBalance(customer.id);
        const currentMonthBill = await getCurrentMonthBill(customer.id);
        const invoiceAmount = currentMonthBill;

        // Determine the status of the invoice based on the current closing balance
        let status = 'UNPAID'; // Default status

        // We update the status after the invoice is created based on customer's balance
        const newClosingBalance = currentClosingBalance + invoiceAmount;

        if (newClosingBalance < 0 && Math.abs(currentClosingBalance) >= invoiceAmount) {
          // Scenario: PAID - Invoice is fully paid due to overpayment or negative balance
          status = 'PAID';
        } else if (newClosingBalance === 0) {
          // Scenario: PAID - Invoice is fully paid (no remaining balance)
          status = 'PAID';
        } else if (newClosingBalance > 0 && newClosingBalance < invoiceAmount) {
          // Scenario: PPAID (Partially Paid) - Customer has made a partial payment
          status = 'PPAID';
        } else {
          // Scenario: UNPAID - Customer still owes money
          status = 'UNPAID';
        }

        // Create the new invoice
        const newInvoice = await prisma.invoice.create({
          data: {
            customerId: customer.id,
            invoiceNumber,
            invoicePeriod,
            closingBalance: newClosingBalance, // Update closing balance
            invoiceAmount,
            status, // Set status based on the determined condition
            isSystemGenerated: true,
          },
        });

        // Create invoice item only if invoice amount is greater than zero
        if (invoiceAmount > 0) {
          await prisma.invoiceItem.create({
            data: {
              invoiceId: newInvoice.id,
              description: 'Monthly Charge',
              amount: invoiceAmount,
              quantity: 1,
            },
          });
        }

        // Update the customer’s closing balance
        await prisma.customer.update({
          where: { id: customer.id },
          data: { closingBalance: newClosingBalance },
        });

        return newInvoice;
      })
    );

    console.log(`Generated ${invoices.length} invoices.`);
    return invoices;
  } catch (error) {
    console.error('Error generating invoices:', error);
    throw error;
  }
}


// Create a manual invoice for a customer


async function createInvoice(req, res) {
  const { customerId, invoiceItemsData } = req.body;

  try {
    const customer = await prisma.customer.findUnique({ where: { id: customerId } });
    if (!customer) return res.status(404).json({ error: 'Customer not found' });

    const currentMonth = new Date().getMonth() + 1;
    const invoicePeriod = new Date(new Date().getFullYear(), currentMonth - 1, 1);
    const currentClosingBalance = await getCurrentClosingBalance(customer.id) || 0;

    // Calculate the total invoice amount from invoiceItemsData
    const invoiceAmount = invoiceItemsData.reduce((total, item) => total + item.amount * item.quantity, 0);

    if (!invoiceAmount || invoiceAmount <= 0) {
      return res.status(400).json({ error: 'Invalid invoice amount' });
    }

    const newClosingBalance = currentClosingBalance + invoiceAmount;
    const invoiceNumber = generateInvoiceNumber(customerId);

    // Determine the invoice status based on the new closing balance
    let invoiceStatus;

    if (newClosingBalance < 0 && Math.abs(currentClosingBalance) >= invoiceAmount) {
      // Scenario: PAID - Invoice is fully paid due to overpayment or negative balance
      invoiceStatus = 'PAID';
    } else if (newClosingBalance === 0) {
      // Scenario: PAID - Fully paid, no outstanding balance
      invoiceStatus = 'PAID';
    } else if (newClosingBalance > 0 && newClosingBalance < invoiceAmount) {
      // Scenario: PPAID (Partially Paid) - Customer has partially paid
      invoiceStatus = 'PPAID';
    } else {
      // Scenario: UNPAID - Customer still owes money
      invoiceStatus = 'UNPAID';
    }

    // Create the new invoice
    const newInvoice = await prisma.invoice.create({
      data: {
        customerId,
        invoiceNumber,
        invoicePeriod,
        closingBalance: newClosingBalance,
        invoiceAmount,
        status: invoiceStatus,
        isSystemGenerated: false,
      },
    });

    // Create invoice items
    const invoiceItems = await Promise.all(
      invoiceItemsData.map(itemData =>
        prisma.invoiceItem.create({
          data: {
            invoiceId: newInvoice.id,
            description: itemData.description,
            amount: itemData.amount,
            quantity: itemData.quantity,
          },
        })
      )
    );

    // Update the customer's closing balance after creating the invoice
    await prisma.customer.update({
      where: { id: customerId },
      data: { closingBalance: newClosingBalance },
    });

    res.status(200).json({ newInvoice, invoiceItems });
  } catch (error) {
    console.error('Error creating invoice:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}


// Cancel an invoice by ID
async function cancelInvoice(invoiceId) {
  try {
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      select: {
        invoiceAmount: true,
        customerId: true,
        closingBalance: true,
        status: true,
      },
    });

    if (!invoice) throw new Error('Invoice not found');
    if (invoice.status === 'CANCELLED') return invoice;

    const currentClosingBalance = await getCurrentClosingBalance(invoice.customerId);
    const newClosingBalance = currentClosingBalance - invoice.invoiceAmount;

    const updatedInvoice = await prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        status: 'CANCELLED',
        closingBalance: newClosingBalance,
      },
    });

    await prisma.customer.update({
      where: { id: invoice.customerId },
      data: { closingBalance: newClosingBalance },
    });

    return updatedInvoice;
  } catch (error) {
    console.error('Error cancelling invoice:', error);
    throw error;
  }
}

// Cancel system-generated invoices
async function cancelSystemGeneratedInvoices() {
  try {
    const latestInvoice = await prisma.invoice.findFirst({
      where: { isSystemGenerated: true },
      orderBy: { createdAt: 'desc' },
    });

    if (!latestInvoice) return null;

    const currentClosingBalance = await getCurrentClosingBalance(latestInvoice.customerId);
    const newClosingBalance = currentClosingBalance - latestInvoice.invoiceAmount;

    const updatedInvoice = await prisma.invoice.update({
      where: { id: latestInvoice.id },
      data: {
        status: 'CANCELLED',
        closingBalance: currentClosingBalance,
      },
    });

    await prisma.customer.update({
      where: { id: latestInvoice.customerId },
      data: { closingBalance: newClosingBalance },
    });

    return updatedInvoice;
  } catch (error) {
    console.error('Error cancelling system-generated invoice:', error);
    throw error;
  }
}

// Get all invoices
async function getAllInvoices(req, res) {
  try {
    const invoices = await prisma.invoice.findMany({
      include: { customer: true, items: true },
    });

    res.json(invoices);
  } catch (error) {
    console.error('Error fetching invoices:', error);
    res.status(500).json({ error: 'Error fetching invoices' });
  }
}

// Cancel an invoice by ID (for API)
async function cancelInvoiceById(req, res) {
  const { invoiceId } = req.params;

  try {
    // Retrieve the invoice details including the customer ID and invoice amount
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      select: {
        invoiceAmount: true,
        customerId: true,
        status: true,
      },
    });

    // Check if the invoice exists and is not already cancelled
    if (!invoice) {
      return res.status(404).json({ message: 'Invoice not found' });
    }
    if (invoice.status === 'CANCELLED') {
      return res.status(400).json({ message: 'Invoice is already cancelled' });
    }

    // Retrieve the customer details to get the current closing balance
    const customer = await prisma.customer.findUnique({
      where: { id: invoice.customerId },
      select: { closingBalance: true },
    });

    if (!customer) {
      return res.status(404).json({ message: 'Customer not found' });
    }

    // Calculate the new closing balance for the customer
    const newClosingBalance = customer.closingBalance - invoice.invoiceAmount;

    // Update the invoice status to "CANCELLED"
    const updatedInvoice = await prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        status: 'CANCELLED',
      },
    });

    // Update the customer's closing balance
    await prisma.customer.update({
      where: { id: invoice.customerId },
      data: { closingBalance: newClosingBalance },
    });

    // Return a success response
    res.status(200).json({
      message: 'Invoice cancelled successfully',
      invoice: updatedInvoice,
      newClosingBalance,
    });
  } catch (error) {
    console.error('Error cancelling invoice:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}


// Scheduled job to generate invoices on the 1st of every month
schedule.scheduleJob('0 0 1 * *', async () => {
  console.log('Running scheduled job to generate invoices...');
  try {
    await generateInvoices();
  } catch (error) {
    console.error('Error during scheduled job execution:', error);
  }
});

// Get invoice details by ID
async function getInvoiceDetails(req, res) {
  const { id } = req.params;

  try {
    const invoice = await prisma.invoice.findUnique({
      where: { id },
      include: { items: true, customer: true },
    });

    if (!invoice) return res.status(404).json({ message: 'Invoice not found' });

    res.json(invoice);
  } catch (error) {
    console.error('Error fetching invoice details:', error);
    res.status(500).json({ message: 'Error fetching invoice details' });
  }
}

// Exporting all functions
module.exports = {
  createInvoice,
  generateInvoices,
  cancelInvoice,
  cancelSystemGeneratedInvoices,
  getAllInvoices,
  cancelInvoiceById,
  getInvoiceDetails,
  getCurrentClosingBalance,
  getCurrentMonthBill,
};
