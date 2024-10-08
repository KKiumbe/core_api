const { PrismaClient } = require('@prisma/client');
const schedule = require('node-schedule'); // Import node-schedule
const prisma = new PrismaClient();

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

          const currentMonthBill = await getCurrentMonthBill(customer.id);
          console.log(`Current month bill for customer ID ${customer.id}: ${currentMonthBill}`);

          const invoiceAmount = currentMonthBill;
          const newClosingBalance = currentClosingBalance + invoiceAmount;

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

          await prisma.invoiceItem.create({
            data: {
              invoiceId: newInvoice.id,
              description: 'Monthly Charge',
              amount: currentMonthBill,
              quantity: 1,
            },
          });

          console.log(`System-generated Invoice ${newInvoice.invoiceNumber} created for ${customer.firstName} ${customer.lastName}.`);
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

    // Calculate total invoice amount from the items
    const invoiceAmount = invoiceItemsData.reduce((total, item) => total + (item.amount * item.quantity), 0);
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
        invoiceAmount: invoiceAmount, // Calculated total invoice amount
        status: 'UNPAID',
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

    return res.status(200).json({ newInvoice, invoiceItems });
  } catch (error) {
    console.error('Error creating invoice:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}





// Function to cancel an invoice
async function cancelInvoice(invoiceId) {
  try {
    const invoice = await prisma.invoice.update({
      where: { id: invoiceId },
      data: { status: 'CANCELLED' }, // Update the status to Cancelled
    });

    console.log(`Invoice ${invoice.invoiceNumber} has been cancelled.`);
    return invoice;
  } catch (error) {
    console.error('Error cancelling invoice:', error);
    throw error;
  }
}


async function cancelSystemGeneratedInvoices(customerId) {
  try {
 

    const latestInvoice = await prisma.invoice.findFirst({
      where: {
        isSystemGenerated: true,
      },
      orderBy: {
        createdAt: 'desc', // Order by creation date to get the latest invoice
      },
    });

    if (!latestInvoice) {
      console.log(`No system-generated invoices found for customer ID ${customerId} created last month.`);
      return null;
    }

    // Update the found invoice's status to CANCELLED
    const updatedInvoice = await prisma.invoice.update({
      where: { id: latestInvoice.id },
      data: {
        status: 'CANCELLED', // Change status to CANCELLED
      },
    });

    console.log(`Updated invoice ID ${updatedInvoice.id} to CANCELLED for customer ID ${customerId}.`);
    return updatedInvoice;
  } catch (error) {
    console.error('Error updating the latest system-generated invoice:', error);
    throw error; // Re-throw the error for further handling
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


// Controller to cancel an invoice by ID
const cancelInvoiceById = async (req, res) => {
  const { id } = req.params;

  try {
    const invoice = await prisma.invoice.update({
      where: { id: id }, // Use the correct type for MongoDB ObjectId
      data: { status: 'CANCELLED' }, // Update status to 'CANCELLED'
      include: { customer: true }, // Include customer details in the response
    });

    return res.status(200).json({ message: 'Invoice cancelled successfully', invoice });
  } catch (error) {
    if (error.code === 'P2025') { // Prisma error code for "Record to update not found"
      return res.status(404).json({ message: 'Invoice not found' });
    }
    console.error('Error cancelling invoice:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};


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
  getInvoiceDetails
};
