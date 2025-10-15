const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const readline = require('readline');

const prisma = new PrismaClient();

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

async function createCustomAdmin() {
  try {
    console.log('=== Create Custom Admin User ===\n');

    // Get email from user
    const email = await question('Enter admin email: ');
    
    if (!email || !email.includes('@')) {
      console.error('❌ Invalid email address');
      rl.close();
      return;
    }

    // Check if user already exists
    const existingUser = await prisma.user.findFirst({
      where: { email: email.toLowerCase() }
    });

    if (existingUser) {
      console.log('\n⚠️  User already exists with this email:', existingUser.email);
      console.log('Current role:', existingUser.role);
      
      const updateRole = await question('\nUpdate to Admin role? (yes/no): ');
      
      if (updateRole.toLowerCase() === 'yes' || updateRole.toLowerCase() === 'y') {
        const updatedUser = await prisma.user.update({
          where: { email: existingUser.email },
          data: { role: 'Admin' }
        });
        
        console.log('\n✅ User role updated successfully:');
        console.log('Email:', updatedUser.email);
        console.log('Role:', updatedUser.role);
      }
      
      rl.close();
      return;
    }

    // Get password from user
    const password = await question('Enter admin password (min 6 characters): ');
    
    if (!password || password.length < 6) {
      console.error('❌ Password must be at least 6 characters long');
      rl.close();
      return;
    }

    // Create admin user
    const hashedPassword = await bcrypt.hash(password, 12);
    
    const admin = await prisma.user.create({
      data: {
        email: email.toLowerCase(),
        password: hashedPassword,
        role: 'Admin'
      }
    });

    console.log('\n✅ Admin user created successfully:');
    console.log('Email:', admin.email);
    console.log('Role:', admin.role);
    console.log('ID:', admin.id);
    console.log('\n⚠️  Please save your credentials securely!');
    
  } catch (error) {
    console.error('\n❌ Error creating admin user:', error);
  } finally {
    rl.close();
    await prisma.$disconnect();
  }
}

createCustomAdmin();
