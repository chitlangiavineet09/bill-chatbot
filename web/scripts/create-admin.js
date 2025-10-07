const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function createAdmin() {
  try {
    // Check if admin already exists
    const existingAdmin = await prisma.user.findFirst({
      where: { email: 'admin@billchatbot.com' }
    });

    if (existingAdmin) {
      console.log('Admin user already exists:', existingAdmin.email);
      return;
    }

    // Create admin user
    const hashedPassword = await bcrypt.hash('admin123', 12);
    
    const admin = await prisma.user.create({
      data: {
        email: 'admin@billchatbot.com',
        password: hashedPassword,
        role: 'Admin'
      }
    });

    console.log('✅ Admin user created successfully:');
    console.log('Email: admin@billchatbot.com');
    console.log('Password: admin123');
    console.log('Role: Admin');
    console.log('ID:', admin.id);
  } catch (error) {
    console.error('❌ Error creating admin user:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createAdmin();
