const axios = require('axios');

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
const sendSMS = async (sanitisedNumber, message) => {
    console.log(`Sanitised number is ${sanitisedNumber}`);

    try {
        // Check if there is at least 1 SMS balance before sending
        const balance = await checkSmsBalance();
        if (balance < 1) {
            throw new Error('Insufficient SMS balance');
        }

        const payload = {
            partnerID: PARTNER_ID,
            apikey: SMS_API_KEY,
            mobile: sanitisedNumber,
            message,
            shortcode: SHORTCODE,
        };

        console.log(`This is payload: ${JSON.stringify(payload)}`);

        const response = await axios.post(SMS_ENDPOINT, payload);
        console.log(`SMS sent to ${sanitisedNumber}: ${message}`);
        return response.data; // Return the response for further processing if needed
    } catch (error) {
        console.error('Error sending SMS:', error);
        throw new Error(error.response ? error.response.data : 'Failed to send SMS.');
    }
};

module.exports = {
    sendSMS
};
