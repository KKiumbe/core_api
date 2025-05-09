const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const ENDPOINT = process.env.BULK_SMS_ENDPOINT;
const SMS_BALANCE_URL = process.env.SMS_BALANCE_URL; // URL for checking SMS balance

// Function to check SMS balance
const checkSmsBalance = async () => {
    try {
        const response = await axios.post(SMS_BALANCE_URL, {
            apikey: process.env.SMS_API_KEY,
            partnerID: process.env.PARTNER_ID,
        });
        return response.data.balance; // Adjust based on actual API response structure
    } catch (error) {
        console.error('Error fetching SMS balance:', error);
        throw new Error('Failed to retrieve SMS balance');
    }
};



const sendBulkSMS = async (customers) => {
    try {
      const smsList = await Promise.all(
        customers.map(async (customer) => {
          if (!customer.id) {
            throw new Error(`Missing customer ID for customer: ${JSON.stringify(customer)}`);
          }
  
          const clientsmsid = uuidv4();
          //console.log(`Generated clientsmsid: ${clientsmsid}`);
  
          // Save each SMS to the database with status "pending"
          await prisma.sMS.create({
            data: {
              clientsmsid,
              customerId: customer.id, // Ensure this field is correctly passed
              mobile: sanitizePhoneNumber(customer.phoneNumber),
              message: customer.message,
              status: "pending",
            },
          });
  
          // Return SMS data for API request
          return {
            partnerID: process.env.PARTNER_ID,
            apikey: process.env.SMS_API_KEY,
            pass_type: "plain",
            clientsmsid,
            mobile: sanitizePhoneNumber(customer.phoneNumber),
            message: customer.message,
            shortcode: process.env.SHORTCODE,
          };
        })
      );
  
      if (smsList.length > 0) {
        const response = await axios.post(ENDPOINT, {
          count: smsList.length,
          smslist: smsList,
        });
  
        if (response.data.success) {
          const sentIds = smsList.map((sms) => sms.clientsmsid);
  
          // Update the SMS status to "sent" in the database
          await prisma.sMS.updateMany({
            where: { clientsmsid: { in: sentIds } },
            data: { status: "sent" },
          });
  
          //console.log(`Updated status to 'sent' for ${sentIds.length} SMS records.`);
        }
  
        //console.log(`Sent ${smsList.length} bulk SMS messages.`);
        return response.data;
      } else {
        console.log("No valid customers to send SMS.");
        return null;
      }
    } catch (error) {
      console.error("Error sending SMS:", error);
      throw new Error("SMS sending failed");
    }
  };
  





// Function to send SMS to unpaid customers
const sendUnpaidCustomers = async (req, res) => {
    try {
        const activeCustomers = await prisma.customer.findMany({
            where: { status: 'ACTIVE' },
            select: {
                phoneNumber: true,
                firstName: true,
                closingBalance: true,
                monthlyCharge: true,
            },
        });

        const unpaidCustomers = activeCustomers.filter(customer => 
            customer.closingBalance > 0 
        );

        const customersWithMessages = unpaidCustomers.map(customer => ({
            ...customer,
            message: `Dear ${customer.firstName}, you have an outstanding balance of ${customer.closingBalance.toFixed(2)}. Help us serve you better by always paying on time. Paybill No: 4107197, use your phone number as the account number. Customer support: 0726594923`,
        }));

        const balance = await checkSmsBalance(); // Check balance before sending
        if (balance < unpaidCustomers.length * 2) { // Ensure balance is at least twice the number of customers
            console.log('Insufficient SMS balance for unpaid customers. Requires at least twice the number of customers.');
            return res.status(500).json({ message: 'Insufficient SMS balance.' });
        }

        if (customersWithMessages.length > 0) {
            await sendBulkSMS(customersWithMessages);
            return res.status(200).json({ message: 'SMS sent to unpaid customers.' });
        } else {
            return res.status(404).json({ message: 'No unpaid customers found.' });
        }
    } catch (error) {
        console.error('Error fetching unpaid customers:', error);
        return res.status(500).json({ message: 'Failed to send SMS to unpaid customers.' });
    }
};

// Function to send SMS to low balance customers
const sendLowBalanceCustomers = async (req, res) => {
    try {
        const activeCustomers = await prisma.customer.findMany({
            where: { status: 'ACTIVE' },
            select: {
                phoneNumber: true,
                firstName: true,
                closingBalance: true,
                monthlyCharge: true,
            },
        });

        const lowBalanceCustomers = activeCustomers.filter(customer => 
            customer.closingBalance < customer.monthlyCharge
        );

        const customersWithMessages = lowBalanceCustomers.map(customer => ({
            ...customer,
            message: `Dear ${customer.firstName}, your balance is ${customer.closingBalance.toFixed(2)}. Help us serve you better by always paying on time. Paybill No: 4107197, use your phone number as the account number. Customer support: 0726594923.`,
        }));

        const balance = await checkSmsBalance(); // Check balance before sending
        if (balance < lowBalanceCustomers.length * 2) {
            console.log('Insufficient SMS balance for low balance customers. Requires at least twice the number of customers.');
            return res.status(500).json({ message: 'Insufficient SMS balance.' });
        }

        if (customersWithMessages.length > 0) {
            await sendBulkSMS(customersWithMessages);
            return res.status(200).json({ message: 'SMS sent to low balance customers.' });
        } else {
            return res.status(404).json({ message: 'No low balance customers found.' });
        }
    } catch (error) {
        console.error('Error fetching low balance customers:', error);
        return res.status(500).json({ message: 'Failed to send SMS to low balance customers.' });
    }
};

// Function to send SMS to high balance customers
const sendHighBalanceCustomers = async (req, res) => {
    try {
        const activeCustomers = await prisma.customer.findMany({
            where: { status: 'ACTIVE' },
            select: {
                phoneNumber: true,
                firstName: true,
                closingBalance: true,
                monthlyCharge: true,
            },
        });

        const highBalanceCustomers = activeCustomers.filter(customer => 
            customer.closingBalance > customer.monthlyCharge * 1.5
        );

        const customersWithMessages = highBalanceCustomers.map(customer => ({
            ...customer,
            message: `Dear ${customer.firstName}, your current balance is ${customer.closingBalance.toFixed(2)}, which is quite high. Help us serve you better by always paying on time. Paybill No: 4107197, use your phone number as the account number. Customer support: 0726594923`,
        }));

        const balance = await checkSmsBalance(); // Check balance before sending
        if (balance < highBalanceCustomers.length * 2) {
            console.log('Insufficient SMS balance for high balance customers. Requires at least twice the number of customers.');
            return res.status(500).json({ message: 'Insufficient SMS balance.' });
        }

        if (customersWithMessages.length > 0) {
            await sendBulkSMS(customersWithMessages);
            return res.status(200).json({ message: 'SMS sent to high balance customers.' });
        } else {
            return res.status(404).json({ message: 'No high balance customers found.' });
        }
    } catch (error) {
        console.error('Error fetching high balance customers:', error);
        return res.status(500).json({ message: 'Failed to send SMS to high balance customers.' });
    }
};

module.exports = {
    sendHighBalanceCustomers,
    sendLowBalanceCustomers,
    sendUnpaidCustomers,
};
