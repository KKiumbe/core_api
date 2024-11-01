const axios = require('axios');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const ENDPOINT = process.env.BULK_SMS_ENDPOINT; 
const SMS_BALANCE_URL = process.env.SMS_BALANCE_URL; // URL for checking SMS balance

// Function to sanitize phone numbers
function sanitizePhoneNumber(phone) {
    if (typeof phone !== 'string') {
        console.error('Invalid phone number format:', phone);
        return '';
    }

    if (phone.startsWith('+254')) {
        return phone.slice(1); // Remove '+'
    } else if (phone.startsWith('0')) {
        return `254${phone.slice(1)}`; // Replace '0' with '254'
    } else if (phone.startsWith('254')) {
        return phone; // Already in the correct format
    } else {
        return `254${phone}`; // Add '254' for other formats
    }
}

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

// Function to send bulk SMS
const sendBulkSMS = async (customers) => {
    try {
        const smsList = customers.map(customer => {
            const mobile = sanitizePhoneNumber(customer.phoneNumber);
            if (!mobile) {
                console.error(`Skipping invalid phone number for customer ${customer.firstName}:`, customer.phoneNumber);
                return null; // Skip customers with invalid phone numbers
            }

            return {
                partnerID: process.env.PARTNER_ID,
                apikey: process.env.SMS_API_KEY,
                pass_type: "plain",
                clientsmsid: Math.floor(Math.random() * 10000),
                mobile: mobile,
                message: customer.message,
                shortcode: process.env.SHORTCODE,
            };
        });

        const filteredSmsList = smsList.filter(sms => sms !== null);

        if (filteredSmsList.length > 0) {
            const response = await axios.post(ENDPOINT, {
                count: filteredSmsList.length,
                smslist: filteredSmsList,
            });

            console.log(`Sent ${filteredSmsList.length} bulk SMS messages.`);
            return response.data;
        } else {
            console.log('No valid customers to send SMS.');
            return null;
        }
    } catch (error) {
        console.error('Error sending SMS:', error);
        throw new Error('SMS sending failed');
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
            customer.closingBalance >= customer.monthlyCharge * 0.15 // 15% of monthly charge
        );

        const customersWithMessages = unpaidCustomers.map(customer => ({
            ...customer,
            message: `Dear ${customer.firstName}, you have an outstanding balance of ${customer.closingBalance.toFixed(2)}. Please pay your dues.`,
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
            message: `Dear ${customer.firstName}, your current balance is low at ${customer.closingBalance.toFixed(2)}. Please top up soon.`,
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
            customer.closingBalance > customer.monthlyCharge * 2
        );

        const customersWithMessages = highBalanceCustomers.map(customer => ({
            ...customer,
            message: `Dear ${customer.firstName}, thank you for your timely payments! Your current balance is ${customer.closingBalance.toFixed(2)}.`,
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
