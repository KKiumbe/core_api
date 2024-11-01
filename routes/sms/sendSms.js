const express = require('express');
const { PrismaClient } = require('@prisma/client');
const axios = require('axios');

const prisma = new PrismaClient();
const router = express.Router();

// Load environment variables
const SMS_API_KEY = process.env.SMS_API_KEY;
const PARTNER_ID = process.env.PARTNER_ID;
const SHORTCODE = process.env.SHORTCODE;
const BULK_SMS_ENDPOINT = process.env.BULK_SMS_ENDPOINT;
const SMS_ENDPOINT = process.env.SMS_ENDPOINT;


const SMS_BALANCE_URL = process.env.SMS_BALANCE_URL;

// Function to check SMS balance
const checkSmsBalance = async () => {
    try {
        const response = await axios.post(SMS_BALANCE_URL, {
            apikey: SMS_API_KEY,
            partnerID: PARTNER_ID
        });
        return response.data.balance; // Adjust this based on actual response structure
    } catch (error) {
        console.error('Error fetching SMS balance:', error);
        throw new Error('Failed to retrieve SMS balance');
    }
};

const sendSmsWithBalanceCheck = async (smsPayload) => {
    const balance = await checkSmsBalance();
    if (balance < smsPayload.length) {
        throw new Error('Insufficient SMS balance');
    }
    const response = await axios.post(BULK_SMS_ENDPOINT, {
        count: smsPayload.length,
        smslist: smsPayload,
    });
    return response.data;
};

// Function to sanitize the phone number
const sanitizePhoneNumber = (phone) => {
    if (typeof phone !== 'string') {
        console.error('Invalid phone number format:', phone);
        return '';
    }

    if (phone.startsWith('+254')) {
        return phone.slice(1);
    } else if (phone.startsWith('0')) {
        return `254${phone.slice(1)}`;
    } else if (phone.startsWith('254')) {
        return phone;
    } else {
        return `254${phone}`;
    }
};

// Function to get the current month name
const getCurrentMonthName = () => {
    const options = { month: 'long' }; // Long format for the full month name
    const monthName = new Intl.DateTimeFormat('en-US', options).format(new Date());
    return monthName.charAt(0).toUpperCase() + monthName.slice(1); // Capitalize the first letter
};

// Send SMS to a group of customers
router.post('/send-to-group', async (req, res) => {
    const { day, message } = req.body; // Get the day and message from the request body

    // Validate request body
    if (!day || !message) {
        return res.status(400).json({ error: 'Day and message are required.' });
    }

    try {
        // Fetch customers for the specified collection day
        const customers = await prisma.customer.findMany({
            where: {
                garbageCollectionDay: day.toUpperCase(), // Ensure the day is in the correct format
                status: 'ACTIVE', // Only fetch active customers
            },
        });

        // Prepare SMS payload for each recipient
        const smsList = customers.map((customer) => {
            const mobile = sanitizePhoneNumber(customer.phoneNumber);
            return {
                partnerID: PARTNER_ID,
                apikey: SMS_API_KEY,
                pass_type: "plain",
                clientsmsid: Math.floor(Math.random() * 10000), // Ensure this is unique if required
                mobile: mobile,
                message: message,
                shortcode: SHORTCODE,
            };
        });

        // Send the bulk SMS
        const response = await sendSmsWithBalanceCheck(smsList);

    

        console.log(`Sent ${smsList.length} bulk SMS messages.`);
        return res.status(200).json({ message: `Sent ${smsList.length} SMS messages.`, data: response.data });
    } catch (error) {
        console.error('Error sending bulk SMS:', error);
        const errorMessage = error.response ? error.response.data : 'Failed to send SMS.';
        return res.status(500).json({ error: errorMessage });
    }
});

// Send a single SMS
router.post('/send-sms', async (req, res) => {
    const { message, mobile } = req.body;

    try {
        // Convert mobile to a string if it's not
        const mobileString = String(mobile);
        const sanitisedNumber = sanitizePhoneNumber(mobileString);

        // Define the sendSMS function
        const sendSMS = async (sanitisedNumber, message) => {
            console.log(`Sanitised number is ${sanitisedNumber}`);
            try {
                const balance = await checkSmsBalance();
                if (balance < 3) {
                    return res.status(400).json({ error: 'Insufficient SMS balance.' });
                }

                const payload = {
                    partnerID: PARTNER_ID,
                    apikey: SMS_API_KEY,
                    mobile: sanitisedNumber,
                    message,
                    shortcode: SHORTCODE,
                };

                console.log(`This is payload: ${JSON.stringify(payload)}`);

                const response = await axios.post(SMS_ENDPOINT, payload, {
                    headers: {
                        'Content-Type': 'application/json',
                    },
                });

                console.log(`SMS sent to ${sanitisedNumber}: ${message}`);
                return response.data;
            } catch (error) {
                console.error('Error sending SMS:', error);
                throw new Error(error.response ? error.response.data : 'Failed to send SMS.');
            }
        };

        // Send the SMS
        const response = await sendSMS(sanitisedNumber, message);

        // Respond with success
        res.status(200).json({
            success: true,
            message: `SMS sent to ${sanitisedNumber}`,
            data: response,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
});

// Send bills to all active customers
router.post('/send-bills', async (req, res) => {
    try {
        // Fetch all active customers
        const activeCustomers = await prisma.customer.findMany({
            where: {
                status: 'ACTIVE',
            },
            include: {
                invoices: {
                    // Include unpaid invoices for all customers
                    where: {
                        status: 'UNPAID',
                    },
                    orderBy: {
                        createdAt: 'desc', // Ensure the latest invoice is first
                    },
                },
            },
        });

        // Get the current month name
        const currentMonth = getCurrentMonthName();

        // Prepare messages for each customer
        const messages = activeCustomers.map(customer => {
            const invoices = customer.invoices;

            // Use the latest unpaid invoice amount for the current invoice
            const currentInvoice = invoices.length > 0 ? invoices[0].invoiceAmount : 0; // Assume `invoiceAmount` is the field for the invoice amount
            const currentBalance = customer.closingBalance;

            // Prepare the message based on the balance
            let message;
            if (currentBalance < 0) {
                // Handle overpayment
                const overpaymentAmount = Math.abs(currentBalance);
                message = `Hello ${customer.firstName}, you have an overpayment of KES ${overpaymentAmount}. Thank you for being a royal customer!`;
            } else {
                // Calculate previous balance if applicable
                const previousBalance = currentBalance - currentInvoice;
                message = `Hello ${customer.firstName}, your previous balance for ${currentMonth} is KES ${previousBalance}. Your ${currentMonth} bill is KES ${currentInvoice}. Total balance is KES ${currentBalance}. Please pay your bills.`;
            }

            return {
                phoneNumber: customer.phoneNumber,
                message: message,
            };
        }).filter(message => message !== null); // Filter out null messages

        const balance = await checkSmsBalance();
        if (balance < messages.length * 2) { // Assuming each SMS requires at least 2 credits
            console.log('Insufficient SMS balance to send messages.');
            return res.status(500).json({ error: 'Insufficient SMS balance to send messages.' });
        }

        // Send SMS to each customer
        if (messages.length > 0) {
            const smsResponses = await sendSms(messages);
            res.status(200).json({
                message: 'Bills sent successfully',
                smsResponses,
            });
        } else {
            res.status(200).json({
                message: 'No bills to send, all customers are current.',
            });
        }
    } catch (error) {
        console.error('Error sending bills:', error);
        res.status(500).json({ error: 'Failed to send bills.' });
    }
});

// Send SMS to all active customers


router.post('/send-to-all', async (req, res) => {
    const { message } = req.body; // Get the message from the request body

    // Validate request body
    if (!message) {
        return res.status(400).json({ error: 'Message is required.' });
    }

    try {
        // Fetch all active customers
        const activeCustomers = await prisma.customer.findMany({
            where: {
                status: 'ACTIVE', // Only fetch active customers
            },
            select: {
                phoneNumber: true, // Only select the phone number for simplicity
            }
        });

        // Prepare messages for each customer
        const messages = activeCustomers.map(customer => ({
            phoneNumber: customer.phoneNumber,
            message: message,
        })).filter(msg => msg.phoneNumber); // Filter out any customers without a phone number

        // Check SMS balance before sending
        const balance = await checkSmsBalance();
        if (balance < messages.length * 2) { // Assuming each SMS requires at least 2 credits
            console.log('Insufficient SMS balance to send messages.');
            return res.status(500).json({ error: 'Insufficient SMS balance to send messages.' });
        }

        // Send SMS to each customer
        if (messages.length > 0) {
            const smsResponses = await sendSms(messages);
            return res.status(200).json({
                message: 'SMS sent to all active customers successfully.',
                smsResponses,
            });
        } else {
            return res.status(200).json({
                message: 'No active customers to send SMS to.',
            });
        }
    } catch (error) {
        console.error('Error sending SMS to all customers:', error);
        return res.status(500).json({ error: 'Failed to send SMS to all customers.' });
    }
});




router.post('/send-bill', async (req, res) => {
    const { customerId } = req.body; // Extract customer ID from request body

    // Validate input
    if (!customerId) {
        return res.status(400).json({ error: 'Customer ID is required.' });
    }

    try {
        // Fetch the customer and their unpaid invoices
        const customer = await prisma.customer.findUnique({
            where: { id: customerId },
            include: {
                invoices: {
                    where: { status: 'UNPAID' },
                    orderBy: {
                        createdAt: 'desc', // Ensure the latest invoice is first
                    },
                },
            },
        });

        if (!customer) {
            return res.status(404).json({ error: 'Customer not found.' });
        }

        // Get the current month name
        const currentMonth = getCurrentMonthName();

        // Use the latest unpaid invoice amount for the current invoice
        const currentInvoice = customer.invoices.length > 0 ? customer.invoices[0].invoiceAmount : 0; // Assume `invoiceAmount` is the field for the invoice amount
        const currentBalance = customer.closingBalance;

        // Construct the message based on the closing balance
        let message;

        if (currentBalance < 0) { // Handle overpayment case
            message = `Hello ${customer.firstName}, you have an overpayment of KES ${Math.abs(currentBalance)}. Thank you for being a royal customer.`;
        } else {
            // Previous balance is the sum of all previous unpaid invoices (excluding the latest one)
            const previousBalance = currentBalance - currentInvoice;

            message = `Hello ${customer.firstName}, your previous balance for ${currentMonth} is KES ${previousBalance}. Your ${currentMonth} bill is KES ${currentInvoice}. Total balance is KES ${currentBalance}. Please pay your bills.`;
        }

        // Sanitize the phone number
        const sanitizedMobile = sanitizePhoneNumber(customer.phoneNumber);

        // Check SMS balance before sending
        const balance = await checkSmsBalance();
        if (balance < 2) { // Ensure there's at least 2 credits for sending the SMS
            console.log('Insufficient SMS balance to send bill.');
            return res.status(500).json({ error: 'Insufficient SMS balance.' });
        }

        // Send the SMS
        const payload = {
            apikey: SMS_API_KEY,
            partnerID: PARTNER_ID,
            shortcode: SHORTCODE,
            message: message,
            mobile: sanitizedMobile,
        };

        const response = await axios.post(SMS_ENDPOINT, payload);

        return res.status(response.status).json({ message: 'Bill sent successfully!', data: response.data });
    } catch (error) {
        console.error('Error sending bill:', error);
        const errorMessage = error.response ? error.response.data : 'Failed to send bill.';
        return res.status(500).json({ error: errorMessage });
    }
});



// Function to send SMS to a list of recipients
const sendSms = async (messages) => {
    // Prepare the SMS list payload for the bulk SMS API
    const smsList = messages.map(({ phoneNumber, message }) => ({
        partnerID: PARTNER_ID,
        apikey: SMS_API_KEY,
        pass_type: "plain",
        clientsmsid: Math.floor(Math.random() * 10000), // Ensure this is unique if required
        message: message,
        shortcode: SHORTCODE,
        mobile: sanitizePhoneNumber(phoneNumber),
    }));

    try {
        const response = await axios.post(BULK_SMS_ENDPOINT, {
            count: smsList.length,
            smslist: smsList,
        });
        return response.data;
    } catch (error) {
        console.error('Error sending bulk SMS:', error);
        throw error;
    }
};

module.exports = router;
