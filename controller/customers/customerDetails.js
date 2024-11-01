// controllers/customerController.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const getCustomerDetails = async (req, res) => {
  const { id } = req.params;

  try {
    const customer = await prisma.customer.findUnique({
      where: { id },
      include: {
        invoices: {
          orderBy: { createdAt: 'desc' },
          include: {
            items: true,  // Include invoice items
            receiptInvoices: {
              include: {
                receipt: true
              }
            }
          }
        },
        receipts: {
          orderBy: { createdAt: 'desc' },
          include: {
            payment: true  // Include linked payment details
          }
        }
      }
    });

    if (!customer) {
      return res.status(404).json({ message: 'Customer not found' });
    }

    res.status(200).json(customer);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error retrieving customer details' });
  }
};

module.exports = {
  getCustomerDetails,
};
