const   bcrypt = require ('bcrypt');

const  jwt = require ('jsonwebtoken');
const dotenv = require ('dotenv');

const { PrismaClient } = require('@prisma/client');
const ROLE_PERMISSIONS = require('../../DatabaseConfig/role.js')
const prisma = new PrismaClient();
dotenv.config();



const register = async (req, res) => {
  const {
    firstName,
    lastName,
    phoneNumber,
    email,
    county,
    town,
    gender,
    password
  } = req.body;

  try {
    // Check if phoneNumber already exists (unique phone number for login)
    const existingUser = await prisma.user.findUnique({
      where: {
        phoneNumber: phoneNumber,
      },
    });

    if (existingUser) {
      return res.status(400).json({ message: 'Phone number is already registered.' });
    }

    // Ensure password is provided
    if (!password) {
      return res.status(400).json({ message: 'Password is required' });
    }

    // Hash the password with 10 salt rounds
    const hashedPassword = await bcrypt.hash(password, 10);

    // Define defaultRole (ensure it's a string in an array)
    const defaultRole = 'defaultRole';

    // You may want to check if the role exists in ROLE_PERMISSIONS before assigning it
    if (!ROLE_PERMISSIONS[defaultRole]) {
      return res.status(500).json({ message: 'Default role is not defined in ROLE_PERMISSIONS' });
    }

    // Create the new user with roles as an array
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
        roles: [defaultRole], // Corrected to use an array here
      },
    });

    res.status(201).json({ message: 'User created successfully', newUser });
  } catch (error) {
    console.error('Error registering user:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};




const signin = async (req, res) => {
    const { phoneNumber, password } = req.body;
  
    try {
      // Find the user by phone number
      const user = await prisma.User.findUnique({
        where: { phoneNumber },
      });
  
      // Check if user exists
      if (!user) {
        return res.status(401).json({ message: 'Invalid credentials' });
      }
  
      // Compare the provided password with the hashed password in the database
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
      
  
      // Set the token in an HTTP-only cookie for security
      res.cookie('token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production', // Use secure cookies in production
        maxAge: 24 * 60 * 60 * 1000, // Cookie expires in 1 day
      });
  
      // Exclude the password from the response
      const { password: userPassword, ...userInfo } = user;
  
      res.status(200).json({ message: 'Login successful', user: userInfo });
    } catch (error) {
      console.error('Error logging in:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  };
  
  module.exports = { register, signin }; // Ensure to export the signin function
  

