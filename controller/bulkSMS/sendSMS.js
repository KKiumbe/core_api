const axios = require('axios'); // Assuming axios is used for making the HTTP requests
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function generateBulkBillSmsMessage() {
  const ENDPOINT = process.env.BULK_SMS_ENDPOINT;

  try {
    // Fetch active customers
    const activeCustomers = await prisma.customer.findMany({
      where: {
        status: 'ACTIVE'
      }
    });

    // Prepare the bulk SMS request body
    const smsList = await Promise.all(
      activeCustomers.map(async (customer) => {
        // Fetch latest invoice for the customer
        const latestInvoice = await prisma.invoice.findFirst({
          where: {
            customerId: customer.id
          },
          orderBy: {
            createdAt: 'desc' // Get the most recent invoice
          }
        });

        // If no invoice exists, skip sending an SMS for this customer
        if (!latestInvoice) {
          return null;
        }

        // Prepare message content
        const currentMonthBill = latestInvoice.invoiceAmount;
        const closingBalance = latestInvoice.closingBalance;
        const customerName = `${customer.firstName} ${customer.lastName}`;
        const month = new Date().toLocaleString('default', { month: 'long' });

        // Format phone number
        const mobile = customer.phoneNumber.startsWith('0')
          ? `254${customer.phoneNumber.slice(1)}` // If it starts with '0', replace it with '254'
          : customer.phoneNumber.startsWith('+')
          ? customer.phoneNumber.slice(1) // If it starts with '+', remove the '+'
          : customer.phoneNumber; // Otherwise, use the number as-is

        const message = `Dear ${customerName}, your ${month} bill is ${currentMonthBill}, your previous balance is ${closingBalance - currentMonthBill}, and your total balance is ${closingBalance}. Pay via Paybill number 89354, account number is your phone number.`;

        return {
          partnerID: process.env.PARTNER_ID, // Replace with actual partnerID
          apikey: process.env.SMS_API_KEY, // Replace with actual API key
          pass_type: "plain",
          clientsmsid: Math.floor(Math.random() * 10000), // Unique client SMS ID
          mobile: mobile, // Use the formatted mobile number
          message: message,
          shortcode: process.env.SHORTCODE,
        };
      })
    );

    // Filter out any null results (customers without invoices)
    const filteredSmsList = smsList.filter(sms => sms !== null);

    // Send the bulk SMS
    if (filteredSmsList.length > 0) {
      const response = await axios.post(`${ENDPOINT}`, {
        count: filteredSmsList.length,
        smslist: filteredSmsList
      });

      console.log(`Sent ${filteredSmsList.length} bulk SMS messages.`);
      return response.data;
    } else {
      console.log('No active customers with invoices to send SMS.');
      return null;
    }
  } catch (error) {
    console.error('Error generating bulk SMS:', error);
    throw error;
  }
}

module.exports = { generateBulkBillSmsMessage };
