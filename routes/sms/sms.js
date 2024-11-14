const axios = require('axios');
const { PrismaClient } = require('@prisma/client'); // Import Prisma Client
const prisma = new PrismaClient(); // Initialize Prisma Client

// Load environment variables
const SMS_API_KEY = process.env.SMS_API_KEY;
const PARTNER_ID = process.env.PARTNER_ID;
const SHORTCODE = process.env.SHORTCODE;
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

// Function to send SMS with balance check
const sendSMS = async (message, customer) => {
    console.log(`Sanitised number is ${sanitisedNumber}`);

    try {
        // Check if there is at least 1 SMS balance before sending
        const balance = await checkSmsBalance();
        if (balance < 1) {
            throw new Error('Insufficient SMS balance');
        }

        // Generate a unique `clientsmsid` for tracking
        const clientsmsid = Math.floor(Math.random() * 1000000);

        // Create an SMS record with initial status 'pending'
        const smsRecord = await prisma.sms.create({
            data: {
                clientsmsid,
                customerId: customer.id,
                mobile: customer.phoneNumber,
                message,
                status: 'pending',
            },
        });

        const payload = {
            partnerID: PARTNER_ID,
            apikey: SMS_API_KEY,
            mobile: customer.phoneNumber,
            message,
            shortcode: SHORTCODE,
        };

        console.log(`This is payload: ${JSON.stringify(payload)}`);

        // Send the SMS
        const response = await axios.post(SMS_ENDPOINT, payload);
        console.log(`SMS sent to ${sanitisedNumber}: ${message}`);

        // Update SMS record status to 'sent' after successful send
        await prisma.sms.update({
            where: { id: smsRecord.id },
            data: { status: 'sent' },
        });

        return response.data; // Return the response for further processing if needed
    } catch (error) {
        console.error('Error sending SMS:', error);

        // Update SMS record status to 'failed' if there's an error
        await prisma.sms.update({
            where: { clientsmsid },
            data: { status: 'failed' },
        });

        throw new Error(error.response ? error.response.data : 'Failed to send SMS.');
    }
};

module.exports = {
    sendSMS,
};
