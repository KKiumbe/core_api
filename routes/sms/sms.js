const axios = require('axios'); // Ensure axios is imported




// Load environment variables
const SMS_API_KEY = process.env.SMS_API_KEY;
const PARTNER_ID = process.env.PARTNER_ID;
const SHORTCODE = process.env.SHORTCODE;
//const BULK_SMS_ENDPOINT = process.env.BULK_SMS_ENDPOINT;
const SMS_ENDPOINT = process.env.SMS_ENDPOINT;
console.log(SMS_ENDPOINT);






const sendSMS = async (mobile, message) => {

    console.log(`sanitised number is ${mobile}`);
    try {
    //    const payload = {
    //         partnerID: PARTNER_ID,
    //         apikey: SMS_API_KEY,
    //         mobile,
    //         message,
    //         shortcode: SHORTCODE,
    //     }


    const payload = {
        partnerID: "4680",
        apikey: "146d35f516edcdaf3cc86bb388f8afde",
        mobile: "254702550190", // Flatten the mobile field
        message: "Dear Kevin, payment received successfully. Your closing balance is an overpayment of KES 1. Thank you for your payment!", // Separate the message field
        shortcode: "SIKIKA_LTD"
    };
    

        console.log(`this is payload ${payload}`);
        const response = await axios.post(SMS_ENDPOINT,payload
        );
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
