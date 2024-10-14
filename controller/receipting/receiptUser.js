const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Function to search for receipts
const searchReceipts = async (req, res) => {
  const { name, phone } = req.query; // Extracting query parameters

  try {
    let whereClause = {
      // Default to an empty object, which returns all receipts if no parameters
    };

    if (name || phone) {
      whereClause = {
        OR: [
          { customer: { firstName: { contains: name, mode: 'insensitive' } } },
          { customer: { lastName: { contains: name, mode: 'insensitive' } } },
          { customer: { phoneNumber: { contains: phone, mode: 'insensitive' } } },
        ],
      };
    }

    // Fetch receipts based on the constructed where clause
    const receipts = await prisma.receipt.findMany({
      where: whereClause,
      include: {
        customer: true, // Include customer details if needed
        invoice: true,  // Include invoice details if needed
      },
      orderBy: {
        createdAt: 'desc', // Order by the most recent receipts first
      },
    });

    res.status(200).json(receipts);
  } catch (error) {
    console.error('Error fetching receipts:', error);
    res.status(500).json({ error: 'Failed to fetch receipts.' });
  }
};

// Receipting function to settle invoices
const receiptUser = async (req, res) => {
  const { customerId, amountPaid } = req.body;

  try {
    // Fetch unpaid invoices for the customer ordered by creation date (oldest first)
    const unpaidInvoices = await prisma.invoice.findMany({
      where: {
        customerId: customerId, // match customer
        status: 'UNPAID',       // only unpaid invoices
      },
      orderBy: {
        createdAt: 'asc',        // order by oldest invoices
      },
    });

    if (!unpaidInvoices.length) {
      return res.status(404).json({ message: 'No unpaid invoices found for this customer.' });
    }

    let remainingAmount = amountPaid;

    for (let invoice of unpaidInvoices) {
      if (remainingAmount <= 0) break; // Stop if no remaining amount to settle

      if (remainingAmount >= invoice.closingBalance) {
        // Fully settle the invoice
        remainingAmount -= invoice.closingBalance;
        await prisma.invoice.update({
          where: { id: invoice.id },
          data: {
            status: 'PAID',
            closingBalance: 0,
          },
        });
      } else {
        // Partially settle the invoice
        await prisma.invoice.update({
          where: { id: invoice.id },
          data: {
            closingBalance: invoice.closingBalance - remainingAmount,
          },
        });
        remainingAmount = 0;
      }
    }

    res.status(200).json({ message: 'Invoices settled successfully!' });
  } catch (error) {
    console.error('Error settling invoices:', error);
    res.status(500).json({ error: 'Failed to settle invoices.' });
  }
};

// Get unpaid invoices for a customer
const getUnpaidInvoices = async (req, res) => {
  const { customerId } = req.params;

  try {
    // Fetch unpaid invoices for the given customer, ordered by creation date (oldest first)
    const unpaidInvoices = await prisma.invoice.findMany({
      where: {
        customerId: customerId,  // Match customer ID
        status: 'UNPAID',        // Only unpaid invoices
      },
      orderBy: {
        createdAt: 'asc',        // Order by oldest first
      },
    });

    // If no unpaid invoices found
    if (unpaidInvoices.length === 0) {
      return res.status(404).json({ message: 'No unpaid invoices found for this customer.' });
    }

    res.status(200).json(unpaidInvoices);
  } catch (error) {
    console.error('Error fetching unpaid invoices:', error);
    res.status(500).json({ error: 'Failed to fetch unpaid invoices.' });
  }
};

module.exports = { receiptUser, getUnpaidInvoices, searchReceipts };
