const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Get all employees
exports.getEmployees = async (req, res) => {
  try {
    const employees = await prisma.employee.findMany({
      orderBy: { name: 'asc' }
    });
    res.json(employees);
  } catch (error) {
    console.error('Get employees error:', error);
    res.status(500).json({ error: 'Failed to retrieve employee directory.' });
  }
};

// Get single employee details
exports.getEmployeeById = async (req, res) => {
  try {
    const employee = await prisma.employee.findUnique({
      where: { id: req.params.id }
    });
    if (!employee) {
      return res.status(404).json({ error: 'Employee not found.' });
    }
    res.json(employee);
  } catch (error) {
    console.error('Get employee details error:', error);
    res.status(500).json({ error: 'Failed to retrieve employee profile.' });
  }
};

// Create new employee
exports.createEmployee = async (req, res) => {
  try {
    const { name, email, designation, department, pan, bankAccount, ifscCode, baseSalary, allowances, deductions } = req.body;

    if (!name || !email || !designation || baseSalary === undefined) {
      return res.status(400).json({ error: 'Name, email, designation, and monthly base salary are required.' });
    }

    const existing = await prisma.employee.findUnique({ where: { email } });
    if (existing) {
      return res.status(400).json({ error: 'An employee with this email address already exists.' });
    }

    const employee = await prisma.employee.create({
      data: {
        name,
        email,
        designation,
        department,
        pan,
        bankAccount,
        ifscCode,
        baseSalary: Number(baseSalary),
        allowances: Number(allowances || 0),
        deductions: Number(deductions || 0)
      }
    });

    res.status(201).json(employee);
  } catch (error) {
    console.error('Create employee error:', error);
    res.status(500).json({ error: 'Failed to add employee record.' });
  }
};

// Update employee profile
exports.updateEmployee = async (req, res) => {
  try {
    const { name, email, designation, department, pan, bankAccount, ifscCode, baseSalary, allowances, deductions } = req.body;

    if (!name || !email || !designation || baseSalary === undefined) {
      return res.status(400).json({ error: 'Name, email, designation, and monthly base salary are required.' });
    }

    const existing = await prisma.employee.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      return res.status(404).json({ error: 'Employee profile not found.' });
    }

    // Email collision check
    if (email !== existing.email) {
      const emailCollision = await prisma.employee.findUnique({ where: { email } });
      if (emailCollision) {
        return res.status(400).json({ error: 'An employee with this email address already exists.' });
      }
    }

    const employee = await prisma.employee.update({
      where: { id: req.params.id },
      data: {
        name,
        email,
        designation,
        department,
        pan,
        bankAccount,
        ifscCode,
        baseSalary: Number(baseSalary),
        allowances: Number(allowances || 0),
        deductions: Number(deductions || 0)
      }
    });

    res.json(employee);
  } catch (error) {
    console.error('Update employee error:', error);
    res.status(500).json({ error: 'Failed to update employee record.' });
  }
};

// Delete employee
exports.deleteEmployee = async (req, res) => {
  try {
    await prisma.employee.delete({
      where: { id: req.params.id }
    });
    res.json({ message: 'Employee profile deleted successfully.' });
  } catch (error) {
    console.error('Delete employee error:', error);
    res.status(500).json({ error: 'Failed to delete employee profile.' });
  }
};
