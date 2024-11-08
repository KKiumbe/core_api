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

// Function to sanitize the phone numb er
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
    const { day, message } = req.body;

    // Validate request body
    if (!day || !message) {
        return res.status(400).json({ error: 'Day and message are required.' });
    }

    try {
        // Fetch customers for the specified collection day
        const customers = await prisma.customer.findMany({
            where: {
                garbageCollectionDay: day.toUpperCase(),
                status: 'ACTIVE',
            },
        });

        // Prepare SMS payload for each recipient and add to the database
        const smsList = await Promise.all(
            customers.map(async (customer) => {
                const mobile = sanitizePhoneNumber(customer.phoneNumber);
                const clientsmsid = Math.floor(Math.random() * 10000);

                // Save each SMS to the database with status "pending"
                await prisma.sms.create({
                    data: {
                        clientsmsid,
                        customerId: customer.id,
                        mobile,
                        message,
                        status: 'pending',
                    },
                });

                // Return the SMS payload for sending
                return {
                    partnerID: process.env.PARTNER_ID,
                    apikey: process.env.SMS_API_KEY,
                    pass_type: "plain",
                    clientsmsid,
                    mobile,
                    message,
                    shortcode: process.env.SHORTCODE,
                };
            })
        );

        // Send the bulk SMS
        const response = await sendSmsWithBalanceCheck(smsList);

        if (response.data.success) {
            // Extract sent message IDs to update their status to "sent"
            const sentIds = smsList.map(sms => sms.clientsmsid);

            // Update the SMS status to "sent" in the database
            await prisma.sms.updateMany({
                where: { clientsmsid: { in: sentIds } },
                data: { status: 'sent' }
            });

            console.log(`Updated status to 'sent' for ${sentIds.length} SMS records.`);
        }

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
        // Ensure mobile is a string and sanitize it
        const mobileString = String(mobile);
        const sanitizedNumber = sanitizePhoneNumber(mobileString);

        // Generate a unique ID for clientsmsid
        const smsid = Math.floor(Math.random() * 1000000);

        // Create the SMS record in the database with status 'pending'
        const smsRecord = await prisma.sms.create({
            data: {
                clientsmsid: smsid,
                mobile: sanitizedNumber,
                message,
                status: 'pending',
            },
        });

        // Define the sendSMS function
        const sendSMS = async (sanitizedNumber, message) => {
            console.log(`Sanitized number is ${sanitizedNumber}`);

            try {
                const balance = await checkSmsBalance();
                if (balance < 3) {
                    return res.status(400).json({ error: 'Insufficient SMS balance.' });
                }

                const payload = {
                    partnerID: process.env.PARTNER_ID,
                    apikey: process.env.SMS_API_KEY,
                    mobile: sanitizedNumber,
                    message,
                    shortcode: process.env.SHORTCODE,
                };

                console.log(`Payload: ${JSON.stringify(payload)}`);

                const response = await axios.post(process.env.SMS_ENDPOINT, payload, {
                    headers: { 'Content-Type': 'application/json' },
                });

                // Update the SMS record in the database with status 'sent' and response data
                await prisma.sms.update({
                    where: { id: smsRecord.id },
                    data: {
                        status: 'sent',
                        response: response.data,
                    },
                });

                console.log(`SMS sent to ${sanitizedNumber}: ${message}`);
                return response.data;
            } catch (error) {
                console.error('Error sending SMS:', error);

                // Update the SMS record to status 'failed' if there was an error
                await prisma.sms.update({
                    where: { id: smsRecord.id },
                    data: {
                        status: 'failed',
                        response: error.response ? error.response.data : 'Failed to send SMS.',
                    },
                });

                throw new Error(error.response ? error.response.data : 'Failed to send SMS.');
            }
        };

        // Send the SMS and await the response
        const response = await sendSMS(sanitizedNumber, message);

        // Respond with success if SMS sent successfully
        res.status(200).json({
            success: true,
            message: `SMS sent to ${sanitizedNumber}`,
            data: response,
        });

    } catch (error) {
        console.error('Error in send-sms route:', error);

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
            //const invoices = customer.invoices;

            // Use the latest unpaid invoice amount for the current invoice
            const currentInvoice = customer.monthlyCharge // Assume `invoiceAmount` is the field for the invoice amount
            const currentBalance = customer.closingBalance;

            // Prepare the message based on the balance

            //Help us server you better by always paying on time. Paybill No :4107197 , your phone number as the account number.Customer support number: 0726594923.`,
     


            let message;
            if (currentBalance < 0) {
                // Handle overpayment
                const overpaymentAmount = Math.abs(currentBalance);
                message = `Dear ${customer.firstName}, Your ${currentMonth} bill is KES ${currentInvoice}.You have an overpayment of KES ${overpaymentAmount}.Help us server you better by using Paybill No :4107197 , your phone number as the account number.Customer support number: 0726594923  Thank you for always being a royal customer. !`;
            } else {
                // Calculate previous balance if applicable
                const previousBalance = currentBalance - currentInvoice;
                message = `Dear ${customer.firstName}, your previous balance for ${currentMonth} is KES ${previousBalance}. Your ${currentMonth} bill is KES ${currentInvoice}. Total balance is KES ${currentBalance}. Use Paybill No :4107197 ,your phone number as the account number.Customer support number: 0726594923.`;
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







// Send a bill SMS
router.post('/send-bill', async (req, res) => {
    const { customerId } = req.body;

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
                    orderBy: { createdAt: 'desc' },
                },
            },
        });

        if (!customer) {
            return res.status(404).json({ error: 'Customer not found.' });
        }

        const currentMonth = getCurrentMonthName();
        const currentInvoice = customer.monthlyCharge;
        const currentBalance = customer.closingBalance;

        let message;
        if (currentBalance < 0) {
            message = `Dear ${customer.firstName}, you have an overpayment of KES ${Math.abs(currentBalance)}. Paybill No: 4107197, phone number as account number. Customer support: 0726594923.`;
        } else {
            const previousBalance = currentBalance - currentInvoice;
            message = `Dear ${customer.firstName}, Your ${currentMonth} bill is KES ${currentInvoice}. Total balance: KES ${currentBalance}. Pay on time. Paybill No: 4107197, phone number as account number. Customer support: 0726594923.`;
        }

        const sanitizedMobile = sanitizePhoneNumber(customer.phoneNumber);
        const balance = await checkSmsBalance();
        if (balance < 2) {
            return res.status(500).json({ error: 'Insufficient SMS balance.' });
        }

        const smsid = Math.floor(Math.random() * 1000000); // Unique ID for tracking


        const smsRecord = await prisma.sms.create({


            data: {
                mobile: sanitizedMobile,
                message,
                status: 'pending',
                clientsmsid: smsid, // or generate a unique identifier if needed
            },
        });

        const payload = {
            apikey: process.env.SMS_API_KEY,
            partnerID: process.env.PARTNER_ID,
            shortcode: process.env.SHORTCODE,
            message,
            mobile: sanitizedMobile,
        };

        const response = await axios.post(process.env.SMS_ENDPOINT, payload);

        // Update `smsRecord` with status and response data after successful SMS send
        await prisma.sms.update({
            where: { id: smsRecord.id },
            data: {
                status: 'sent',
                response: response.data,
            },
        });

        res.status(response.status).json({ message: 'Bill sent successfully!', data: response.data });
    } catch (error) {
        console.error('Error sending bill:', error);

        // Update `smsRecord` only if it was successfully created
        if (smsRecord) {
            await prisma.sms.update({
                where: { id: smsRecord.id },
                data: {
                    status: 'failed',
                    response: error.response ? error.response.data : 'Failed to send SMS.',
                },
            });
        }

        res.status(500).json({ error: error.response ? error.response.data : 'Failed to send bill.' });
    }
});








// Function to send SMS to a list of recipients
const sendSms = async (messages) => {
    try {
        // Prepare the SMS list payload for the bulk SMS API
        const smsList = await Promise.all(
            messages.map(async ({ phoneNumber, message }) => {
                const clientsmsid = Math.floor(Math.random() * 1000000); // Unique ID for tracking

                // Save the SMS entry to the database with a pending status
                await prisma.sms.create({
                    data: {
                        clientsmsid,
                        mobile: sanitizePhoneNumber(phoneNumber),
                        message,
                        status: 'pending',
                    },
                });

                return {
                    partnerID: PARTNER_ID,
                    apikey: SMS_API_KEY,
                    pass_type: "plain",
                    clientsmsid,
                    message,
                    shortcode: SHORTCODE,
                    mobile: sanitizePhoneNumber(phoneNumber),
                };
            })
        );

        // Send the bulk SMS request
        const response = await axios.post(BULK_SMS_ENDPOINT, {
            count: smsList.length,
            smslist: smsList,
        });

        // Update the status of each SMS in the database to "sent" after successful delivery
        await Promise.all(
            smsList.map(async ({ clientsmsid }) => {
                await prisma.sms.updateMany({
                    where: { clientsmsid },
                    data: { status: 'sent', response: response.data },
                });
            })
        );

        return response.data;
    } catch (error) {
        console.error('Error sending bulk SMS:', error);

        // Update the status of each SMS in the database to "failed" if there’s an error
        await Promise.all(
            messages.map(async ({ clientsmsid }) => {
                await prisma.sms.updateMany({
                    where: { clientsmsid },
                    data: { status: 'failed', response: error.response ? error.response.data : 'Failed to send SMS' },
                });
            })
        );

        throw error;
    }
};








module.exports = router;
