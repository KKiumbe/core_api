const axios = require('axios'); // Ensure axios is imported




// Load environment variables
const SMS_API_KEY = process.env.SMS_API_KEY;
const PARTNER_ID = process.env.PARTNER_ID;
const SHORTCODE = process.env.SHORTCODE;
//const BULK_SMS_ENDPOINT = process.env.BULK_SMS_ENDPOINT;
const SMS_ENDPOINT = process.env.SMS_ENDPOINT;

// Function to sanitize the phone number
const sanitizePhoneNumber = (phone) => {
    if (phone.startsWith('254')) {
        return phone; // Already in the correct format
    } else if (phone.startsWith('0')) {
        return '254' + phone.slice(1); // Replace leading '0' with '254'
    } else {
        return '254' + phone; // Assume it's a local number without a prefix
    }
};

const sendSMS = async (mobile, message) => {
    try {
        const response = await axios.post(SMS_ENDPOINT, {
            partnerID: PARTNER_ID,
            apikey: SMS_API_KEY,
            pass_type: "plain",
            clientsmsid: Math.floor(Math.random() * 10000), // Ensure this is unique if required
            mobile: sanitizePhoneNumber(mobile),
            message: message,
            shortcode: SHORTCODE,
        });
        console.log(`SMS sent to ${mobile}: ${message}`);
        return response.data; // Return the response for further processing if needed
    } catch (error) {
        console.error('Error sending SMS:', error);
        throw new Error(error.response ? error.response.data : 'Failed to send SMS.');
    }
};

module.exports = {
    sendSMS
}
