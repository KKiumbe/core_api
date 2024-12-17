const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');
const { PrismaClient } = require('@prisma/client');
const ROLE_PERMISSIONS = require('../../DatabaseConfig/role.js');

dotenv.config();
const prisma = new PrismaClient();

// Register a new user
const register = async (req, res) => {
  const {
    firstName,
    lastName,
    phoneNumber,
    email,
    county,
    town,
    gender,
    password,
  } = req.body;

  try {
    // Check if phoneNumber already exists
    const existingUser = await prisma.user.findUnique({
      where: { phoneNumber },
    });

    if (existingUser) {
      return res.status(400).json({ message: 'Phone number is already registered.' });
    }

    // Ensure password is provided
    if (!password) {
      return res.status(400).json({ message: 'Password is required' });
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);
    const userCount = await prisma.user.count();
    // Define default roles
    const defaultRoles = userCount === 0 ? ['admin'] : ['default'];

    // Validate roles against ROLE_PERMISSIONS
    const validRoles = Object.keys(ROLE_PERMISSIONS);
    const invalidRoles = defaultRoles.filter((role) => !validRoles.includes(role));

    if (invalidRoles.length > 0) {
      return res.status(500).json({
        message: `Default roles are not defined in ROLE_PERMISSIONS: ${invalidRoles.join(', ')}`,
      });
    }

    // Create the user in the database
    const newUser = await prisma.user.create({
      data: {
        firstName,
        lastName,
        phoneNumber,
        email,
        county,
        town,
        gender,
        password: hashedPassword,
        roles: { set: defaultRoles }, // PostgreSQL array field
      },
    });

    res.status(201).json({ message: 'User created successfully', newUser });
  } catch (error) {
    console.error('Error registering user:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// Sign in an existing user
const signin = async (req, res) => {
  const { phoneNumber, password } = req.body;

  try {
    // Find the user by phone number
    const user = await prisma.user.findUnique({
      where: { phoneNumber },
    });

    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Compare the password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Generate a JWT token
    const token = jwt.sign(
      { id: user.id, phoneNumber: user.phoneNumber, roles: user.roles },
      process.env.JWT_SECRET,
      { expiresIn: '1d' }
    );

    // Set the token in an HTTP-only cookie
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 24 * 60 * 60 * 1000, // 1 day
    });

    // Exclude the password from the response
    const { password: _, ...userInfo } = user;

    res.status(200).json({ message: 'Login successful', user: userInfo });
  } catch (error) {
    console.error('Error logging in:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

module.exports = { register, signin };
