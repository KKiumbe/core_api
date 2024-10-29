const axios = require('axios');

// Load environment variables
const SMS_API_KEY = process.env.SMS_API_KEY;
const PARTNER_ID = process.env.PARTNER_ID;
const SHORTCODE = process.env.SHORTCODE;
const SMS_ENDPOINT = process.env.SMS_ENDPOINT;

const sendSMS = async (sanitisedNumber, message) => {
    console.log(`Sanitised number is ${sanitisedNumber}`);
    try {
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
