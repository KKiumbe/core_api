const axios = require('axios'); // Assuming axios is used for making the HTTP requests
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const BULK_SMS_ENDPOINT = process.env.BULK_SMS_ENDPOINT; 

// Function to send bulk SMS
const sendBulkSMS = async (customers) => {
  try {
    const smsList = customers.map(customer => {
      const mobile = customer.phoneNumber;
      if (!mobile) return null;

      return {
        partnerID: process.env.PARTNER_ID,
        apikey: process.env.SMS_API_KEY,
        pass_type: "plain",
        clientsmsid: Math.floor(Math.random() * 10000),
        mobile: mobile,
        message: customer.message, // Use the pre-built message
        shortcode: process.env.SHORTCODE,
      };
    });

    const filteredSmsList = smsList.filter(sms => sms !== null);

    if (filteredSmsList.length > 0) {
      const response = await axios.post(BULK_SMS_ENDPOINT, {
        count: filteredSmsList.length,
        smslist: filteredSmsList,
      });

      console.log(`Sent ${filteredSmsList.length} bulk SMS messages.`);
      return response.data;
    } else {
      console.log('No customers to send SMS.');
      return null;
    }
  } catch (error) {
    console.error('Error sending SMS:', error);
    throw new Error('SMS sending failed');
  }
};

// Function to send SMS to unpaid customers
export const sendUnpaidCustomers = async () => {
  try {
    const activeCustomers = await prisma.customer.findMany({
      where: { status: 'ACTIVE' },
      select: {
        phoneNumber: true,
        firstName: true,
        lastName: true,
        closingBalance: true,
        monthlyCharge: true,
      },
    });

    const unpaidCustomers = activeCustomers.filter(customer => 
      customer.closingBalance >= customer.monthlyCharge * 0.15 // 15% of monthly charge
    );

    const customersWithMessages = unpaidCustomers.map(customer => ({
      ...customer,
      message: `Dear ${customer.firstName}, you have an outstanding balance of ${customer.closingBalance.toFixed(2)}. Please pay your dues.`,
    }));

    if (customersWithMessages.length > 0) {
      await sendBulkSMS(customersWithMessages);
    }
  } catch (error) {
    console.error('Error fetching unpaid customers:', error);
  }
};

// Function to send SMS to low balance customers
export const sendLowBalanceCustomers = async () => {
  try {
    const activeCustomers = await prisma.customer.findMany({
      where: { status: 'ACTIVE' },
      select: {
        phoneNumber: true,
        firstName: true,
        lastName: true,
        closingBalance: true,
        monthlyCharge: true,
      },
    });

    const lowBalanceCustomers = activeCustomers.filter(customer => 
      customer.closingBalance < customer.monthlyCharge
    );

    const customersWithMessages = lowBalanceCustomers.map(customer => ({
      ...customer,
      message: `Dear ${customer.firstName}, your current balance is low at ${customer.closingBalance.toFixed(2)}. Please top up soon.`,
    }));

    if (customersWithMessages.length > 0) {
      await sendBulkSMS(customersWithMessages);
    }
  } catch (error) {
    console.error('Error fetching low balance customers:', error);
  }
};

// Function to send SMS to high balance customers
export const sendHighBalanceCustomers = async () => {
  try {
    const activeCustomers = await prisma.customer.findMany({
      where: { status: 'ACTIVE' },
      select: {
        phoneNumber: true,
        firstName: true,
        lastName: true,
        closingBalance: true,
        monthlyCharge: true,
      },
    });

    const highBalanceCustomers = activeCustomers.filter(customer => 
      customer.closingBalance > customer.monthlyCharge * 2
    );

    const customersWithMessages = highBalanceCustomers.map(customer => ({
      ...customer,
      message: `Dear ${customer.firstName}, thank you for your timely payments! Your current balance is ${customer.closingBalance.toFixed(2)}.`,
    }));

    if (customersWithMessages.length > 0) {
      await sendBulkSMS(customersWithMessages);
    }
  } catch (error) {
    console.error('Error fetching high balance customers:', error);
  }
};

// Function to send SMS to all customers
export const sendToAllCustomers = async () => {
  try {
    const activeCustomers = await prisma.customer.findMany({
      where: { status: 'ACTIVE' },
      select: {
        phoneNumber: true,
        firstName: true,
        lastName: true,
        closingBalance: true,
      },
    });

    const customersWithMessages = activeCustomers.map(customer => ({
      ...customer,
      message: `Dear ${customer.firstName}, we hope you are enjoying our service! Your current balance is ${customer.closingBalance.toFixed(2)}.`,
    }));

    if (customersWithMessages.length > 0) {
      await sendBulkSMS(customersWithMessages);
    }
  } catch (error) {
    console.error('Error fetching all customers:', error);
  }
};
