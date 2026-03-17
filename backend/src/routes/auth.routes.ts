import type { FastifyInstance } from 'fastify';
import { prisma } from '../db.js';
import bcrypt from 'bcrypt';

export async function authRoutes(fastify: FastifyInstance) {

  // POST /auth/register
  fastify.post('/auth/register', async (request, reply) => {
    const { email, password, name } = request.body as any;

    if (!email || !password) {
      return reply.status(400).send({ error: 'Email and password are required' });
    }

    try {
      // Check if company already exists
      const existing = await prisma.company.findUnique({ where: { email } });
      if (existing) {
        return reply.status(409).send({ error: 'Email already registered' });
      }

      // Hash password
      const saltRounds = 10;
      const passwordHash = await bcrypt.hash(password, saltRounds);

      const company = await prisma.company.create({
        data: {
          email,
          passwordHash,
          name
        }
      });

      return reply.status(201).send({
        id: company.id,
        email: company.email,
        name: company.name,
        createdAt: company.createdAt
      });
    } catch (err) {
      request.log.error({ err }, 'Error registering company');
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // POST /auth/login
  fastify.post('/auth/login', async (request, reply) => {
    const { email, password } = request.body as any;

    if (!email || !password) {
      return reply.status(400).send({ error: 'Email and password are required' });
    }

    try {
      const company = await prisma.company.findUnique({ where: { email } });
      if (!company) {
        return reply.status(401).send({ error: 'Invalid credentials' });
      }

      const isMatch = await bcrypt.compare(password, company.passwordHash);
      if (!isMatch) {
        return reply.status(401).send({ error: 'Invalid credentials' });
      }

      // Generar JWT de 24 horas
      const token = fastify.jwt.sign(
        { id: company.id, email: company.email, role: 'company' },
        { expiresIn: '24h' }
      );

      return reply.status(200).send({
        message: 'Login successful',
        token,
        company: {
          id: company.id,
          email: company.email,
          name: company.name
        }
      });
    } catch (err) {
      request.log.error({ err }, 'Error logging in company');
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });
}
