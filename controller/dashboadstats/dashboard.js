// controllers/dashboardController.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const getDashboardStats = async (req, res) => {
  try {
    // Fetch all active customers with their monthly charge and closing balance
    const activeCustomers = await prisma.customer.findMany({
      where: {
        status: 'ACTIVE', // Only fetch active customers
      },
      include: {
        invoices: true, // Include invoices for status checks
      },
    });

    // Calculate statistics based on the active customer data
    const paidCustomers = activeCustomers.filter(customer => 
      customer.closingBalance < 0 // Customers whose closing balance is less than zero
    ).length;

    const unpaidCustomers = activeCustomers.filter(customer => 
      customer.closingBalance >= customer.monthlyCharge // Customers with closing balance greater than or equal to monthly charge
    ).length;

    const lowBalanceCustomers = activeCustomers.filter(customer => 
      customer.closingBalance < customer.monthlyCharge // Customers with closing balance less than their monthly charge
    ).length;

    const highBalanceCustomers = activeCustomers.filter(customer => 
      customer.closingBalance > customer.monthlyCharge * 2 // Customers with closing balance more than twice their monthly charge
    ).length;

    const totalCustomers = activeCustomers.length; // Count of active customers

    const overdueCustomers = activeCustomers.filter(customer => 
      customer.invoices.filter(invoice => 
        invoice.status === 'UNPAID'
      ).length > 2 // Customers with more than 2 unpaid invoices
    ).length;

    // Send the response
    res.status(200).json({
      success: true,
      data: {
        paidCustomers,
        unpaidCustomers,
        lowBalanceCustomers,
        highBalanceCustomers,
        totalCustomers,
        overdueCustomers,
      },
    });
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch dashboard stats.' });
  } finally {
    await prisma.$disconnect();
  }
};

module.exports = {
  getDashboardStats,
};
