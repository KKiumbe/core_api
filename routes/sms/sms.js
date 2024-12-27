const axios = require('axios');
const { PrismaClient } = require('@prisma/client');
const { v4: uuidv4 } = require('uuid');

const prisma = new PrismaClient();

const SMS_API_KEY = process.env.SMS_API_KEY;
const PARTNER_ID = process.env.PARTNER_ID;
const SHORTCODE = process.env.SHORTCODE;
const SMS_ENDPOINT = process.env.SMS_ENDPOINT;
const SMS_BALANCE_URL = process.env.SMS_BALANCE_URL;


const sendSMS = async (mobile, message) => {
    let clientsmsid;

    try {
        // Check SMS balance
        const balance = await checkSmsBalance();
        if (balance < 1) {
            throw new Error('Insufficient SMS balance');
        }

        // Sanitize phone number
        const sanitizedMobile = sanitizePhoneNumber(mobile);

        // Fetch the customer ID from the database
        const customer = await prisma.customer.findUnique({
            where: {
                phoneNumber: sanitizedMobile, // Ensure phoneNumber is unique in your database schema
            },
        });

        if (!customer) {
            throw new Error('Customer not found for the provided phone number');
        }

        const customerId = customer.id;

        // Generate unique clientsmsid
        clientsmsid = uuidv4();

        console.log(`Creating SMS record with clientsmsid: ${clientsmsid} for customerId: ${customerId}`);

        // Create SMS record in the database
        const smsRecord = await prisma.sMS.create({
            data: {
                clientsmsid,
                customerId,
                mobile: sanitizedMobile,
                message,
                status: 'pending',
            },
        });

        console.log(`SMS record created: ${JSON.stringify(smsRecord)}`);

        // Prepare SMS payload
        const payload = {
            partnerID: PARTNER_ID,
            apikey: SMS_API_KEY,
            message,
            shortcode: SHORTCODE,
            mobile: sanitizedMobile,
        };

        console.log(`Sending SMS with payload: ${JSON.stringify(payload)}`);

        // Send SMS
        const response = await axios.post(SMS_ENDPOINT, payload);

        console.log('SMS sent successfully. Updating status to "sent".');

        // Update SMS record to "sent"
        await prisma.sMS.update({
            where: { id: smsRecord.id },
            data: { status: 'sent' },
        });

        return response.data;
    } catch (error) {
        console.error('Error sending SMS:', error.message);

        // Handle failed SMS
        if (clientsmsid) {
            try {
                await prisma.sMS.update({
                    where: { clientsmsid },
                    data: { status: 'failed' },
                });
                console.log(`SMS status updated to "failed" for clientsmsid: ${clientsmsid}`);
            } catch (updateError) {
                console.error('Error updating SMS status to "failed":', updateError.message);
            }
        }

        throw new Error(error.response ? error.response.data : 'Failed to send SMS.');
    }
};



// Function to check SMS balance
const checkSmsBalance = async () => {
    try {
        const response = await axios.post(SMS_BALANCE_URL, {
            apikey: SMS_API_KEY,
            partnerID: PARTNER_ID,
        });
        return response.data.balance;
    } catch (error) {
        console.error('Error fetching SMS balance:', error.message);
        throw new Error('Failed to retrieve SMS balance');
    }
};

// Function to sanitize phone numbers
function sanitizePhoneNumber(phone) {
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
}

module.exports = {
    sendSMS,
};
