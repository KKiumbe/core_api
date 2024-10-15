const { PrismaClient } = require('@prisma/client');
const schedule = require('node-schedule'); // Import node-schedule
const invoiceQueue = require('./jobFunction.js');
const prisma = new PrismaClient();

// queue.js



// Function to generate a unique invoice number
function generateInvoiceNumber(customerId) {
  const invoiceSuffix = Math.floor(Math.random() * 10000).toString().padStart(3, '0');
  return `INV${invoiceSuffix}-${customerId}`; // Optionally include customerId for uniqueness
}

async function getCurrentClosingBalance(customerId) {
  try {
    const latestInvoice = await prisma.invoice.findFirst({
      where: {
        customerId: customerId,
      },
      orderBy: {
        createdAt: 'desc', // Get the most recent invoice
      },
      select: {
        closingBalance: true, // Only select the closing balance
      },
    });

    return latestInvoice ? latestInvoice.closingBalance : 0; // Return the balance or 0 if no invoices exist
  } catch (error) {
    console.error('Error fetching closing balance:', error);
    throw error; // Handle the error as per your requirements
  }
}

// Helper function to get the current month's bill (monthly charge)
async function getCurrentMonthBill(customerId) {
  try {
    const customer = await prisma.customer.findUnique({ where: { id: customerId } });
    return customer ? customer.monthlyCharge : 0; // Return the monthly charge or 0 if customer not found
  } catch (error) {
    console.error('Error fetching current month bill:', error);
    throw error;
  }
}

async function generateInvoices() {
  const currentMonth = new Date().getMonth() + 1;

  try {
    const customers = await prisma.customer.findMany({
      where: {
        status: 'ACTIVE',
      },
    });

    console.log(`Found ${customers.length} active customers.`);

    const invoices = await Promise.all(
      customers.map(async (customer) => {
        try {
          console.log(`Processing customer ID: ${customer.id}`);

          const invoiceNumber = generateInvoiceNumber(customer.id);
          const invoicePeriod = new Date(new Date().getFullYear(), currentMonth - 1, 1);
          
          // Fetch the closing balance directly from the database
          const currentClosingBalance = await getCurrentClosingBalance(customer.id);
          console.log(`Current closing balance for customer ID ${customer.id}: ${currentClosingBalance}`);

          const currentMonthBill = await getCurrentMonthBill(customer.id); // Using the monthlyCharge
          console.log(`Current month bill for customer ID ${customer.id}: ${currentMonthBill}`);

          const invoiceAmount = currentMonthBill;
          const newClosingBalance = currentClosingBalance + invoiceAmount;

          // Create the new invoice
          const newInvoice = await prisma.invoice.create({
            data: {
              customerId: customer.id,
              invoiceNumber: invoiceNumber,
              invoicePeriod: invoicePeriod,
              closingBalance: newClosingBalance,
              invoiceAmount: invoiceAmount,
              status: 'UNPAID',
              isSystemGenerated: true,
            },
          });

          // Create invoice items
          await prisma.invoiceItem.create({
            data: {
              invoiceId: newInvoice.id,
              description: 'Monthly Charge',
              amount: currentMonthBill,
              quantity: 1,
            },
          });

          console.log(`System-generated Invoice ${newInvoice.invoiceNumber} created for ${customer.firstName} ${customer.lastName}.`);

          // **Update the customer's closing balance in the Customer collection**
          await prisma.customer.update({
            where: { id: customer.id },
            data: {
              closingBalance: newClosingBalance, // Update closing balance in Customer collection
            },
          });

          return newInvoice;
        } catch (error) {
          console.error(`Error processing customer ID ${customer.id}:`, error);
          throw error; // Re-throw error to handle in outer scope if needed
        }
      })
    );

    console.log(`Generated ${invoices.length} invoices.`);
    return invoices;
  } catch (error) {
    console.error('Error generating invoices for all customers:', error);
    throw error;
  }
}




async function createInvoice(req, res) {
  const { customerId, invoiceItemsData } = req.body;

  try {
    // Ensure customer exists
    const customer = await prisma.customer.findUnique({ where: { id: customerId } });
    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    const currentMonth = new Date().getMonth() + 1;
    const invoicePeriod = new Date(new Date().getFullYear(), currentMonth - 1, 1);

    // Fetch current closing balance and ensure it's valid
    let currentClosingBalance = await getCurrentClosingBalance(customer.id);
    if (isNaN(currentClosingBalance)) {
      currentClosingBalance = 0; // Treat as 0 for new clients
    }

    // Use the customer's monthly charge as the invoice amount
    const invoiceAmount = customer.monthlyCharge; // Directly from the Customer model
    if (isNaN(invoiceAmount) || invoiceAmount <= 0) {
      return res.status(400).json({ error: 'Invalid invoice amount' });
    }

    // Calculate the new closing balance (add invoiceAmount to currentClosingBalance)
    const newClosingBalance = currentClosingBalance + invoiceAmount;

    // Generate unique invoice number
    const invoiceNumber = generateInvoiceNumber(customerId);

    // Create the new invoice
    const newInvoice = await prisma.invoice.create({
      data: {
        customerId: customer.id,
        invoiceNumber: invoiceNumber,
        invoicePeriod: invoicePeriod,
        closingBalance: newClosingBalance,
        invoiceAmount: invoiceAmount, // Use monthly charge as invoice amount
        status: 'UNPAID',
        isSystemGenerated: false,
      },
    });

    // Create invoice items using the customer's monthly charge
    const invoiceItems = await Promise.all(
      invoiceItemsData.map(itemData =>
        prisma.invoiceItem.create({
          data: {
            invoiceId: newInvoice.id,
            description: itemData.description,
            amount: invoiceAmount, // Use monthly charge as the amount for the invoice item
            quantity: 1, // Assuming a single item for the monthly charge
          },
        })
      )
    );

    // **Update the customer's closing balance**
    await prisma.customer.update({
      where: { id: customerId },
      data: {
        closingBalance: newClosingBalance, // Update closing balance in the Customer collection
      },
    });

    return res.status(200).json({ newInvoice, invoiceItems });
  } catch (error) {
    console.error('Error creating invoice:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}





async function cancelInvoice(invoiceId) {
  try {
    // Fetch the invoice and associated customer details
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      select: {
        invoiceAmount: true,
        customerId: true,
        closingBalance: true,
        status: true, // To check if it's already cancelled
      },
    });

    // Check if the invoice exists
    if (!invoice) {
      console.log(`Invoice with ID ${invoiceId} not found.`);
      throw new Error('Invoice not found');
    }

    // If the invoice is already cancelled, no further action is required
    if (invoice.status === 'CANCELLED') {
      console.log(`Invoice ID ${invoiceId} is already cancelled.`);
      return invoice;
    }

    // Fetch the current closing balance for the customer
    const currentClosingBalance = await getCurrentClosingBalance(invoice.customerId);

    // Calculate the new closing balance after cancelling the invoice
    const newClosingBalance = currentClosingBalance - invoice.invoiceAmount;

    // Update the invoice status to 'CANCELLED' and adjust the closing balance in the invoice
    const updatedInvoice = await prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        status: 'CANCELLED',
        closingBalance: newClosingBalance, // Adjust closing balance for the invoice
      },
    });

    // **Update the customer's closing balance in the Customer collection**
    await prisma.customer.update({
      where: { id: invoice.customerId },
      data: {
        closingBalance: newClosingBalance, // Update closing balance in Customer collection
      },
    });

    console.log(`Invoice ${updatedInvoice.invoiceNumber} has been cancelled and customer balance updated.`);
    return updatedInvoice;
  } catch (error) {
    console.error('Error cancelling invoice:', error);
    throw error;
  }
}


async function cancelSystemGeneratedInvoices() {
  try {
    // Find the latest system-generated invoice
    const latestInvoice = await prisma.invoice.findFirst({
      where: {
        isSystemGenerated: true,
      },
      orderBy: {
        createdAt: 'desc', // Get the latest invoice
      },
    });

    if (!latestInvoice) {
      console.log('No system-generated invoices found.');
      return null;
    }

    console.log(`Latest system-generated invoice found: ID ${latestInvoice.id}, Amount ${latestInvoice.invoiceAmount}`);

    // Fetch the current closing balance for the customer
    const currentClosingBalance = await getCurrentClosingBalance(latestInvoice.customerId);

    // Calculate the new closing balance after cancelling the invoice
    const newClosingBalance = currentClosingBalance - latestInvoice.invoiceAmount;
    console.log(`New calculated closing balance: ${currentClosingBalance} - ${latestInvoice.invoiceAmount} = ${newClosingBalance}`);

    // Update the found invoice's status to CANCELLED and adjust its closing balance
    const updatedInvoice = await prisma.invoice.update({
      where: { id: latestInvoice.id },
      data: {
        status: 'CANCELLED', // Change status to 'CANCELLED'
        closingBalance: newClosingBalance, // Adjust closing balance for the invoice
      },
    });

    // **Update the customer's closing balance in the Customer collection**
    await prisma.customer.update({
      where: { id: latestInvoice.customerId },
      data: {
        closingBalance: newClosingBalance, // Update closing balance in Customer collection
      },
    });

    console.log(`System-generated invoice ID ${updatedInvoice.id} has been cancelled and customer balance updated.`);
    return updatedInvoice;
  } catch (error) {
    console.error('Error cancelling system-generated invoice:', error);
    throw error;
  }
}




// Function to get all invoices
async function getAllInvoices(req, res) {
  try {
    const invoices = await prisma.invoice.findMany({
      include: {
        customer: true, // Include related customer
        items: true,    // Include related items
      },
    });

    return res.json(invoices);
  } catch (error) {
    console.error('Error fetching invoices:', error);
    return res.status(500).json({ error: 'Error fetching invoices' });
  }
}

async function cancelInvoiceById(req, res) {
  // Extract invoiceId from request parameters
  const { invoiceId } = req.params;

  try {
    // Fetch the invoice to get the amount and customer ID
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      select: {
        invoiceAmount: true,
        customerId: true,
        closingBalance: true,
        status: true, // Ensure we get the status for validation
      },
    });

    // Check if invoice exists
    if (!invoice) {
      return res.status(404).json({ message: 'Invoice not found' });
    }

    // Check if invoice is already cancelled
    if (invoice.status === 'CANCELLED') {
      return res.status(400).json({ message: 'Invoice is already cancelled' });
    }

    // Calculate the new closing balance
    const newClosingBalance = invoice.closingBalance - invoice.invoiceAmount;

    // Update the invoice status to 'CANCELLED'
    const updatedInvoice = await prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        status: 'CANCELLED', // Change status to 'CANCELLED'
        closingBalance: newClosingBalance, // Update the closing balance
      },
    });

    console.log(`Invoice ${updatedInvoice.id} has been cancelled.`);
    return res.status(200).json({ message: 'Invoice cancelled successfully', invoice: updatedInvoice });
  } catch (error) {
    console.error('Error cancelling invoice:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}


// Schedule to run the invoice generation job
schedule.scheduleJob('0 0 1 * *', async () => {
  console.log('Running scheduled job to generate invoices...');
  try {
    await generateInvoices();
  } catch (error) {
    console.error('Error during scheduled job execution:', error);
  }
});



const getInvoiceDetails = async (req, res) => {
  const { id } = req.params; // Retrieve the invoice ID from the request parameters

  try {
    const invoice = await prisma.invoice.findUnique({
      where: { id: id }, // Match the invoice by ID
      include: {
        items: true, // Include related invoice items
        customer: true, // Include related customer information
      },
    });

    // Check if the invoice exists
    if (!invoice) {
      return res.status(404).json({ message: 'Invoice not found' });
    }

    res.json(invoice); // Send the invoice details as a response
  } catch (error) {
    console.error('Error fetching invoice details:', error);
    res.status(500).json({ message: 'Error fetching invoice details' });
  }
};

module.exports = { getInvoiceDetails };


// Export functions for use in other files
module.exports = {
  createInvoice,
  generateInvoices,
  cancelInvoice,
  cancelSystemGeneratedInvoices,
  getAllInvoices,

  cancelInvoiceById,
  getInvoiceDetails,
  getCurrentClosingBalance,
  getCurrentMonthBill
};
