const axios = require('axios'); // Ensure axios is imported




// Load environment variables
const SMS_API_KEY = process.env.SMS_API_KEY;
const PARTNER_ID = process.env.PARTNER_ID;
const SHORTCODE = process.env.SHORTCODE;
//const BULK_SMS_ENDPOINT = process.env.BULK_SMS_ENDPOINT;
const SMS_ENDPOINT = process.env.SMS_ENDPOINT;






const sendSMS = async (mobile, message) => {

    console.log(`sanitised number is ${mobile}`);
    try {
        const response = await axios.post(SMS_ENDPOINT, {
            partnerID: PARTNER_ID,
            apikey: SMS_API_KEY,
            mobile: mobile,
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
