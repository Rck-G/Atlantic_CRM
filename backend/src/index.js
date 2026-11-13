import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { PrismaClient, Role, VipTier, TicketStatus, CampaignStatus } from '@prisma/client';
import swaggerUi from 'swagger-ui-express';
import { z } from 'zod';
import crypto from 'crypto';
const prisma = new PrismaClient();
const app = express();
const PORT = Number(process.env.PORT || 4000);
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET || JWT_SECRET.length < 24) {
    if (process.env.NODE_ENV === 'production')
        throw new Error('JWT_SECRET debe tener al menos 24 caracteres en producción');
    console.warn('ADVERTENCIA: configure JWT_SECRET con al menos 24 caracteres antes de usar el CRM.');
}
app.use(helmet());
const allowedOrigins = (process.env.FRONTEND_ORIGIN || 'http://localhost:5173').split(',').map(v => v.trim());
app.use(cors({ origin: (origin, cb) => !origin || allowedOrigins.includes(origin) ? cb(null, true) : cb(new Error('Origen no permitido')), credentials: true }));
app.use(express.json({ limit: '1mb' }));
app.use(rateLimit({ windowMs: 60_000, limit: 180, standardHeaders: true, legacyHeaders: false }));
const authLimiter = rateLimit({ windowMs: 15 * 60_000, limit: 10, standardHeaders: true, legacyHeaders: false, message: { error: 'Demasiados intentos. Inténtalo más tarde.' } });
const asyncRoute = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
function signToken(user) {
    if (!JWT_SECRET || JWT_SECRET.length < 24)
        throw new Error('JWT_SECRET must be configured with at least 24 characters');
    return jwt.sign({ sub: user.id, role: user.role, clientId: user.clientId, email: user.email }, JWT_SECRET, { expiresIn: '8h', issuer: 'atlantic-crm' });
}
const auth = asyncRoute(async (req, res, next) => {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer '))
        return res.status(401).json({ error: 'Autenticación requerida' });
    try {
        const payload = jwt.verify(header.slice(7), JWT_SECRET, { issuer: 'atlantic-crm' });
        const user = await prisma.user.findUnique({ where: { id: String(payload.sub) } });
        if (!user)
            return res.status(401).json({ error: 'Sesión no válida' });
        req.user = { id: user.id, role: user.role, clientId: user.clientId, email: user.email };
        next();
    }
    catch {
        return res.status(401).json({ error: 'Token inválido o vencido' });
    }
});
const secretMatches = (provided, expected) => {
    if (typeof provided !== 'string' || typeof expected !== 'string') return false;
    const a = Buffer.from(provided); const b = Buffer.from(expected);
    return a.length === b.length && crypto.timingSafeEqual(a, b);
};
const allow = (...roles) => (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role))
        return res.status(403).json({ error: 'Permisos insuficientes' });
    next();
};
async function audit(actorId, action, resource, resourceId, outcome = 'SUCCESS') {
    await prisma.auditEvent.create({ data: { actorId, action, resource, resourceId, outcome, correlationId: crypto.randomUUID() } });
}
const isStaff = (role) => role === 'EMPLOYEE' || role === 'MARKETING' || role === 'ADMIN';
app.get('/api/health', asyncRoute(async (_req, res) => {
    await prisma.$queryRaw `SELECT 1`;
    res.json({ status: 'ok', service: 'crm-atlantic-api', database: 'connected', timestamp: new Date().toISOString() });
}));
app.post('/api/auth/bootstrap-admin', authLimiter, asyncRoute(async (req, res) => {
    if (process.env.NODE_ENV === 'production' && process.env.ALLOW_BOOTSTRAP_ADMIN !== 'true') return res.status(404).json({ error: 'Ruta no disponible' });
    const schema = z.object({ name: z.string().min(2), email: z.string().email(), password: z.string().min(12) });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success)
        return res.status(400).json({ error: 'Datos inválidos: contraseña mínima de 12 caracteres', details: parsed.error.flatten() });
    let user;
    try {
        user = await prisma.$transaction(async (tx) => {
            if (await tx.user.count() > 0) throw new Error('BOOTSTRAP_ALREADY_DONE');
            return tx.user.create({ data: { name: parsed.data.name, email: parsed.data.email.toLowerCase(), passwordHash: await bcrypt.hash(parsed.data.password, 12), role: 'ADMIN' } });
        }, { isolationLevel: 'Serializable' });
    } catch (e) {
        if (e.message === 'BOOTSTRAP_ALREADY_DONE' || e.code === 'P2034') return res.status(409).json({ error: 'La inicialización ya fue realizada o está en curso' });
        throw e;
    }
    await audit(user.id, 'BOOTSTRAP_ADMIN', 'User', user.id);
    res.status(201).json({ id: user.id, email: user.email, role: user.role, message: 'Administrador inicial creado. Desactiva este endpoint después de la configuración inicial.' });
}));
app.post('/api/auth/login', authLimiter, asyncRoute(async (req, res) => {
    const parsed = z.object({ email: z.string().email(), password: z.string().min(1) }).safeParse(req.body);
    if (!parsed.success)
        return res.status(400).json({ error: 'Correo o contraseña inválidos' });
    const user = await prisma.user.findUnique({ where: { email: parsed.data.email.toLowerCase() } });
    if (!user || !(await bcrypt.compare(parsed.data.password, user.passwordHash))) {
        await audit(user?.id, 'LOGIN_FAILED', 'Auth', undefined, 'DENIED');
        return res.status(401).json({ error: 'Correo o contraseña incorrectos' });
    }
    await audit(user.id, 'LOGIN_SUCCESS', 'Auth', user.id);
    res.json({ token: signToken(user), user: { id: user.id, name: user.name, email: user.email, role: user.role, clientId: user.clientId } });
}));
app.get('/api/auth/me', auth, asyncRoute(async (req, res) => {
    const u = await prisma.user.findUnique({ where: { id: req.user.id }, select: { id: true, name: true, email: true, role: true, clientId: true } });
    res.json(u);
}));
app.patch('/api/auth/me', auth, asyncRoute(async (req, res) => {
    const parsed = z.object({ name: z.string().trim().min(2).max(100).optional(), email: z.string().email().transform(v => v.toLowerCase()).optional() }).refine(v => Object.keys(v).length > 0).safeParse(req.body);
    if (!parsed.success)
        return res.status(400).json({ error: 'Nombre o correo inválido', details: parsed.error.flatten() });
    try {
        const updated = await prisma.user.update({ where: { id: req.user.id }, data: parsed.data, select: { id: true, name: true, email: true, role: true, clientId: true } });
        await audit(req.user.id, 'PROFILE_UPDATED', 'User', updated.id);
        res.json(updated);
    }
    catch (e) {
        if (e.code === 'P2002')
            return res.status(409).json({ error: 'Ese correo ya está registrado' });
        throw e;
    }
}));
const clientSchema = z.object({
    dni: z.string().trim().min(5).max(20).transform(v => v.replace(/\s/g, '').toUpperCase()),
    firstName: z.string().trim().min(1).max(80),
    lastName: z.string().trim().min(1).max(100),
    email: z.string().email().optional().or(z.literal('')),
    phone: z.string().max(30).optional(),
    consentMarketing: z.boolean().optional()
});
app.get('/api/clients', auth, allow('EMPLOYEE', 'MARKETING', 'ADMIN'), asyncRoute(async (req, res) => {
    const page = Math.max(1, Number(req.query.page || 1));
    const limit = Math.min(100, Math.max(1, Number(req.query.limit || 20)));
    const q = String(req.query.q || '').trim();
    const clients = await prisma.client.findMany({
        where: q ? { OR: [{ dni: { contains: q, mode: 'insensitive' } }, { firstName: { contains: q, mode: 'insensitive' } }, { lastName: { contains: q, mode: 'insensitive' } }, { email: { contains: q, mode: 'insensitive' } }] } : {},
        orderBy: { createdAt: 'desc' }, skip: (page - 1) * limit, take: limit,
        select: { id: true, dni: true, firstName: true, lastName: true, email: true, phone: true, vipTier: true, vipScore: true, createdAt: true, consentMarketing: true }
    });
    const total = await prisma.client.count({ where: q ? { OR: [{ dni: { contains: q, mode: 'insensitive' } }, { firstName: { contains: q, mode: 'insensitive' } }, { lastName: { contains: q, mode: 'insensitive' } }, { email: { contains: q, mode: 'insensitive' } }] } : {} });
    res.json({ data: clients, page, limit, total });
}));
app.post('/api/clients', auth, allow('EMPLOYEE', 'ADMIN'), asyncRoute(async (req, res) => {
    const parsed = clientSchema.safeParse(req.body);
    if (!parsed.success)
        return res.status(400).json({ error: 'Datos del cliente inválidos', details: parsed.error.flatten() });
    try {
        const client = await prisma.client.create({ data: { ...parsed.data, email: parsed.data.email || null, consentMarketing: parsed.data.consentMarketing ?? false } });
        await audit(req.user.id, 'CLIENT_CREATED', 'Client', client.id);
        res.status(201).json(client);
    }
    catch (e) {
        if (e.code === 'P2002')
            return res.status(409).json({ error: 'Ya existe un cliente con ese DNI' });
        throw e;
    }
}));
app.get('/api/clients/:id', auth, asyncRoute(async (req, res) => {
    const own = req.user.role === 'CLIENT';
    if (own && req.user.clientId !== req.params.id)
        return res.status(403).json({ error: 'No puedes consultar otro cliente' });
    if (!own && !isStaff(req.user.role))
        return res.status(403).json({ error: 'Permisos insuficientes' });
    const client = await prisma.client.findUnique({ where: { id: req.params.id }, include: { benefits: { include: { benefit: true } }, reservations: { include: { restaurant: true }, orderBy: { startsAt: 'desc' }, take: 20 }, sales: { orderBy: { soldAt: 'desc' }, take: 20 }, tickets: { select: { id: true, ticketNo: true, subject: true, status: true, priority: true, createdAt: true, updatedAt: true } }, activity: { orderBy: { occurredAt: 'desc' }, take: 30 } } });
    if (!client)
        return res.status(404).json({ error: 'Cliente no encontrado' });
    res.json(client);
}));
app.patch('/api/clients/:id', auth, asyncRoute(async (req, res) => {
    const own = req.user.role === 'CLIENT' && req.user.clientId === req.params.id;
    if (!own && !['EMPLOYEE', 'ADMIN'].includes(req.user.role))
        return res.status(403).json({ error: 'Permisos insuficientes' });
    const schema = own
        ? z.object({ email: z.string().email().optional().or(z.literal('')), phone: z.string().max(30).optional(), preferences: z.record(z.any()).optional(), consentMarketing: z.boolean().optional() })
        : clientSchema.partial();
    const parsed = schema.safeParse(req.body);
    if (!parsed.success)
        return res.status(400).json({ error: 'Datos inválidos', details: parsed.error.flatten() });
    try {
        const data = { ...parsed.data };
        if ('email' in data && data.email === '')
            data.email = null;
        const client = await prisma.client.update({ where: { id: req.params.id }, data });
        await audit(req.user.id, 'CLIENT_UPDATED', 'Client', client.id);
        res.json(client);
    }
    catch (e) {
        if (e.code === 'P2025')
            return res.status(404).json({ error: 'Cliente no encontrado' });
        if (e.code === 'P2002')
            return res.status(409).json({ error: 'DNI ya registrado' });
        throw e;
    }
}));
app.delete('/api/clients/:id', auth, allow('ADMIN', 'EMPLOYEE'), asyncRoute(async (req, res) => {
    const client = await prisma.client.findUnique({ where: { id: req.params.id }, include: { _count: { select: { tickets: true, benefits: true, activity: true } }, user: { select: { id: true } } } });
    if (!client)
        return res.status(404).json({ error: 'Cliente no encontrado' });
    if (client._count.tickets || client._count.benefits || client._count.activity || client.user)
        return res.status(409).json({ error: 'No se puede eliminar: el cliente tiene tickets, beneficios, actividad o una cuenta vinculada. Conserva el historial o desvincula las relaciones primero.', relations: client._count });
    await prisma.client.delete({ where: { id: client.id } });
    await audit(req.user.id, 'CLIENT_DELETED', 'Client', client.id);
    res.json({ success: true, id: client.id });
}));
// Registra actividad transaccional desde una fuente autorizada. En producción, esta ruta
// debe restringirse a empleados o conectores autenticados y no a usuarios finales.
app.post('/api/clients/:id/activity', auth, allow('EMPLOYEE', 'ADMIN'), asyncRoute(async (req, res) => {
    const parsed = z.object({ source: z.string().min(2).max(80), kind: z.enum(['VISIT', 'PURCHASE', 'GAMEPLAY', 'RESTAURANT', 'EVENT']), amount: z.number().finite().nonnegative().optional(), occurredAt: z.string().datetime().optional() }).safeParse(req.body);
    if (!parsed.success)
        return res.status(400).json({ error: 'Actividad inválida', details: parsed.error.flatten() });
    const client = await prisma.client.findUnique({ where: { id: req.params.id } });
    if (!client)
        return res.status(404).json({ error: 'Cliente no encontrado' });
    const idempotencyKey = String(req.headers['idempotency-key'] || '').trim();
    if (idempotencyKey && idempotencyKey.length > 120) return res.status(400).json({ error: 'Idempotency-Key demasiado largo' });
    if (idempotencyKey) {
        const existing = await prisma.clientActivity.findUnique({ where: { idempotencyKey } });
        if (existing && existing.clientId !== client.id) return res.status(409).json({ error: 'Idempotency-Key ya fue utilizado para otro cliente' });
        if (existing) return res.status(200).json({ ...existing, idempotentReplay: true });
    }
    let activity;
    try {
        activity = await prisma.clientActivity.create({ data: { clientId: client.id, source: parsed.data.source, kind: parsed.data.kind, amount: parsed.data.amount, occurredAt: parsed.data.occurredAt ? new Date(parsed.data.occurredAt) : new Date(), idempotencyKey: idempotencyKey || null } });
    } catch (e) {
        if (e.code === 'P2002' && idempotencyKey) {
            const existing = await prisma.clientActivity.findUnique({ where: { idempotencyKey } });
            if (existing && existing.clientId !== client.id) return res.status(409).json({ error: 'Idempotency-Key ya fue utilizado para otro cliente' });
            if (existing) return res.status(200).json({ ...existing, idempotentReplay: true });
        }
        throw e;
    }
    await audit(req.user.id, 'CLIENT_ACTIVITY_RECORDED', 'ClientActivity', activity.id);
    res.status(201).json(activity);
}));
// Recalcula score y nivel VIP usando actividad de los últimos 365 días.
// Los umbrales son valores de arranque y deben ser aprobados por Marketing/Finanzas antes de producción.
app.post('/api/vip/recalculate', auth, allow('MARKETING', 'ADMIN'), asyncRoute(async (req, res) => {
    const schema = z.object({ clientId: z.string().optional(), dryRun: z.boolean().optional() });
    const parsed = schema.safeParse(req.body ?? {});
    if (!parsed.success)
        return res.status(400).json({ error: 'Solicitud inválida', details: parsed.error.flatten() });
    const since = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
    const clients = await prisma.client.findMany({ where: parsed.data.clientId ? { id: parsed.data.clientId } : {}, select: { id: true, vipTier: true } });
    if (parsed.data.clientId && clients.length === 0) return res.status(404).json({ error: 'Cliente no encontrado' });
    const [spendGroups, visitGroups] = await Promise.all([
        prisma.clientActivity.groupBy({ by: ['clientId'], where: { occurredAt: { gte: since }, amount: { not: null }, ...(parsed.data.clientId ? { clientId: parsed.data.clientId } : {}) }, _sum: { amount: true } }),
        prisma.clientActivity.groupBy({ by: ['clientId'], where: { occurredAt: { gte: since }, kind: { in: ['VISIT', 'GAMEPLAY', 'RESTAURANT', 'EVENT'] }, ...(parsed.data.clientId ? { clientId: parsed.data.clientId } : {}) }, _count: { _all: true } })
    ]);
    const spendByClient = new Map(spendGroups.map(x => [x.clientId, x._sum.amount ?? 0]));
    const visitsByClient = new Map(visitGroups.map(x => [x.clientId, x._count._all]));
    const results = [];
    for (const client of clients) {
        const spend = spendByClient.get(client.id) ?? 0;
        const visits = visitsByClient.get(client.id) ?? 0;
        // Score de referencia configurable en una futura política aprobada por negocio.
        const score = Math.round(((spend / 100) + (visits * 10)) * 100) / 100;
        const tier = score >= 1000 ? 'PLATINUM' : score >= 250 ? 'GOLD' : 'SILVER';
        if (!parsed.data.dryRun) await prisma.client.update({ where: { id: client.id }, data: { vipScore: score, vipTier: tier, vipEvaluatedAt: new Date() } });
        results.push({ clientId: client.id, previousTier: client.vipTier, tier, score, annualSpend: spend, activityCount: visits, dryRun: !!parsed.data.dryRun });
    }
    await audit(req.user.id, parsed.data.dryRun ? 'VIP_RECALCULATION_PREVIEWED' : 'VIP_RECALCULATED', 'Client', parsed.data.clientId);
    res.json({ evaluated: results.length, windowDays: 365, thresholds: { silver: '<250', gold: '250–999.99', platinum: '>=1000' }, results, note: 'Umbrales de referencia; validar con el negocio antes de producción.' });
}));
// Vista previa de audiencia para una campaña segmentada.
app.get('/api/campaigns/:id/audience', auth, allow('MARKETING', 'ADMIN'), asyncRoute(async (req, res) => {
    const campaign = await prisma.campaign.findUnique({ where: { id: req.params.id } });
    if (!campaign)
        return res.status(404).json({ error: 'Campaña no encontrada' });
    const where = {};
    if (campaign.targetTier)
        where.vipTier = campaign.targetTier;
    const clients = await prisma.client.findMany({ where, select: { id: true, firstName: true, lastName: true, vipTier: true, consentMarketing: true }, orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }] });
    res.json({ campaignId: campaign.id, campaignName: campaign.name, targetTier: campaign.targetTier, totalEligible: clients.length, consented: clients.filter(c => c.consentMarketing).length, clients: clients.filter(c => c.consentMarketing), note: 'Solo se incluyen clientes con consentimiento de marketing en la audiencia utilizable.' });
}));
app.post('/api/campaigns/:id/assign-benefits', auth, allow('MARKETING', 'ADMIN'), asyncRoute(async (req, res) => {
    const campaign = await prisma.campaign.findUnique({ where: { id: req.params.id }, include: { benefits: true } });
    if (!campaign)
        return res.status(404).json({ error: 'Campaña no encontrada' });
    const now = new Date();
    if (campaign.status !== 'ACTIVE')
        return res.status(409).json({ error: 'La campaña debe estar ACTIVE para asignar beneficios' });
    if ((campaign.startsAt && campaign.startsAt > now) || (campaign.endsAt && campaign.endsAt < now))
        return res.status(409).json({ error: 'La campaña está fuera de su periodo de vigencia' });
    const benefits = campaign.benefits.filter(b => b.status === 'AVAILABLE' && (!b.validFrom || b.validFrom <= now) && (!b.validUntil || b.validUntil >= now));
    if (!benefits.length)
        return res.status(409).json({ error: 'La campaña no tiene beneficios disponibles y vigentes' });
    const clientWhere = { consentMarketing: true };
    if (campaign.targetTier)
        clientWhere.vipTier = campaign.targetTier;
    const clients = await prisma.client.findMany({ where: clientWhere, select: { id: true, vipTier: true } });
    let assigned = 0;
    await prisma.$transaction(async (tx) => {
        for (const benefit of benefits) {
            const eligible = clients.filter(c => !benefit.tier || c.vipTier === benefit.tier);
            if (!eligible.length)
                continue;
            const result = await tx.benefitAssignment.createMany({ data: eligible.map(c => ({ clientId: c.id, benefitId: benefit.id })), skipDuplicates: true });
            assigned += result.count;
        }
    });
    await audit(req.user.id, 'CAMPAIGN_BENEFITS_ASSIGNED', 'Campaign', campaign.id);
    res.json({ campaignId: campaign.id, eligibleClients: clients.length, benefitsProcessed: benefits.length, assignmentsCreated: assigned, note: 'La asignación solo incluye clientes con consentimiento de marketing y nivel VIP compatible.' });
}));
app.get('/api/campaigns', auth, allow('MARKETING', 'ADMIN', 'EMPLOYEE'), asyncRoute(async (_req, res) => {
    res.json(await prisma.campaign.findMany({ include: { benefits: true }, orderBy: { createdAt: 'desc' } }));
}));
app.post('/api/campaigns', auth, allow('MARKETING', 'ADMIN'), asyncRoute(async (req, res) => {
    const schema = z.object({ name: z.string().min(2), description: z.string().optional(), status: z.nativeEnum(CampaignStatus).optional(), targetTier: z.nativeEnum(VipTier).optional(), startsAt: z.string().datetime().optional(), endsAt: z.string().datetime().optional(), channel: z.string().optional() });
    const p = schema.safeParse(req.body);
    if (!p.success)
        return res.status(400).json({ error: 'Campaña inválida', details: p.error.flatten() });
    if (p.data.startsAt && p.data.endsAt && new Date(p.data.startsAt) >= new Date(p.data.endsAt))
        return res.status(400).json({ error: 'La fecha final debe ser posterior a la inicial' });
    const c = await prisma.campaign.create({ data: { ...p.data, startsAt: p.data.startsAt ? new Date(p.data.startsAt) : undefined, endsAt: p.data.endsAt ? new Date(p.data.endsAt) : undefined } });
    await audit(req.user.id, 'CAMPAIGN_CREATED', 'Campaign', c.id);
    res.status(201).json(c);
}));
app.get('/api/benefits', auth, asyncRoute(async (req, res) => {
    if (req.user.role === 'CLIENT') {
        if (!req.user.clientId)
            return res.json([]);
        return res.json(await prisma.benefitAssignment.findMany({ where: { clientId: req.user.clientId }, include: { benefit: true }, orderBy: { assignedAt: 'desc' } }));
    }
    if (!isStaff(req.user.role))
        return res.status(403).json({ error: 'Permisos insuficientes' });
    res.json(await prisma.benefit.findMany({ include: { campaign: true }, orderBy: { createdAt: 'desc' } }));
}));
app.post('/api/benefits', auth, allow('MARKETING', 'ADMIN'), asyncRoute(async (req, res) => {
    const p = z.object({ name: z.string().min(2), description: z.string().optional(), code: z.string().min(3).max(40), tier: z.nativeEnum(VipTier).optional(), campaignId: z.string().optional(), validFrom: z.string().datetime().optional(), validUntil: z.string().datetime().optional(), maxRedemptions: z.number().int().positive().optional() }).safeParse(req.body);
    if (!p.success)
        return res.status(400).json({ error: 'Beneficio inválido', details: p.error.flatten() });
    try {
        const b = await prisma.benefit.create({ data: { ...p.data, validFrom: p.data.validFrom ? new Date(p.data.validFrom) : undefined, validUntil: p.data.validUntil ? new Date(p.data.validUntil) : undefined } });
        await audit(req.user.id, 'BENEFIT_CREATED', 'Benefit', b.id);
        res.status(201).json(b);
    }
    catch (e) {
        if (e.code === 'P2002')
            return res.status(409).json({ error: 'El código ya existe' });
        throw e;
    }
}));
app.post('/api/benefits/:id/assign', auth, allow('EMPLOYEE', 'MARKETING', 'ADMIN'), asyncRoute(async (req, res) => {
    const p = z.object({ clientId: z.string().min(1) }).safeParse(req.body);
    if (!p.success)
        return res.status(400).json({ error: 'clientId es obligatorio' });
    const benefit = await prisma.benefit.findUnique({ where: { id: req.params.id } });
    if (!benefit)
        return res.status(404).json({ error: 'Beneficio no encontrado' });
    if (benefit.status !== 'AVAILABLE')
        return res.status(409).json({ error: 'Beneficio no disponible' });
    const client = await prisma.client.findUnique({ where: { id: p.data.clientId } });
    if (!client)
        return res.status(404).json({ error: 'Cliente no encontrado' });
    if (benefit.tier && benefit.tier !== client.vipTier)
        return res.status(409).json({ error: 'El cliente no cumple el nivel VIP requerido' });
    if (benefit.validFrom && benefit.validFrom > new Date())
        return res.status(409).json({ error: 'El beneficio aún no está vigente' });
    if (benefit.validUntil && benefit.validUntil < new Date())
        return res.status(409).json({ error: 'El beneficio está vencido' });
    try {
        const assignment = await prisma.benefitAssignment.create({ data: { clientId: client.id, benefitId: benefit.id } });
        await audit(req.user.id, 'BENEFIT_ASSIGNED', 'BenefitAssignment', assignment.id);
        res.status(201).json(assignment);
    }
    catch (e) {
        if (e.code === 'P2002')
            return res.status(409).json({ error: 'Este beneficio ya está asignado al cliente' });
        throw e;
    }
}));
app.post('/api/benefits/:id/redeem', auth, allow('EMPLOYEE', 'ADMIN'), asyncRoute(async (req, res) => {
    const p = z.object({ clientId: z.string().min(1) }).safeParse(req.body);
    if (!p.success)
        return res.status(400).json({ error: 'clientId es obligatorio' });
    const benefit = await prisma.benefit.findUnique({ where: { id: req.params.id } });
    if (!benefit)
        return res.status(404).json({ error: 'Beneficio no encontrado' });
    const now = new Date();
    if (benefit.status !== 'AVAILABLE' || (benefit.validFrom && benefit.validFrom > now) || (benefit.validUntil && benefit.validUntil < now))
        return res.status(409).json({ error: 'Beneficio no disponible o vencido' });
    if (benefit.tier) {
        const client = await prisma.client.findUnique({ where: { id: p.data.clientId } });
        if (!client || client.vipTier !== benefit.tier)
            return res.status(409).json({ error: 'Cliente no elegible para este beneficio' });
    }
    try {
        const result = await prisma.$transaction(async (tx) => {
            const claimed = await tx.benefitAssignment.updateMany({
                where: { clientId: p.data.clientId, benefitId: benefit.id, status: 'AVAILABLE' },
                data: { status: 'REDEEMED', redeemedAt: now, redeemedBy: req.user.id }
            });
            if (claimed.count !== 1) {
                const assignment = await tx.benefitAssignment.findUnique({ where: { clientId_benefitId: { clientId: p.data.clientId, benefitId: benefit.id } } });
                if (!assignment) throw new Error('NOT_ASSIGNED');
                throw new Error(assignment.status === 'REDEEMED' ? 'ALREADY_REDEEMED' : 'NOT_ASSIGNED');
            }
            const quota = await tx.benefit.updateMany({
                where: { id: benefit.id, status: 'AVAILABLE', redeemedCount: { lt: benefit.maxRedemptions } },
                data: { redeemedCount: { increment: 1 } }
            });
            if (quota.count !== 1) throw new Error('BENEFIT_LIMIT_REACHED');
            return tx.benefitAssignment.findUnique({ where: { clientId_benefitId: { clientId: p.data.clientId, benefitId: benefit.id } } });
        });
        await audit(req.user.id, 'BENEFIT_REDEEMED', 'BenefitAssignment', result.id);
        res.json(result);
    }
    catch (e) {
        if (['BENEFIT_LIMIT_REACHED', 'ALREADY_REDEEMED', 'NOT_ASSIGNED'].includes(e.message))
            return res.status(409).json({ error: { BENEFIT_LIMIT_REACHED: 'Se alcanzó el límite de canjes', ALREADY_REDEEMED: 'El beneficio ya fue canjeado', NOT_ASSIGNED: 'El beneficio no está asignado al cliente' }[e.message] });
        throw e;
    }
}));
app.get('/api/tickets', auth, asyncRoute(async (req, res) => {
    const where = {};
    if (req.user.role === 'CLIENT')
        where.clientId = req.user.clientId || '__none__';
    else if (!isStaff(req.user.role))
        return res.status(403).json({ error: 'Permisos insuficientes' });
    if (req.query.status) where.status = String(req.query.status);
    const page = Math.max(1, Number(req.query.page || 1));
    const limit = Math.min(100, Math.max(1, Number(req.query.limit || 20)));
    const [data, total] = await Promise.all([
        prisma.ticket.findMany({ where, orderBy: { updatedAt: 'desc' }, skip: (page - 1) * limit, take: limit, include: { client: { select: { id: true, firstName: true, lastName: true } }, history: { orderBy: { createdAt: 'asc' } } } }),
        prisma.ticket.count({ where })
    ]);
    res.json({ data, page, limit, total, pages: Math.ceil(total / limit) });
}));
app.post('/api/tickets', auth, asyncRoute(async (req, res) => {
    const p = z.object({ subject: z.string().min(3).max(160), description: z.string().min(5).max(5000), category: z.string().optional(), channel: z.string().optional(), priority: z.nativeEnum((await import('@prisma/client')).TicketPriority).optional(), clientId: z.string().optional() }).safeParse(req.body);
    if (!p.success)
        return res.status(400).json({ error: 'Ticket inválido', details: p.error.flatten() });
    if (req.user.role === 'CLIENT' && !req.user.clientId)
        return res.status(400).json({ error: 'La cuenta no está vinculada a un cliente' });
    const clientId = req.user.role === 'CLIENT' ? req.user.clientId : p.data.clientId;
    const ticket = await prisma.ticket.create({ data: { ticketNo: `AC-${Date.now().toString().slice(-8)}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`, subject: p.data.subject, description: p.data.description, category: p.data.category, channel: p.data.channel, priority: p.data.priority, clientId, createdById: req.user.id, history: { create: { actorId: req.user.id, action: 'CREATED', toState: 'NEW', note: 'Ticket registrado' } } } });
    await audit(req.user.id, 'TICKET_CREATED', 'Ticket', ticket.id);
    res.status(201).json(ticket);
}));
app.patch('/api/tickets/:id', auth, allow('EMPLOYEE', 'MARKETING', 'ADMIN'), asyncRoute(async (req, res) => {
    const p = z.object({ status: z.nativeEnum(TicketStatus).optional(), priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(), department: z.string().optional(), resolution: z.string().optional() }).safeParse(req.body);
    if (!p.success)
        return res.status(400).json({ error: 'Actualización inválida', details: p.error.flatten() });
    const current = await prisma.ticket.findUnique({ where: { id: req.params.id } });
    if (!current)
        return res.status(404).json({ error: 'Ticket no encontrado' });
    const transitions = { NEW: ['PENDING', 'IN_PROGRESS', 'CLOSED'], PENDING: ['IN_PROGRESS', 'WAITING_INFO', 'CLOSED'], IN_PROGRESS: ['PENDING', 'WAITING_INFO', 'RESOLVED'], WAITING_INFO: ['IN_PROGRESS', 'PENDING', 'CLOSED'], RESOLVED: ['CLOSED', 'IN_PROGRESS'], CLOSED: ['IN_PROGRESS'] };
    if (p.data.status && p.data.status !== current.status && !transitions[current.status].includes(p.data.status))
        return res.status(409).json({ error: `Transición no permitida: ${current.status} → ${p.data.status}` });
    if (p.data.status === 'RESOLVED' && !p.data.resolution?.trim() && !current.resolution)
        return res.status(400).json({ error: 'Indica la resolución antes de resolver el ticket' });
    const updated = await prisma.$transaction(async (tx) => {
        const t = await tx.ticket.update({ where: { id: current.id }, data: p.data });
        await tx.ticketHistory.create({ data: { ticketId: t.id, actorId: req.user.id, action: 'UPDATED', fromState: current.status, toState: t.status, note: p.data.resolution || p.data.department || undefined } });
        return t;
    });
    await audit(req.user.id, 'TICKET_UPDATED', 'Ticket', updated.id);
    res.json(updated);
}));
app.get('/api/analytics/summary', auth, allow('MARKETING', 'ADMIN'), asyncRoute(async (_req, res) => {
    const [clients, campaigns, benefits, tickets, reservations, events, sales, tiers, ticketGroups] = await Promise.all([
        prisma.client.count(), prisma.campaign.count(), prisma.benefit.count(), prisma.ticket.count(),
        prisma.reservation.count(), prisma.event.count(), prisma.sale.aggregate({ where: { status: 'PAID' }, _sum: { amount: true }, _count: { _all: true } }),
        prisma.client.groupBy({ by: ['vipTier'], _count: { _all: true } }),
        prisma.ticket.groupBy({ by: ['status'], _count: { _all: true } })
    ]);
    res.json({ clients, campaigns, benefits, tickets, reservations, events, paidSalesCount: sales._count._all, paidSalesAmount: Number(sales._sum.amount ?? 0), vipDistribution: tiers.map(x => ({ tier: x.vipTier, count: x._count._all })), ticketsByStatus: ticketGroups.map(x => ({ status: x.status, count: x._count._all })), note: 'Ingresos solo reflejan ventas POS recibidas y conciliadas como PAID; LTV/ROI requieren costes y fuentes completas.' });
}));
app.get('/api/reports/clients.csv', auth, allow('MARKETING', 'ADMIN'), asyncRoute(async (_req, res) => {
    const rows = await prisma.client.findMany({ select: { dni: true, firstName: true, lastName: true, email: true, vipTier: true, createdAt: true }, orderBy: { createdAt: 'desc' }, take: 10000 });
    const safe = (v) => {
        const s = String(v ?? '');
        return /^[=+\-@]/.test(s) ? `'${s}` : s;
    };
    const csv = ['DNI,Nombre,Apellido,Correo,Nivel VIP,Fecha de registro', ...rows.map(r => [r.dni, r.firstName, r.lastName, r.email, r.vipTier, r.createdAt.toISOString()].map(safe).map(v => `"${v.replace(/"/g, '""')}"`).join(','))].join('\r\n');
    await audit((_req.user?.id), 'REPORT_EXPORTED', 'Client');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="crm-clientes.csv"');
    res.send('\uFEFF' + csv);
}));
app.get('/api/audit', auth, allow('ADMIN'), asyncRoute(async (req, res) => {
    const events = await prisma.auditEvent.findMany({ take: 200, orderBy: { createdAt: 'desc' }, include: { actor: { select: { name: true, email: true } } } });
    res.json(events);
}));
app.get('/api/users', auth, allow('ADMIN'), asyncRoute(async (_req, res) => {
    res.json(await prisma.user.findMany({ select: { id: true, name: true, email: true, role: true, clientId: true, createdAt: true }, orderBy: { createdAt: 'desc' } }));
}));
app.post('/api/users', auth, allow('ADMIN'), asyncRoute(async (req, res) => {
    const p = z.object({ name: z.string().min(2), email: z.string().email(), password: z.string().min(12), role: z.nativeEnum(Role), clientId: z.string().optional() }).safeParse(req.body);
    if (!p.success)
        return res.status(400).json({ error: 'Usuario inválido', details: p.error.flatten() });
    if (p.data.role === 'CLIENT' && !p.data.clientId)
        return res.status(400).json({ error: 'Selecciona el cliente existente que se vinculará a esta cuenta' });
    if (p.data.role !== 'CLIENT' && p.data.clientId)
        return res.status(400).json({ error: 'Solo las cuentas CLIENT pueden vincularse a un cliente' });
    if (p.data.role === 'CLIENT' && p.data.clientId) {
        const client = await prisma.client.findUnique({ where: { id: p.data.clientId }, select: { id: true } });
        if (!client)
            return res.status(404).json({ error: 'El cliente seleccionado no existe. Actualiza la lista e inténtalo de nuevo.' });
    }
    try {
        const u = await prisma.user.create({ data: { name: p.data.name, email: p.data.email.toLowerCase(), passwordHash: await bcrypt.hash(p.data.password, 12), role: p.data.role, clientId: p.data.clientId } });
        await audit(req.user.id, 'USER_CREATED', 'User', u.id);
        res.status(201).json({ id: u.id, name: u.name, email: u.email, role: u.role });
    }
    catch (e) {
        if (e.code === 'P2002')
            return res.status(409).json({ error: 'Correo o cliente ya asociado a otra cuenta' });
        throw e;
    }
}));
app.patch('/api/users/:id', auth, allow('ADMIN'), asyncRoute(async (req, res) => {
    if (req.params.id === req.user.id)
        return res.status(400).json({ error: 'Para modificar tu propia cuenta, utiliza Mi perfil. No puedes cambiar tu rol desde esta pantalla.' });
    const parsed = z.object({
        name: z.string().trim().min(2).max(100),
        email: z.string().trim().email().transform(v => v.toLowerCase()),
        role: z.nativeEnum(Role),
        password: z.string().min(12).optional().or(z.literal('')),
        clientId: z.string().optional().or(z.literal(''))
    }).safeParse(req.body);
    if (!parsed.success)
        return res.status(400).json({ error: 'Datos de usuario inválidos. La contraseña, si se cambia, debe tener al menos 12 caracteres.', details: parsed.error.flatten() });
    const target = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!target)
        return res.status(404).json({ error: 'Usuario no encontrado' });
    const clientId = parsed.data.role === 'CLIENT' ? (parsed.data.clientId || undefined) : null;
    if (parsed.data.role === 'CLIENT' && !clientId)
        return res.status(400).json({ error: 'Selecciona un cliente para la cuenta CLIENT' });
    if (parsed.data.role !== 'CLIENT' && parsed.data.clientId)
        return res.status(400).json({ error: 'Solo las cuentas CLIENT pueden vincularse a un cliente' });
    if (clientId) {
        const client = await prisma.client.findUnique({ where: { id: clientId }, select: { id: true } });
        if (!client)
            return res.status(404).json({ error: 'El cliente seleccionado no existe' });
        const linked = await prisma.user.findUnique({ where: { clientId }, select: { id: true } });
        if (linked && linked.id !== target.id)
            return res.status(409).json({ error: 'Ese cliente ya está vinculado a otra cuenta' });
    }
    if (target.role === 'ADMIN' && parsed.data.role !== 'ADMIN') {
        const adminCount = await prisma.user.count({ where: { role: 'ADMIN' } });
        if (adminCount <= 1)
            return res.status(409).json({ error: 'No se puede quitar el rol al único administrador del sistema' });
    }
    try {
        const data = { name: parsed.data.name, email: parsed.data.email, role: parsed.data.role, clientId: clientId || null };
        if (parsed.data.password)
            data.passwordHash = await bcrypt.hash(parsed.data.password, 12);
        const updated = await prisma.user.update({ where: { id: target.id }, data, select: { id: true, name: true, email: true, role: true, clientId: true, createdAt: true } });
        await audit(req.user.id, 'USER_UPDATED', 'User', updated.id);
        res.json(updated);
    }
    catch (e) {
        if (e.code === 'P2002')
            return res.status(409).json({ error: 'El correo o cliente ya está asociado a otra cuenta' });
        throw e;
    }
}));
app.delete('/api/users/:id', auth, allow('ADMIN'), asyncRoute(async (req, res) => {
    if (req.params.id === req.user.id)
        return res.status(400).json({ error: 'No puedes eliminar tu propia cuenta mientras tienes la sesión iniciada' });
    const target = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!target)
        return res.status(404).json({ error: 'Usuario no encontrado' });
    if (target.role === 'ADMIN' && await prisma.user.count({ where: { role: 'ADMIN' } }) <= 1)
        return res.status(409).json({ error: 'No se puede eliminar el único administrador del sistema' });
    await prisma.$transaction(async (tx) => {
        // Conserva los tickets y su historial: reasigna la propiedad del ticket al administrador que realiza la operación.
        await tx.ticket.updateMany({ where: { createdById: target.id }, data: { createdById: req.user.id } });
        await tx.user.delete({ where: { id: target.id } });
        await tx.auditEvent.create({ data: { actorId: req.user.id, action: 'USER_DELETED', resource: 'User', resourceId: target.id, outcome: 'SUCCESS', correlationId: crypto.randomUUID() } });
    });
    res.json({ ok: true, message: 'Usuario eliminado. El historial de tickets se ha conservado.' });
}));
app.get('/api/integrations', auth, allow('ADMIN'), asyncRoute(async (_req, res) => res.json(await prisma.integration.findMany({ orderBy: { name: 'asc' } }))));
app.post('/api/integrations', auth, allow('ADMIN'), asyncRoute(async (req, res) => {
    const p = z.object({ name: z.string().min(2), type: z.string().min(2), endpoint: z.string().url().optional(), enabled: z.boolean().optional() }).safeParse(req.body);
    if (!p.success)
        return res.status(400).json({ error: 'Integración inválida', details: p.error.flatten() });
    const item = await prisma.integration.create({ data: p.data });
    await audit(req.user.id, 'INTEGRATION_CREATED', 'Integration', item.id);
    res.status(201).json(item);
}));
app.post('/api/integrations/:id/sync', auth, allow('ADMIN'), asyncRoute(async (req, res) => {
    const item = await prisma.integration.findUnique({ where: { id: req.params.id } });
    if (!item)
        return res.status(404).json({ error: 'Integración no encontrada' });
    // Deliberately does not contact external endpoints: provider-specific authentication/contracts are required.
    const updated = await prisma.integration.update({ where: { id: item.id }, data: { lastStatus: item.enabled ? 'PENDING_EXTERNAL_CONNECTOR' : 'DISABLED', lastSyncAt: new Date() } });
    await audit(req.user.id, 'INTEGRATION_SYNC_REQUESTED', 'Integration', item.id, 'NOT_CONNECTED');
    res.json({ integration: updated, message: 'Solicitud registrada. No se ha contactado ningún sistema externo; falta implementar y configurar el conector específico.' });
}));

// --- Reservas: evita solapamientos mediante validación transaccional. Para alta concurrencia,
// la base debe reforzarse con una exclusion constraint PostgreSQL por rango horario.
app.get('/api/restaurants', auth, asyncRoute(async (_req, res) => {
    res.json(await prisma.restaurant.findMany({ where: { active: true }, orderBy: { name: 'asc' } }));
}));
app.post('/api/restaurants', auth, allow('ADMIN'), asyncRoute(async (req, res) => {
    const p = z.object({ code: z.string().min(2).max(30), name: z.string().min(2).max(120), description: z.string().max(1000).optional(), location: z.string().max(250).optional(), capacity: z.number().int().nonnegative().default(0) }).safeParse(req.body);
    if (!p.success) return res.status(400).json({ error: 'Restaurante inválido', details: p.error.flatten() });
    try { const item = await prisma.restaurant.create({ data: p.data }); await audit(req.user.id, 'RESTAURANT_CREATED', 'Restaurant', item.id); res.status(201).json(item); }
    catch (e) { if (e.code === 'P2002') return res.status(409).json({ error: 'El código del restaurante ya existe' }); throw e; }
}));
app.get('/api/reservations', auth, allow('EMPLOYEE', 'ADMIN', 'MARKETING'), asyncRoute(async (req, res) => {
    const page = Math.max(1, Number(req.query.page || 1)), limit = Math.min(100, Math.max(1, Number(req.query.limit || 20)));
    const where = { ...(req.query.restaurantId ? { restaurantId: String(req.query.restaurantId) } : {}), ...(req.query.status ? { status: String(req.query.status) } : {}) };
    const [data, total] = await Promise.all([prisma.reservation.findMany({ where, include: { restaurant: true, client: { select: { id: true, firstName: true, lastName: true } } }, orderBy: { startsAt: 'asc' }, skip: (page-1)*limit, take: limit }), prisma.reservation.count({ where })]);
    res.json({ data, page, limit, total, pages: Math.ceil(total/limit) });
}));
app.post('/api/reservations', auth, allow('EMPLOYEE', 'ADMIN'), asyncRoute(async (req, res) => {
    const p = z.object({ restaurantId: z.string(), clientId: z.string().optional(), guestName: z.string().min(2).max(120), guestEmail: z.string().email().optional(), guestPhone: z.string().max(30).optional(), partySize: z.number().int().min(1).max(50), startsAt: z.string().datetime(), endsAt: z.string().datetime(), notes: z.string().max(2000).optional(), source: z.string().max(40).default('CRM'), externalId: z.string().max(150).optional() }).safeParse(req.body);
    if (!p.success) return res.status(400).json({ error: 'Reserva inválida', details: p.error.flatten() });
    const start = new Date(p.data.startsAt), end = new Date(p.data.endsAt);
    if (start >= end || start <= new Date()) return res.status(400).json({ error: 'El horario de reserva debe ser futuro y la hora final posterior a la inicial' });
    const restaurant = await prisma.restaurant.findUnique({ where: { id: p.data.restaurantId } });
    if (!restaurant || !restaurant.active) return res.status(404).json({ error: 'Restaurante no disponible' });
    if (restaurant.capacity && p.data.partySize > restaurant.capacity) return res.status(409).json({ error: 'El tamaño del grupo supera la capacidad configurada' });
    try {
        const item = await prisma.$transaction(async (tx) => {
            const overlapping = await tx.reservation.findMany({ where: { restaurantId: restaurant.id, status: { in: ['PENDING','CONFIRMED','SEATED'] }, startsAt: { lt: end }, endsAt: { gt: start } }, select: { partySize: true } });
            const occupied = overlapping.reduce((sum, item) => sum + item.partySize, 0);
            if (restaurant.capacity > 0 && occupied + p.data.partySize > restaurant.capacity) throw new Error('RESTAURANT_CAPACITY_REACHED');
            return tx.reservation.create({ data: { ...p.data, startsAt: start, endsAt: end } });
        }, { isolationLevel: 'Serializable' });
        await audit(req.user.id, 'RESERVATION_CREATED', 'Reservation', item.id); res.status(201).json(item);
    } catch (e) {
        if (e.message === 'RESTAURANT_CAPACITY_REACHED' || e.code === 'P2034') return res.status(409).json({ error: 'El aforo disponible para ese horario se ha agotado; vuelve a consultar disponibilidad' });
        if (e.code === 'P2002') return res.status(409).json({ error: 'La reserva externa ya fue registrada' }); throw e;
    }
}));
app.patch('/api/reservations/:id/status', auth, allow('EMPLOYEE','ADMIN'), asyncRoute(async (req,res) => {
    const p = z.object({ status: z.enum(['PENDING','CONFIRMED','SEATED','COMPLETED','CANCELLED','NO_SHOW']) }).safeParse(req.body);
    if (!p.success) return res.status(400).json({ error: 'Estado inválido' });
    const item = await prisma.reservation.update({ where: { id: req.params.id }, data: { status: p.data.status } }).catch(e => e.code === 'P2025' ? null : Promise.reject(e));
    if (!item) return res.status(404).json({ error: 'Reserva no encontrada' });
    await audit(req.user.id, 'RESERVATION_STATUS_CHANGED', 'Reservation', item.id); res.json(item);
}));
app.get('/api/events', auth, asyncRoute(async (req,res) => {
    const where = req.user.role === 'CLIENT' ? { status: 'PUBLISHED', endsAt: { gte: new Date() } } : {};
    res.json(await prisma.event.findMany({ where, include: { _count: { select: { registrations: true } } }, orderBy: { startsAt: 'asc' } }));
}));
app.post('/api/events', auth, allow('MARKETING','ADMIN'), asyncRoute(async (req,res) => {
    const p = z.object({ code: z.string().min(2).max(40), name: z.string().min(2).max(150), description: z.string().max(3000).optional(), venue: z.string().max(200).optional(), startsAt: z.string().datetime(), endsAt: z.string().datetime(), capacity: z.number().int().positive().optional(), status: z.enum(['DRAFT','PUBLISHED','CANCELLED','COMPLETED']).default('DRAFT') }).safeParse(req.body);
    if (!p.success) return res.status(400).json({ error: 'Evento inválido', details: p.error.flatten() });
    if (new Date(p.data.startsAt) >= new Date(p.data.endsAt)) return res.status(400).json({ error: 'Rango de fechas inválido' });
    try { const item = await prisma.event.create({ data: { ...p.data, startsAt: new Date(p.data.startsAt), endsAt: new Date(p.data.endsAt) } }); await audit(req.user.id,'EVENT_CREATED','Event',item.id); res.status(201).json(item); }
    catch(e) { if(e.code==='P2002') return res.status(409).json({error:'Código de evento duplicado'}); throw e; }
}));
app.patch('/api/events/:id', auth, allow('MARKETING','ADMIN'), asyncRoute(async (req,res) => {
    const p = z.object({ name:z.string().min(2).max(150).optional(), description:z.string().max(3000).optional(), venue:z.string().max(200).optional(), startsAt:z.string().datetime().optional(), endsAt:z.string().datetime().optional(), capacity:z.number().int().positive().nullable().optional(), status:z.enum(['DRAFT','PUBLISHED','CANCELLED','COMPLETED']).optional() }).refine(v => Object.keys(v).length > 0).safeParse(req.body);
    if (!p.success) return res.status(400).json({error:'Actualización de evento inválida',details:p.error.flatten()});
    const current = await prisma.event.findUnique({where:{id:req.params.id}});
    if (!current) return res.status(404).json({error:'Evento no encontrado'});
    const startsAt = p.data.startsAt ? new Date(p.data.startsAt) : current.startsAt;
    const endsAt = p.data.endsAt ? new Date(p.data.endsAt) : current.endsAt;
    if (startsAt >= endsAt) return res.status(400).json({error:'Rango de fechas inválido'});
    const updated = await prisma.event.update({where:{id:current.id},data:{...p.data,startsAt,endsAt}});
    await audit(req.user.id,'EVENT_UPDATED','Event',updated.id); res.json(updated);
}));
app.get('/api/events/:id/registrations', auth, allow('EMPLOYEE','MARKETING','ADMIN'), asyncRoute(async (req,res) => {
    const event = await prisma.event.findUnique({where:{id:req.params.id},select:{id:true}});
    if (!event) return res.status(404).json({error:'Evento no encontrado'});
    res.json(await prisma.eventRegistration.findMany({where:{eventId:event.id},include:{client:{select:{id:true,firstName:true,lastName:true,email:true}}},orderBy:{createdAt:'desc'}}));
}));
app.post('/api/events/:id/register', auth, asyncRoute(async (req,res) => {
    const p = z.object({ clientId: z.string().optional(), attendeeName: z.string().min(2).max(120), attendeeEmail: z.string().email().optional(), externalId: z.string().max(150).optional() }).safeParse(req.body);
    if (!p.success) return res.status(400).json({error:'Registro inválido',details:p.error.flatten()});
    const clientId = req.user.role === 'CLIENT' ? req.user.clientId : p.data.clientId;
    try {
        const item = await prisma.$transaction(async (tx) => {
            const event = await tx.event.findUnique({where:{id:req.params.id}});
            if (!event || event.status !== 'PUBLISHED' || event.endsAt < new Date()) throw new Error('EVENT_UNAVAILABLE');
            const count = await tx.eventRegistration.count({where:{eventId:event.id,status:'REGISTERED'}});
            if (event.capacity && count >= event.capacity) throw new Error('EVENT_FULL');
            return tx.eventRegistration.create({data:{eventId:event.id,clientId,attendeeName:p.data.attendeeName,attendeeEmail:p.data.attendeeEmail,externalId:p.data.externalId}});
        }, { isolationLevel: 'Serializable' });
        await audit(req.user.id,'EVENT_REGISTRATION_CREATED','EventRegistration',item.id); res.status(201).json(item);
    } catch(e) {
        if (e.message === 'EVENT_UNAVAILABLE') return res.status(409).json({error:'Evento no disponible para inscripciones'});
        if (e.message === 'EVENT_FULL' || e.code === 'P2034') return res.status(409).json({error:'Aforo completo o alta simultánea; vuelve a consultar'});
        if(e.code==='P2002') return res.status(409).json({error:'Inscripción duplicada'}); throw e;
    }
}));
// Ingesta de ventas desde sistemas confiables. El webhook requiere secreto por integración;
// no se expone sin configurar INTEGRATION_WEBHOOK_SECRET.
app.get('/api/sales', auth, allow('ADMIN','MARKETING'), asyncRoute(async (req,res) => {
    const page = Math.max(1, Number(req.query.page || 1));
    const limit = Math.min(100, Math.max(1, Number(req.query.limit || 20)));
    const where = { ...(req.query.status ? { status:String(req.query.status) } : {}), ...(req.query.source ? { source:String(req.query.source) } : {}) };
    const [data,total] = await Promise.all([prisma.sale.findMany({where,include:{client:{select:{id:true,firstName:true,lastName:true}}},orderBy:{soldAt:'desc'},skip:(page-1)*limit,take:limit}),prisma.sale.count({where})]);
    res.json({data,page,limit,total,pages:Math.ceil(total/limit)});
}));
app.post('/api/integrations/pos/sales', asyncRoute(async (req,res) => {
    const secret = process.env.INTEGRATION_WEBHOOK_SECRET;
    if (!secret || !secretMatches(req.headers['x-integration-secret'], secret)) return res.status(401).json({error:'Conector no autenticado'});
    const p = z.object({ externalId:z.string().min(1).max(150), clientId:z.string().optional(), source:z.string().min(2).max(50), currency:z.string().length(3).default('PEN'), amount:z.number().finite().nonnegative(), status:z.enum(['PENDING','PAID','REFUNDED','VOID']).default('PAID'), soldAt:z.string().datetime(), metadata:z.record(z.any()).optional() }).safeParse(req.body);
    if (!p.success) return res.status(400).json({error:'Venta inválida',details:p.error.flatten()});
    const sale = await prisma.$transaction(async (tx) => {
        const saved = await tx.sale.upsert({where:{externalId:p.data.externalId},create:{...p.data,amount:p.data.amount,soldAt:new Date(p.data.soldAt)},update:{status:p.data.status,amount:p.data.amount,metadata:p.data.metadata,clientId:p.data.clientId,source:p.data.source,soldAt:new Date(p.data.soldAt)}});
        if (saved.clientId && saved.status === 'PAID') {
            await tx.clientActivity.upsert({
                where: { idempotencyKey: `pos:${saved.externalId}` },
                create: { clientId: saved.clientId, source: saved.source, kind: 'PURCHASE', amount: Number(saved.amount), occurredAt: saved.soldAt, idempotencyKey: `pos:${saved.externalId}` },
                update: { clientId: saved.clientId, amount: Number(saved.amount), occurredAt: saved.soldAt }
            });
        } else {
            await tx.clientActivity.deleteMany({ where: { idempotencyKey: `pos:${saved.externalId}` } });
        }
        return saved;
    });
    res.status(200).json({sale, idempotent:true});
}));
app.post('/api/integrations/events', asyncRoute(async (req,res) => {
    const secret = process.env.INTEGRATION_WEBHOOK_SECRET;
    if (!secret || !secretMatches(req.headers['x-integration-secret'], secret)) return res.status(401).json({error:'Conector no autenticado'});
    const p = z.object({ source:z.string().min(2).max(60), externalId:z.string().min(1).max(150), eventType:z.string().min(2).max(100), payload:z.record(z.any()) }).safeParse(req.body);
    if (!p.success) return res.status(400).json({error:'Evento inválido',details:p.error.flatten()});
    try {
        const item = await prisma.integrationEvent.create({data:p.data});
        return res.status(202).json({event:item,duplicate:false});
    } catch(e) {
        if(e.code==='P2002') {
            const existing = await prisma.integrationEvent.findUnique({where:{source_externalId:{source:p.data.source,externalId:p.data.externalId}}});
            return res.status(200).json({event:existing,duplicate:true});
        }
        throw e;
    }
}));
app.get('/api/integrations/events', auth, allow('ADMIN'), asyncRoute(async (req,res) => {
    const status = req.query.status ? String(req.query.status) : undefined;
    res.json(await prisma.integrationEvent.findMany({where:status?{status}:{},orderBy:{receivedAt:'desc'},take:Math.min(200,Math.max(1,Number(req.query.limit||50)))}));
}));

const openapi = {
    openapi: '3.0.0', info: { title: 'Atlantic City CRM API', version: '1.0.0', description: 'API de referencia del CRM integral.' },
    servers: [{ url: 'http://localhost:4000' }],
    paths: {
        '/api/health': { get: { summary: 'Estado de la API y base de datos', responses: { '200': { description: 'Servicio disponible' } } } },
        '/api/auth/login': { post: { summary: 'Iniciar sesión', responses: { '200': { description: 'Token y usuario' } } } },
        '/api/clients': { get: { summary: 'Buscar clientes', security: [{ bearerAuth: [] }], responses: { '200': { description: 'Listado paginado' } } }, post: { summary: 'Registrar cliente', security: [{ bearerAuth: [] }], responses: { '201': { description: 'Cliente creado' } } } },
        '/api/tickets': { get: { summary: 'Consultar tickets paginados', security: [{ bearerAuth: [] }], responses: { '200': { description: 'Listado paginado de tickets' } } },
            post: { summary: 'Registrar ticket', security: [{ bearerAuth: [] }], responses: { '201': { description: 'Ticket creado' } } } },
        '/api/restaurants': { get: { summary: 'Consultar restaurantes', security: [{ bearerAuth: [] }], responses: { '200': { description: 'Catálogo activo' } } }, post: { summary: 'Crear restaurante', security: [{ bearerAuth: [] }], responses: { '201': { description: 'Restaurante creado' } } } },
        '/api/reservations': { get: { summary: 'Consultar reservas paginadas', security: [{ bearerAuth: [] }], responses: { '200': { description: 'Reservas' } } }, post: { summary: 'Crear reserva con validación de aforo', security: [{ bearerAuth: [] }], responses: { '201': { description: 'Reserva creada' }, '409': { description: 'Aforo agotado' } } } },
        '/api/events': { get: { summary: 'Consultar eventos', security: [{ bearerAuth: [] }], responses: { '200': { description: 'Eventos' } } }, post: { summary: 'Crear evento', security: [{ bearerAuth: [] }], responses: { '201': { description: 'Evento creado' } } } },
        '/api/sales': { get: { summary: 'Consultar ventas POS paginadas', security: [{ bearerAuth: [] }], responses: { '200': { description: 'Ventas' } } } },
        '/api/integrations/pos/sales': { post: { summary: 'Recibir venta POS idempotente', parameters: [{ in: 'header', name: 'X-Integration-Secret', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Venta registrada' }, '401': { description: 'Conector no autenticado' } } } },
        '/api/integrations/events': { post: { summary: 'Recibir evento externo idempotente', parameters: [{ in: 'header', name: 'X-Integration-Secret', required: true, schema: { type: 'string' } }], responses: { '202': { description: 'Evento recibido' } } }, get: { summary: 'Consultar bandeja de eventos', security: [{ bearerAuth: [] }], responses: { '200': { description: 'Eventos recibidos' } } } }
    },
    components: { securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' } } }
};
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(openapi));
app.use((_req, res) => { res.status(404).json({ error: 'Ruta no encontrada' }); });
app.use((err, _req, res, _next) => {
    console.error('API error:', err?.message || 'unknown error');
    res.status(500).json({ error: 'Error interno del servidor', requestId: crypto.randomUUID() });
});
app.listen(PORT, () => console.log(`Atlantic CRM API escuchando en puerto ${PORT}`));
