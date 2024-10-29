const axios = require('axios'); // Ensure axios is imported




// Load environment variables
const SMS_API_KEY = process.env.SMS_API_KEY;
const PARTNER_ID = process.env.PARTNER_ID;
const SHORTCODE = process.env.SHORTCODE;
//const BULK_SMS_ENDPOINT = process.env.BULK_SMS_ENDPOINT;
const SMS_ENDPOINT = process.env.SMS_ENDPOINT;


function sanitizePhoneNumber(phone) {
    if (typeof phone !== 'string') {
        console.error('Invalid phone number format:', phone);
        return ''; 
    }

    // Remove any '+' if present and format based on common cases
    if (phone.startsWith('+254')) {
        return phone.slice(1); // Remove the '+' to get '254...'
    } else if (phone.startsWith('0')) {
        return `254${phone.slice(1)}`; // Convert "0" prefix to "254"
    } else if (phone.startsWith('254')) {
        return phone; // Already in correct format
    } else {
        return `254${phone}`; // Default case: prepend "254" if missing
    }
}



const sendSMS = async (mobile, message) => {

    console.log(`sanitised number is ${sanitizePhoneNumber(mobile)}`);
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
