// mpesaMiddleware.js
const axios = require('axios');
const base64 = require('base-64');

const consumer_key = process.env.MPESA_API_KEY; // Use your environment variable for the API key
const consumer_secret = process.env.MPESA_SECRET_KEY; // Use your environment variable for the secret key
const baseUrl = 'https://sandbox.safaricom.co.ke'; // Change to live URL for production

// Middleware to generate access token
const generateAccessToken = async (req, res, next) => {
    const credentials = `${consumer_key}:${consumer_secret}`;
    const encodedCredentials = base64.encode(credentials);
    const url = `${baseUrl}/oauth/v1/generate?grant_type=client_credentials`;

    try {
        const response = await axios.get(url, {
            headers: {
                'Authorization': `Basic ${encodedCredentials}`
            }
        });
        req.accessToken = response.data.access_token; // Attach the token to the request object
        next(); // Proceed to the next middleware/route handler
    } catch (error) {
        console.error('Error fetching access token:', error.response.data);
        return res.status(500).json({ error: 'Unable to generate access token' });
    }
};

module.exports = { generateAccessToken };
