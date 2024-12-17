const { PrismaClient, CustomerStatus, GarbageCollectionDay } = require('@prisma/client');
const prisma = new PrismaClient();

// PUT: Update a customer
const editCustomer = async (req, res) => {
  const customerId = req.params.id; // Get the customer ID from the URL
  const {
    firstName,
    lastName,
    email,
    phoneNumber,
    gender,
    county,
    town,
    status,
    location,
    estateName,           // Optional field for estate name
    building,              // Optional field for building name
    houseNumber,           // Optional field for house number
    category,
    monthlyCharge,
    garbageCollectionDay,  
    collected,
    closingBalance
  } = req.body;

  // Check if the customer ID is provided
  if (!customerId) {
    return res.status(400).json({ message: 'Customer ID is required' });
  }

  // Initialize an object to hold the fields that need to be updated
  const updateData = {};

  // Only add the provided fields to the update object
  if (firstName) updateData.firstName = firstName;
  if (lastName) updateData.lastName = lastName;
  if (email) updateData.email = email;
  if (phoneNumber) updateData.phoneNumber = phoneNumber;
  if (gender) updateData.gender = gender;
  if (county) updateData.county = county;
  if (town) updateData.town = town;
  if (status) {
    if (!Object.values(CustomerStatus).includes(status.toUpperCase())) {
      return res.status(400).json({ message: 'Invalid status value' });
    }
    updateData.status = CustomerStatus[status.toUpperCase()];
  }
  if (location) updateData.location = location;
  if (estateName) updateData.estateName = estateName;
  if (building) updateData.building = building;
  if (houseNumber) updateData.houseNumber = houseNumber;
  if (category) updateData.category = category;
  if (monthlyCharge) updateData.monthlyCharge = monthlyCharge;
  if (garbageCollectionDay) {
    if (!Object.values(GarbageCollectionDay).includes(garbageCollectionDay.toUpperCase())) {
      return res.status(400).json({ message: 'Invalid garbage collection day' });
    }
    updateData.garbageCollectionDay = GarbageCollectionDay[garbageCollectionDay.toUpperCase()];
  }
  if (collected !== undefined) updateData.collected = collected;
  if (closingBalance !== undefined) updateData.closingBalance = closingBalance;

  try {
    // Find and update the customer using Prisma
    const updatedCustomer = await prisma.customer.update({
      where: { id: customerId },
      data: updateData,
    });

    // Return the updated customer data
    res.status(200).json(updatedCustomer);
  } catch (error) {
    console.error('Error updating customer:', error);
    if (error.code === 'P2025') {
      return res.status(404).json({ message: 'Customer not found' });
    }
    res.status(500).json({ message: 'Error updating customer' });
  }
};

module.exports = { editCustomer };
