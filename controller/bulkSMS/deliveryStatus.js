const axios = require('axios');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();


async function updateSmsDeliveryStatus(clientsmsid) {
    const ENDPOINT = process.env.SMS_DELIVERY_REPORT
  
    try {
      const response = await axios.post(ENDPOINT, {
        apikey: process.env.SMS_API_KEY,
        partnerID: process.env.PARTNER_ID,
        messageID: clientsmsid,
      });
  
      const status = response.data.status; // Adjust based on actual response
      await prisma.sms.update({
        where: { clientsmsid },
        data: { status },
      });
  
      console.log(`Updated delivery status for SMS ID ${clientsmsid}`);
    } catch (error) {
      console.error('Error updating SMS delivery status:', error);
      throw new Error('Failed to retrieve SMS delivery status');
    }
  }



// Function to retrieve SMS messages from the database
const   getSmsMessages = async (req, res) =>{
    
  try {
    const smsMessages = await prisma.sms.findMany({
      orderBy: {
        createdAt: 'desc', // Sort by latest first
      },
    });

    // Send a successful response with the data
    res.status(200).json({ success: true, data: smsMessages });
  } catch (error) {
    console.error('Error fetching SMS messages:', error);
    res.status(500).json({ success: false, message: 'Server error while retrieving SMS messages' });
  }
};


  module.exports={getSmsMessages,
    updateSmsDeliveryStatus
  }
  