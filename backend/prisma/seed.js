import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';

const prisma = new PrismaClient();

async function main() {
  const email = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD || '';
  const name = process.env.ADMIN_NAME || 'Administrador CRM';
  if (!email || password.length < 12) {
    throw new Error('Define ADMIN_EMAIL y ADMIN_PASSWORD (mínimo 12 caracteres) en backend/.env antes de ejecutar el seed.');
  }
  let admin = await prisma.user.findUnique({ where: { email } });
  if (!admin) {
    admin = await prisma.user.create({ data: { name, email, passwordHash: await bcrypt.hash(password, 12), role: 'ADMIN' } });
    console.log(`Administrador inicial creado: ${email}`);
  } else {
    console.log(`Se reutiliza el administrador existente: ${email}`);
  }

  const clientsData = [
    { dni: 'DEMO1001', firstName: 'Valeria', lastName: 'Sánchez', email: 'valeria.demo@example.test', phone: '900000101', consentMarketing: true, vipTier: 'GOLD', vipScore: 420 },
    { dni: 'DEMO1002', firstName: 'Mateo', lastName: 'Rojas', email: 'mateo.demo@example.test', phone: '900000102', consentMarketing: true, vipTier: 'SILVER', vipScore: 90 },
    { dni: 'DEMO1003', firstName: 'Camila', lastName: 'Torres', email: 'camila.demo@example.test', phone: '900000103', consentMarketing: false, vipTier: 'PLATINUM', vipScore: 1250 }
  ];
  const clients = [];
  for (const data of clientsData) {
    const client = await prisma.client.upsert({ where: { dni: data.dni }, update: {}, create: data });
    clients.push(client);
  }

  const campaign = await prisma.campaign.findFirst({ where: { name: 'Experiencia VIP de bienvenida' } }) || await prisma.campaign.create({ data: { name: 'Experiencia VIP de bienvenida', description: 'Campaña de demostración con datos ficticios.', status: 'ACTIVE', targetTier: 'GOLD', startsAt: new Date(Date.now() - 86400000), endsAt: new Date(Date.now() + 30 * 86400000), channel: 'IN_APP' } });
  const benefit = await prisma.benefit.upsert({
    where: { code: 'DEMO-VIP-001' }, update: {},
    create: { campaignId: campaign.id, name: 'Beneficio de bienvenida', description: 'Beneficio ficticio para probar el flujo de asignación y canje.', code: 'DEMO-VIP-001', tier: 'GOLD', validFrom: new Date(Date.now() - 86400000), validUntil: new Date(Date.now() + 30 * 86400000), maxRedemptions: 1 }
  });
  await prisma.benefitAssignment.upsert({ where: { clientId_benefitId: { clientId: clients[0].id, benefitId: benefit.id } }, update: {}, create: { clientId: clients[0].id, benefitId: benefit.id } });

  const existingTicket = await prisma.ticket.findFirst({ where: { subject: 'Consulta de demostración CRM' } });
  if (!existingTicket) {
    const ticket = await prisma.ticket.create({ data: { ticketNo: `AC-${crypto.randomInt(100000, 999999)}`, clientId: clients[0].id, createdById: admin.id, subject: 'Consulta de demostración CRM', description: 'Ticket ficticio para validar el módulo HelpDesk.', category: 'CONSULTA', priority: 'MEDIUM', status: 'NEW', department: 'Servicio al Cliente' } });
    await prisma.ticketHistory.create({ data: { ticketId: ticket.id, actorId: admin.id, action: 'CREATED', toState: 'NEW', note: 'Ticket inicial de datos de demostración.' } });
  }

  const integrations = [
    { name: 'Sistema de membresías', type: 'REST_API' },
    { name: 'Sistema de caja / POS', type: 'REST_API' },
    { name: 'Plataforma de marketing', type: 'REST_API' }
  ];
  for (const item of integrations) { const found = await prisma.integration.findFirst({ where: { name: item.name } }); if (!found) await prisma.integration.create({ data: item }); }

  console.log('Datos de demostración cargados. Los clientes y tickets creados son ficticios.');
}

main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(async () => prisma.$disconnect());
