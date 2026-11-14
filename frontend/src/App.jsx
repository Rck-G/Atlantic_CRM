import Operations from './Operations.jsx';
import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useMemo, useState } from 'react';
import { Activity, Users, Gift, Headset, ChartNoAxesCombined, ShieldCheck, Search, Bell, LogOut, Plus, RefreshCw, Menu, X, CircleUserRound, PlugZap, LockKeyhole, ChevronRight, Pencil, Trash2, Filter } from 'lucide-react';
const API = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';
const nav = [
    { id: 'dashboard', label: 'Resumen', icon: ChartNoAxesCombined, roles: ['ADMIN', 'MARKETING'] },
    { id: 'clients', label: 'Clientes', icon: Users, roles: ['ADMIN', 'EMPLOYEE', 'MARKETING'] },
    { id: 'campaigns', label: 'Campañas', icon: Activity, roles: ['ADMIN', 'MARKETING', 'EMPLOYEE'] },
    { id: 'benefits', label: 'Beneficios VIP', icon: Gift, roles: ['ADMIN', 'MARKETING', 'EMPLOYEE', 'CLIENT'] },
    { id: 'tickets', label: 'HelpDesk', icon: Headset, roles: ['ADMIN', 'MARKETING', 'EMPLOYEE', 'CLIENT'] },
    { id: 'users', label: 'Usuarios y roles', icon: ShieldCheck, roles: ['ADMIN'] },
    { id: 'audit', label: 'Auditoría', icon: LockKeyhole, roles: ['ADMIN'] },
    { id: 'integrations', label: 'Integraciones', icon: PlugZap, roles: ['ADMIN'] },
    { id: 'operations', label: 'Operaciones', icon: Activity, roles: ['ADMIN', 'EMPLOYEE', 'MARKETING'] },
    { id: 'profile', label: 'Mi perfil', icon: CircleUserRound, roles: ['ADMIN', 'EMPLOYEE', 'MARKETING', 'CLIENT'] }
];
async function request(path, token, init = {}) {
    const res = await fetch(`${API}${path}`, { ...init, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(init.headers || {}) } });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
        const fieldErrors = data.details?.fieldErrors ? Object.values(data.details.fieldErrors).flat().filter(Boolean) : [];
        const message = [data.error || `Error ${res.status}`, ...fieldErrors].join(': ');
        throw new Error(message);
    }
    return data;
}
export default function App() {
    const [token, setToken] = useState(sessionStorage.getItem('crm_token') || '');
    const [user, setUser] = useState(null);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [authMode, setAuthMode] = useState('login');
    const [registerForm, setRegisterForm] = useState({ firstName: '', lastName: '', dni: '', email: '', phone: '', password: '', confirmPassword: '', consentMarketing: false });
    const [registerLoading, setRegisterLoading] = useState(false);
    const [error, setError] = useState('');
    const [section, setSection] = useState('dashboard');
    const [clients, setClients] = useState([]);
    const [tickets, setTickets] = useState([]);
    const [campaigns, setCampaigns] = useState([]);
    const [summary, setSummary] = useState(null);
    const [query, setQuery] = useState('');
    const [loading, setLoading] = useState(false);
    const [mobileOpen, setMobileOpen] = useState(false);
    const [modal, setModal] = useState('');
    const [notice, setNotice] = useState('');
    const [clientForm, setClientForm] = useState({ dni: '', firstName: '', lastName: '', email: '', phone: '' });
    const [profileForm, setProfileForm] = useState({ name: '', email: '' });
    const [editingClientId, setEditingClientId] = useState(null);
    const [ticketForm, setTicketForm] = useState({ subject: '', description: '', category: 'GENERAL', priority: 'MEDIUM' });
    const [campaignForm, setCampaignForm] = useState({ name: '', description: '', targetTier: 'SILVER', channel: 'IN_APP' });
    const [benefitForm, setBenefitForm] = useState({ name: '', code: '', description: '', tier: 'SILVER', maxRedemptions: 1 });
    const [users, setUsers] = useState([]);
    const [userForm, setUserForm] = useState({ name: '', email: '', password: '', role: 'EMPLOYEE', clientId: '' });
    const [editingUserId, setEditingUserId] = useState(null);
    const [userQuery, setUserQuery] = useState('');
    const [userRoleFilter, setUserRoleFilter] = useState('ALL');
    const [audit, setAudit] = useState([]);
    const [integrations, setIntegrations] = useState([]);
    const [integrationForm, setIntegrationForm] = useState({ name: '', type: 'POS', endpoint: '' });
    const [benefits, setBenefits] = useState([]);
    const [selectedClient, setSelectedClient] = useState(null);
    const [clientDetail, setClientDetail] = useState(null);
    const load = async (u, t = token) => {
        setLoading(true);
        setError('');
        try {
            if (['ADMIN', 'MARKETING'].includes(u.role))
                setSummary(await request('/analytics/summary', t));
            if (['ADMIN', 'EMPLOYEE', 'MARKETING'].includes(u.role))
                setClients((await request('/clients?limit=100', t)).data);
            if (['ADMIN', 'EMPLOYEE', 'MARKETING'].includes(u.role))
                setCampaigns(await request('/campaigns', t));
            setTickets((await request('/tickets', t)).data || []);
            setBenefits(await request('/benefits', t));
            if (u.role === 'ADMIN') {
                setUsers(await request('/users', t));
                setAudit(await request('/audit', t));
                setIntegrations(await request('/integrations', t));
            }
        }
        catch (e) {
            setError(e.message);
        }
        finally {
            setLoading(false);
        }
    };
    useEffect(() => { if (token)
        request('/auth/me', token).then((u) => { setUser(u); setSection(u.role === 'CLIENT' ? 'tickets' : 'dashboard'); load(u, token); }).catch(() => { sessionStorage.removeItem('crm_token'); setToken(''); setUser(null); }); }, []);
    useEffect(() => { if (user && token)
        load(user, token); if (user && section === 'profile')
        setProfileForm({ name: user.name, email: user.email }); }, [section]);
    const signIn = async (e) => { e.preventDefault(); setError(''); try {
        const r = await request('/auth/login', '', { method: 'POST', body: JSON.stringify({ email, password }) });
        sessionStorage.setItem('crm_token', r.token);
        setToken(r.token);
        setUser(r.user);
        setSection(r.user.role === 'CLIENT' ? 'tickets' : 'dashboard');
        await load(r.user, r.token);
    }
    catch (e) {
        setError(e.message);
    } };
    const signUp = async (e) => {
        e.preventDefault();
        setError('');
        if (registerForm.password !== registerForm.confirmPassword) {
            setError('Las contraseñas no coinciden.');
            return;
        }
        setRegisterLoading(true);
        try {
            const payload = {
                firstName: registerForm.firstName,
                lastName: registerForm.lastName,
                dni: registerForm.dni,
                email: registerForm.email,
                phone: registerForm.phone,
                password: registerForm.password,
                consentMarketing: registerForm.consentMarketing
            };
            const r = await request('/auth/register', '', { method: 'POST', body: JSON.stringify(payload) });
            sessionStorage.setItem('crm_token', r.token);
            setToken(r.token);
            setUser(r.user);
            setSection('tickets');
            setAuthMode('login');
            setRegisterForm({ firstName: '', lastName: '', dni: '', email: '', phone: '', password: '', confirmPassword: '', consentMarketing: false });
            setNotice('Tu cuenta fue creada correctamente.');
            await load(r.user, r.token);
        }
        catch (e) {
            setError(e.message);
        }
        finally {
            setRegisterLoading(false);
        }
    };
    const signOut = () => { sessionStorage.removeItem('crm_token'); setToken(''); setUser(null); setPassword(''); };
    const visibleNav = useMemo(() => nav.filter(n => user && n.roles.includes(user.role)), [user]);
    const createClient = async (e) => { e.preventDefault(); try {
        if (editingClientId) {
            await request(`/clients/${editingClientId}`, token, { method: 'PATCH', body: JSON.stringify(clientForm) });
            setNotice('Cliente actualizado correctamente');
        }
        else {
            await request('/clients', token, { method: 'POST', body: JSON.stringify(clientForm) });
            setNotice('Cliente registrado correctamente');
        }
        setModal('');
        setEditingClientId(null);
        setClientForm({ dni: '', firstName: '', lastName: '', email: '', phone: '' });
        if (user)
            await load(user);
    }
    catch (e) {
        setError(e.message);
    } };
    const editClient = (c) => { setEditingClientId(c.id); setClientForm({ dni: c.dni, firstName: c.firstName, lastName: c.lastName, email: c.email || '', phone: c.phone || '' }); setModal('client'); };
    const deleteClient = async (c) => { if (!window.confirm(`¿Eliminar al cliente ${c.firstName} ${c.lastName}? Esta acción solo se permite si no tiene historial asociado.`))
        return; try {
        await request(`/clients/${c.id}`, token, { method: 'DELETE' });
        setNotice('Cliente eliminado');
        if (user)
            await load(user);
    }
    catch (e) {
        setError(e.message);
    } };
    const saveProfile = async (e) => { e.preventDefault(); try {
        const updated = await request('/auth/me', token, { method: 'PATCH', body: JSON.stringify(profileForm) });
        setUser(updated);
        setNotice('Perfil actualizado correctamente');
    }
    catch (e) {
        setError(e.message);
    } };
    const createTicket = async (e) => { e.preventDefault(); try {
        await request('/tickets', token, { method: 'POST', body: JSON.stringify(ticketForm) });
        setModal('');
        setTicketForm({ subject: '', description: '', category: 'GENERAL', priority: 'MEDIUM' });
        setNotice('Ticket registrado correctamente');
        if (user)
            await load(user);
    }
    catch (e) {
        setError(e.message);
    } };
    const createCampaign = async (e) => { e.preventDefault(); try {
        await request('/campaigns', token, { method: 'POST', body: JSON.stringify({ ...campaignForm, status: 'DRAFT' }) });
        setModal('');
        setNotice('Campaña guardada como borrador');
        if (user)
            await load(user);
    }
    catch (e) {
        setError(e.message);
    } };
    const createBenefit = async (e) => { e.preventDefault(); try {
        await request('/benefits', token, { method: 'POST', body: JSON.stringify({ ...benefitForm, maxRedemptions: Number(benefitForm.maxRedemptions) }) });
        setModal('');
        setNotice('Beneficio creado');
        if (user)
            await load(user);
    }
    catch (e) {
        setError(e.message);
    } };
    const saveUser = async (e) => { e.preventDefault(); setError(''); try {
        const payload = { name: userForm.name, email: userForm.email, role: userForm.role, ...(userForm.password ? { password: userForm.password } : {}), ...(userForm.role === 'CLIENT' ? { clientId: userForm.clientId } : {}) };
        if (editingUserId) {
            await request(`/users/${editingUserId}`, token, { method: 'PATCH', body: JSON.stringify(payload) });
            setNotice('Perfil de usuario actualizado');
        }
        else {
            await request('/users', token, { method: 'POST', body: JSON.stringify({ ...payload, password: userForm.password }) });
            setNotice('Usuario creado correctamente');
        }
        setModal('');
        setEditingUserId(null);
        setUserForm({ name: '', email: '', password: '', role: 'EMPLOYEE', clientId: '' });
        if (user)
            await load(user);
    }
    catch (e) {
        setError(e.message);
    } };
    const editUser = (u) => { setEditingUserId(u.id); setUserForm({ name: u.name, email: u.email, password: '', role: u.role, clientId: u.clientId || '' }); setError(''); setModal('user'); };
    const deleteUser = async (u) => { if (!window.confirm(`¿Eliminar la cuenta de ${u.name} (${u.email})? Esta acción no se puede deshacer. El historial de tickets se conservará.`))
        return; setError(''); try {
        await request(`/users/${u.id}`, token, { method: 'DELETE' });
        setNotice('Cuenta eliminada correctamente');
        if (user)
            await load(user);
    }
    catch (e) {
        setError(e.message);
    } };
    const availableClientOptions = () => clients.filter(c => !users.some(u => u.clientId === c.id && u.id !== editingUserId));
    const filteredUsers = users.filter(u => `${u.name} ${u.email} ${u.role}`.toLowerCase().includes(userQuery.toLowerCase()) && (userRoleFilter === 'ALL' || u.role === userRoleFilter));
    const createIntegration = async (e) => { e.preventDefault(); try {
        await request('/integrations', token, { method: 'POST', body: JSON.stringify(integrationForm) });
        setModal('');
        setNotice('Integración registrada (conector externo pendiente)');
        if (user)
            await load(user);
    }
    catch (e) {
        setError(e.message);
    } };
    const filteredClients = clients.filter(c => `${c.dni} ${c.firstName} ${c.lastName} ${c.email || ''}`.toLowerCase().includes(query.toLowerCase()));
    const openClient = async (c) => { setSelectedClient(c); try {
        setClientDetail(await request(`/clients/${c.id}`, token));
        setModal('clientDetail');
    }
    catch (e) {
        setError(e.message);
    } };
    const redeem = async (id, clientId) => { try {
        await request(`/benefits/${id}/redeem`, token, { method: 'POST', body: JSON.stringify({ clientId }) });
        setNotice('Canje registrado');
        if (user)
            await load(user);
    }
    catch (e) {
        setError(e.message);
    } };
    const updateTicket = async (id, status) => { try {
        await request(`/tickets/${id}`, token, { method: 'PATCH', body: JSON.stringify({ status, ...(status === 'RESOLVED' ? { resolution: 'Incidencia atendida; detalle registrado por el operador.' } : {}) }) });
        setNotice('Estado del ticket actualizado');
        if (user)
            await load(user);
    }
    catch (e) {
        setError(e.message);
    } };
    if (!user)
        return _jsx("main", { className: "login-page", children: _jsxs("div", { className: "login-card auth-card", children: [
            _jsx("div", { className: "brand-mark", children: "AC" }),
            _jsx("p", { className: "eyebrow", children: "ATLANTIC CITY ENTERTAINMENT & CASINO" }),
            _jsx("h1", { children: authMode === 'login' ? 'CRM Integral' : 'Crear cuenta de cliente' }),
            _jsx("p", { className: "muted", children: authMode === 'login' ? 'Gestión de clientes, fidelización y experiencia.' : 'Regístrate para acceder a tus beneficios y servicios.' }),
            _jsxs("div", { className: "auth-tabs", children: [
                _jsx("button", { type: "button", className: authMode === 'login' ? 'auth-tab active' : 'auth-tab', onClick: () => { setAuthMode('login'); setError(''); }, children: 'Iniciar sesión' }),
                _jsx("button", { type: "button", className: authMode === 'register' ? 'auth-tab active' : 'auth-tab', onClick: () => { setAuthMode('register'); setError(''); }, children: 'Crear cuenta' })
            ]}),
            authMode === 'login'
                ? _jsxs("form", { onSubmit: signIn, className: "stack", children: [
                    _jsxs("label", { children: ["Correo electrónico", _jsx("input", { type: "email", required: true, autoComplete: "email", value: email, onChange: e => setEmail(e.target.value), placeholder: "tu@correo.com" })] }),
                    _jsxs("label", { children: ["Contraseña", _jsx("input", { type: "password", required: true, autoComplete: "current-password", value: password, onChange: e => setPassword(e.target.value), placeholder: "Tu contraseña" })] }),
                    _jsx("button", { className: "primary full", children: ["Iniciar sesión ", _jsx(ChevronRight, { size: 17 })] })
                ]})
                : _jsxs("form", { onSubmit: signUp, className: "stack register-form", children: [
                    _jsxs("div", { className: "register-grid", children: [
                        _jsxs("label", { children: ["Nombres", _jsx("input", { type: "text", required: true, minLength: 2, maxLength: 80, autoComplete: "given-name", value: registerForm.firstName, onChange: e => setRegisterForm(v => ({ ...v, firstName: e.target.value })), placeholder: "Tus nombres" })] }),
                        _jsxs("label", { children: ["Apellidos", _jsx("input", { type: "text", required: true, minLength: 2, maxLength: 100, autoComplete: "family-name", value: registerForm.lastName, onChange: e => setRegisterForm(v => ({ ...v, lastName: e.target.value })), placeholder: "Tus apellidos" })] }),
                        _jsxs("label", { children: ["Documento de identidad", _jsx("input", { type: "text", required: true, minLength: 5, maxLength: 20, value: registerForm.dni, onChange: e => setRegisterForm(v => ({ ...v, dni: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '') })), placeholder: "Número de documento", autoComplete: "off" })] }),
                        _jsxs("label", { children: ["Teléfono", _jsx("input", { type: "tel", required: true, minLength: 7, maxLength: 20, autoComplete: "tel", value: registerForm.phone, onChange: e => setRegisterForm(v => ({ ...v, phone: e.target.value.replace(/[^0-9+() -]/g, '') })), placeholder: "+51 999 999 999" })] }),
                    ]}),
                    _jsxs("label", { children: ["Correo electrónico", _jsx("input", { type: "email", required: true, maxLength: 254, autoComplete: "email", value: registerForm.email, onChange: e => setRegisterForm(v => ({ ...v, email: e.target.value.trimStart() })), placeholder: "tu@correo.com" })] }),
                    _jsxs("label", { children: ["Contraseña", _jsx("input", { type: "password", required: true, minLength: 10, maxLength: 72, autoComplete: "new-password", value: registerForm.password, onChange: e => setRegisterForm(v => ({ ...v, password: e.target.value })), placeholder: "Mínimo 10 caracteres" }), _jsx("small", { className: "field-hint", children: "Incluye mayúscula, minúscula, número y símbolo." })] }),
                    _jsxs("label", { children: ["Confirmar contraseña", _jsx("input", { type: "password", required: true, minLength: 10, maxLength: 72, autoComplete: "new-password", value: registerForm.confirmPassword, onChange: e => setRegisterForm(v => ({ ...v, confirmPassword: e.target.value })), placeholder: "Repite tu contraseña" })] }),
                    _jsx("label", { className: "consent-row", children: _jsxs("span", { children: [
                        _jsx("input", { type: "checkbox", checked: registerForm.consentMarketing, onChange: e => setRegisterForm(v => ({ ...v, consentMarketing: e.target.checked })) }),
                        " Deseo recibir promociones y comunicaciones comerciales. (Opcional)"
                    ]}) }),
                    _jsx("button", { className: "primary full", disabled: registerLoading, children: registerLoading ? 'Creando cuenta...' : 'Crear mi cuenta' })
                ]}),
            error && _jsx("div", { className: "alert error", children: error }),
            _jsx("p", { className: "login-foot", children: authMode === 'login' ? 'Acceso protegido · Roles y permisos' : 'Tus datos serán utilizados para gestionar tu cuenta y experiencia como cliente.' })
        ]}) });
    return _jsxs("div", { className: "app-shell", children: [mobileOpen && _jsx("div", { className: "mobile-scrim", onClick: () => setMobileOpen(false) }), _jsxs("aside", { className: `sidebar ${mobileOpen ? 'open' : ''}`, children: [_jsxs("div", { className: "brand", children: [_jsx("div", { className: "brand-mark small", children: "AC" }), _jsxs("div", { children: [_jsx("b", { children: "ATLANTIC CITY" }), _jsx("small", { children: "CRM INTEGRAL" })] }), _jsx("button", { className: "icon-btn mobile-close", onClick: () => setMobileOpen(false), children: _jsx(X, {}) })] }), _jsx("div", { className: "side-label", children: "ESPACIO DE TRABAJO" }), _jsx("nav", { children: visibleNav.map(n => _jsxs("button", { className: `nav-item ${section === n.id ? 'active' : ''}`, onClick: () => { setSection(n.id); setMobileOpen(false); setModal(''); }, children: [_jsx(n.icon, { size: 18 }), _jsx("span", { children: n.label }), section === n.id && _jsx("span", { className: "nav-dot" })] }, n.id)) }), _jsxs("div", { className: "sidebar-bottom", children: [_jsxs("div", { className: "secure", children: [_jsx(ShieldCheck, { size: 17 }), _jsxs("span", { children: [_jsx("b", { children: "Entorno protegido" }), _jsx("small", { children: "Acceso seg\u00FAn rol" })] })] }), _jsxs("button", { className: "nav-item", onClick: signOut, children: [_jsx(LogOut, { size: 18 }), "Cerrar sesi\u00F3n"] })] })] }), _jsxs("main", { className: "main-area", children: [_jsxs("header", { className: "topbar", children: [_jsx("button", { className: "icon-btn menu-btn", onClick: () => setMobileOpen(true), children: _jsx(Menu, {}) }), _jsxs("div", { children: [_jsx("p", { className: "eyebrow", children: "ATLANTIC CITY / OPERACIONES" }), _jsx("h2", { children: nav.find(n => n.id === section)?.label || 'CRM Integral' })] }), _jsxs("div", { className: "top-actions", children: [_jsx("button", { className: "icon-btn", onClick: () => { if (user)
                                            load(user); }, title: "Actualizar", children: _jsx(RefreshCw, { size: 18 }) }), _jsx("button", { className: "icon-btn notification", title: "Notificaciones", children: _jsx(Bell, { size: 18 }) }), _jsxs("div", { className: "user-pill", children: [_jsx("div", { className: "avatar", children: _jsx(CircleUserRound, { size: 19 }) }), _jsxs("div", { children: [_jsx("b", { children: user.name }), _jsx("small", { children: user.role })] })] })] })] }), _jsxs("section", { className: "content", children: [error && _jsxs("div", { className: "alert error", children: [error, _jsx("button", { onClick: () => setError(''), children: "Cerrar" })] }), notice && _jsxs("div", { className: "alert success", children: [notice, _jsx("button", { onClick: () => setNotice(''), children: "Cerrar" })] }), loading && _jsx("div", { className: "loading-bar" }), section === 'dashboard' && _jsxs(_Fragment, { children: [_jsxs("div", { className: "welcome", children: [_jsxs("div", { children: [_jsx("p", { className: "eyebrow gold", children: "CENTRO DE CONTROL" }), _jsx("h1", { children: "Resumen ejecutivo" }), _jsx("p", { children: "Visi\u00F3n general de clientes, fidelizaci\u00F3n y atenci\u00F3n." })] }), _jsxs("span", { className: "live", children: [_jsx("i", {}), " Datos desde la API"] })] }), _jsx("div", { className: "metric-grid", children: [{ label: 'Clientes registrados', value: summary?.clients ?? '—', icon: Users, sub: 'Base centralizada' }, { label: 'Campañas', value: summary?.campaigns ?? '—', icon: Activity, sub: 'Marketing y segmentación' }, { label: 'Beneficios', value: summary?.benefits ?? '—', icon: Gift, sub: 'Catálogo de fidelización' }, { label: 'Tickets', value: summary?.tickets ?? '—', icon: Headset, sub: 'Atención omnicanal' }, { label: 'Reservas', value: summary?.reservations ?? '—', icon: Activity, sub: 'Operación de restaurantes' }, { label: 'Eventos', value: summary?.events ?? '—', icon: Activity, sub: 'Agenda y aforo' }, { label: 'Ventas POS', value: summary?.paidSalesAmount != null ? `S/ ${Number(summary.paidSalesAmount).toLocaleString('es-PE', { minimumFractionDigits: 2 })}` : '—', icon: Activity, sub: 'Ventas pagadas recibidas' }].map(m => _jsxs("div", { className: "metric-card", children: [_jsxs("div", { className: "metric-top", children: [_jsx("span", { children: m.label }), _jsx(m.icon, { size: 19 })] }), _jsx("strong", { children: m.value }), _jsx("small", { children: m.sub })] }, m.label)) }), _jsxs("div", { className: "dashboard-grid", children: [_jsxs("div", { className: "panel", children: [_jsx("div", { className: "panel-head", children: _jsxs("div", { children: [_jsx("h3", { children: "Distribuci\u00F3n VIP" }), _jsx("p", { children: "Clientes por nivel registrado" })] }) }), (summary?.vipDistribution || []).map((v) => _jsxs("div", { className: "bar-row", children: [_jsx("span", { children: v.tier }), _jsx("div", { className: "bar-track", children: _jsx("div", { className: `bar ${v.tier.toLowerCase()}`, style: { width: `${summary.clients ? Math.max(3, v.count / summary.clients * 100) : 0}%` } }) }), _jsx("b", { children: v.count })] }, v.tier)), !summary && _jsx("p", { className: "muted", children: "Inicia sesi\u00F3n con un rol autorizado para consultar m\u00E9tricas." }), _jsx("p", { className: "small-note", children: "LTV y ROI se habilitan cuando existan fuentes verificadas." })] }), _jsxs("div", { className: "panel", children: [_jsx("div", { className: "panel-head", children: _jsxs("div", { children: [_jsx("h3", { children: "Accesos r\u00E1pidos" }), _jsx("p", { children: "Operaciones frecuentes" })] }) }), _jsxs("div", { className: "quick-list", children: [_jsxs("button", { onClick: () => { setSection('clients'); setEditingClientId(null); setClientForm({ dni: '', firstName: '', lastName: '', email: '', phone: '' }); setModal('client'); }, children: [_jsx(Users, {}), "Registrar cliente ", _jsx(ChevronRight, {})] }), _jsxs("button", { onClick: () => { setSection('tickets'); setModal('ticket'); }, children: [_jsx(Headset, {}), "Crear ticket ", _jsx(ChevronRight, {})] }), _jsxs("button", { onClick: () => { setSection('campaigns'); setModal('campaign'); }, children: [_jsx(Activity, {}), "Nueva campa\u00F1a ", _jsx(ChevronRight, {})] })] })] })] })] }), section === 'profile' && _jsxs(_Fragment, { children: [_jsxs("div", { className: "section-heading", children: [_jsxs("div", { children: [_jsx("h1", { children: "Mi perfil" }), _jsx("p", { children: "Administra tus datos de acceso y preferencias de cuenta." })] }), _jsx("span", { className: "tier platinum", children: user.role })] }), _jsxs("div", { className: "profile-layout", children: [_jsxs("div", { className: "profile-hero panel", children: [_jsx("div", { className: "profile-avatar", children: _jsx(CircleUserRound, { size: 38 }) }), _jsx("h2", { children: user.name }), _jsx("p", { children: user.email }), _jsx("span", { className: "status active", children: "Cuenta activa" }), _jsxs("div", { className: "profile-note", children: [_jsx(ShieldCheck, { size: 17 }), " Tu rol controla las secciones y acciones disponibles."] })] }), _jsxs("form", { className: "panel profile-form stack", onSubmit: saveProfile, children: [_jsxs("div", { children: [_jsx("h3", { children: "Informaci\u00F3n personal" }), _jsx("p", { className: "muted", children: "Los cambios se aplicar\u00E1n a tu cuenta actual." })] }), _jsxs("label", { children: ["Nombre completo", _jsx("input", { required: true, minLength: 2, maxLength: 100, value: profileForm.name || user.name, onChange: e => setProfileForm({ ...profileForm, name: e.target.value }) })] }), _jsxs("label", { children: ["Correo electr\u00F3nico", _jsx("input", { required: true, type: "email", value: profileForm.email || user.email, onChange: e => setProfileForm({ ...profileForm, email: e.target.value }) })] }), _jsxs("label", { children: ["Rol de usuario", _jsx("input", { disabled: true, value: user.role })] }), _jsx("div", { className: "form-actions", children: _jsx("button", { className: "primary", children: "Guardar cambios" }) })] })] })] }), section === 'clients' && _jsxs(_Fragment, { children: [_jsxs("div", { className: "section-heading", children: [_jsxs("div", { children: [_jsx("h1", { children: "Gesti\u00F3n de clientes" }), _jsx("p", { children: "Registro centralizado, b\u00FAsqueda y ficha unificada." })] }), _jsxs("button", { className: "primary", onClick: () => { setEditingClientId(null); setClientForm({ dni: '', firstName: '', lastName: '', email: '', phone: '' }); setModal('client'); }, children: [_jsx(Plus, { size: 17 }), " Nuevo cliente"] })] }), _jsxs("div", { className: "panel", children: [_jsxs("div", { className: "table-toolbar", children: [_jsxs("div", { className: "searchbox", children: [_jsx(Search, { size: 17 }), _jsx("input", { value: query, onChange: e => setQuery(e.target.value), placeholder: "Buscar por DNI, nombre o correo" })] }), _jsxs("span", { className: "count", children: [filteredClients.length, " resultados"] })] }), _jsxs("div", { className: "table-wrap", children: [_jsxs("table", { children: [_jsx("thead", { children: _jsxs("tr", { children: [_jsx("th", { children: "Cliente" }), _jsx("th", { children: "DNI" }), _jsx("th", { children: "Correo" }), _jsx("th", { children: "Nivel VIP" }), _jsx("th", { children: "Registro" }), _jsx("th", {})] }) }), _jsx("tbody", { children: filteredClients.map(c => _jsxs("tr", { children: [_jsxs("td", { children: [_jsxs("b", { children: [c.firstName, " ", c.lastName] }), _jsx("small", { className: "cell-sub", children: c.phone || 'Sin teléfono' })] }), _jsx("td", { children: c.dni }), _jsx("td", { children: c.email || '—' }), _jsx("td", { children: _jsx("span", { className: `tier ${c.vipTier.toLowerCase()}`, children: c.vipTier }) }), _jsx("td", { children: new Date(c.createdAt).toLocaleDateString('es-PE') }), _jsx("td", { children: _jsxs("div", { className: "row-actions", children: [_jsx("button", { className: "text-btn", onClick: () => openClient(c), children: "Ver ficha" }), ['ADMIN', 'EMPLOYEE'].includes(user.role) && _jsxs(_Fragment, { children: [_jsx("button", { className: "text-btn", onClick: () => editClient(c), children: "Editar" }), _jsx("button", { className: "text-btn danger-text", onClick: () => deleteClient(c), children: "Eliminar" })] })] }) })] }, c.id)) })] }), filteredClients.length === 0 && _jsxs("div", { className: "empty", children: [_jsx(Users, {}), _jsx("b", { children: "No hay clientes para mostrar" }), _jsx("span", { children: "Prueba otra b\u00FAsqueda o registra un cliente." })] })] })] })] }), section === 'campaigns' && _jsxs(_Fragment, { children: [_jsxs("div", { className: "section-heading", children: [_jsxs("div", { children: [_jsx("h1", { children: "Campa\u00F1as de marketing" }), _jsx("p", { children: "Campa\u00F1as segmentadas y control de vigencia." })] }), ['ADMIN', 'MARKETING'].includes(user.role) && _jsxs("button", { className: "primary", onClick: () => setModal('campaign'), children: [_jsx(Plus, { size: 17 }), " Crear campa\u00F1a"] })] }), _jsxs("div", { className: "campaign-grid", children: [campaigns.map(c => _jsxs("div", { className: "campaign-card", children: [_jsx("div", { className: "campaign-icon", children: _jsx(Activity, {}) }), _jsx("span", { className: `status ${c.status.toLowerCase()}`, children: c.status }), _jsx("h3", { children: c.name }), _jsx("p", { children: c.description || 'Sin descripción' }), _jsxs("div", { className: "campaign-meta", children: [_jsxs("span", { children: ["Segmento: ", c.targetTier || 'Todos'] }), _jsxs("span", { children: ["Canal: ", c.channel] })] })] }, c.id)), !campaigns.length && _jsxs("div", { className: "empty panel", children: [_jsx(Activity, {}), _jsx("b", { children: "A\u00FAn no hay campa\u00F1as" }), _jsx("span", { children: "Crea una campa\u00F1a para empezar." })] })] })] }), section === 'benefits' && _jsxs(_Fragment, { children: [_jsxs("div", { className: "section-heading", children: [_jsxs("div", { children: [_jsx("h1", { children: "Beneficios y fidelizaci\u00F3n" }), _jsx("p", { children: "Cat\u00E1logo de beneficios y seguimiento de asignaciones." })] }), ['ADMIN', 'MARKETING'].includes(user.role) && _jsxs("button", { className: "primary", onClick: () => setModal('benefit'), children: [_jsx(Plus, { size: 17 }), " Crear beneficio"] })] }), _jsxs("div", { className: "campaign-grid", children: [benefits.map((b) => _jsxs("div", { className: "campaign-card", children: [_jsx("div", { className: "campaign-icon gold-icon", children: _jsx(Gift, {}) }), _jsx("span", { className: `status ${String(b.status || b.benefit?.status).toLowerCase()}`, children: b.status || b.benefit?.status }), _jsx("h3", { children: b.name || b.benefit?.name }), _jsx("p", { children: b.description || b.benefit?.description || 'Beneficio de fidelización' }), _jsxs("div", { className: "campaign-meta", children: [_jsxs("span", { children: ["C\u00F3digo: ", b.code || b.benefit?.code] }), _jsxs("span", { children: ["Nivel: ", b.tier || b.benefit?.tier || 'Todos'] })] }), user.role !== 'CLIENT' && _jsxs("div", { className: "inline-redeem", children: [_jsxs("select", { id: `client-${b.id}`, defaultValue: "", children: [_jsx("option", { value: "", children: "Seleccionar cliente\u2026" }), clients.map(c => _jsxs("option", { value: c.id, children: [c.firstName, " ", c.lastName, " \u2014 ", c.dni] }, c.id))] }), _jsx("button", { className: "secondary", onClick: async () => { const el = document.getElementById(`client-${b.id}`); if (!el?.value) {
                                                                    setError('Selecciona un cliente.');
                                                                    return;
                                                                } try {
                                                                    await request(`/benefits/${b.id}/assign`, token, { method: 'POST', body: JSON.stringify({ clientId: el.value }) });
                                                                    setNotice('Beneficio asignado al cliente');
                                                                    if (user)
                                                                        await load(user);
                                                                }
                                                                catch (e) {
                                                                    setError(e.message);
                                                                } }, children: "Asignar beneficio" }), _jsx("button", { className: "secondary", onClick: () => { const el = document.getElementById(`client-${b.id}`); if (el?.value)
                                                                    redeem(b.id, el.value);
                                                                else
                                                                    setError('Selecciona un cliente.'); }, children: "Validar canje" })] })] }, b.id)), !benefits.length && _jsxs("div", { className: "empty panel", children: [_jsx(Gift, {}), _jsx("b", { children: "No hay beneficios" }), _jsx("span", { children: "El cat\u00E1logo aparecer\u00E1 aqu\u00ED." })] })] })] }), section === 'tickets' && _jsxs(_Fragment, { children: [_jsxs("div", { className: "section-heading", children: [_jsxs("div", { children: [_jsx("h1", { children: "HelpDesk e incidencias" }), _jsx("p", { children: "Seguimiento de solicitudes con historial." })] }), _jsxs("button", { className: "primary", onClick: () => setModal('ticket'), children: [_jsx(Plus, { size: 17 }), " Nuevo ticket"] })] }), _jsx("div", { className: "panel", children: _jsxs("div", { className: "table-wrap", children: [_jsxs("table", { children: [_jsx("thead", { children: _jsxs("tr", { children: [_jsx("th", { children: "Ticket" }), _jsx("th", { children: "Asunto" }), _jsx("th", { children: "Cliente" }), _jsx("th", { children: "Prioridad" }), _jsx("th", { children: "Estado" }), _jsx("th", { children: "\u00DAltima actualizaci\u00F3n" }), _jsx("th", { children: "Acci\u00F3n" })] }) }), _jsx("tbody", { children: tickets.map(t => _jsxs("tr", { children: [_jsx("td", { children: _jsx("b", { children: t.ticketNo }) }), _jsx("td", { children: t.subject }), _jsx("td", { children: t.client ? `${t.client.firstName} ${t.client.lastName}` : '—' }), _jsx("td", { children: _jsx("span", { className: `priority ${t.priority.toLowerCase()}`, children: t.priority }) }), _jsx("td", { children: _jsx("span", { className: `status ${t.status.toLowerCase()}`, children: t.status.replace('_', ' ') }) }), _jsx("td", { children: new Date(t.createdAt).toLocaleDateString('es-PE') }), _jsx("td", { children: user.role !== 'CLIENT' && _jsxs("select", { className: "status-select", value: t.status, onChange: e => updateTicket(t.id, e.target.value), children: [_jsx("option", { value: "NEW", children: "Nuevo" }), _jsx("option", { value: "PENDING", children: "Pendiente" }), _jsx("option", { value: "IN_PROGRESS", children: "En proceso" }), _jsx("option", { value: "WAITING_INFO", children: "En espera" }), _jsx("option", { value: "RESOLVED", children: "Resuelto" }), _jsx("option", { value: "CLOSED", children: "Cerrado" })] }) })] }, t.id)) })] }), !tickets.length && _jsxs("div", { className: "empty", children: [_jsx(Headset, {}), _jsx("b", { children: "No hay tickets" }), _jsx("span", { children: "Registra una incidencia para iniciar su seguimiento." })] })] }) })] }), section === 'users' && _jsxs(_Fragment, { children: [_jsxs("div", { className: "section-heading", children: [_jsxs("div", { children: [_jsx("h1", { children: "Usuarios y roles" }), _jsx("p", { children: "Administra perfiles, permisos y acceso. Los cambios cr\u00EDticos quedan registrados en auditor\u00EDa." })] }), _jsxs("button", { className: "primary", onClick: () => { setEditingUserId(null); setUserForm({ name: '', email: '', password: '', role: 'EMPLOYEE', clientId: '' }); setError(''); setModal('user'); }, children: [_jsx(Plus, { size: 17 }), " Crear usuario"] })] }), _jsx("div", { className: "metric-grid user-metrics", children: [{ label: 'Total de cuentas', value: users.length }, { label: 'Administradores', value: users.filter(u => u.role === 'ADMIN').length }, { label: 'Clientes con acceso', value: users.filter(u => u.role === 'CLIENT').length }, { label: 'Personal', value: users.filter(u => ['EMPLOYEE', 'MARKETING'].includes(u.role)).length }].map(m => _jsxs("div", { className: "metric-card compact", children: [_jsxs("div", { className: "metric-top", children: [_jsx("span", { children: m.label }), _jsx(ShieldCheck, { size: 17 })] }), _jsx("strong", { children: m.value })] }, m.label)) }), _jsxs("div", { className: "panel", children: [_jsxs("div", { className: "table-toolbar user-toolbar", children: [_jsxs("div", { className: "searchbox", children: [_jsx(Search, { size: 17 }), _jsx("input", { "aria-label": "Buscar usuarios", value: userQuery, onChange: e => setUserQuery(e.target.value), placeholder: "Buscar por nombre, correo o rol" })] }), _jsxs("label", { className: "role-filter", children: [_jsx(Filter, { size: 16 }), _jsxs("select", { "aria-label": "Filtrar por rol", value: userRoleFilter, onChange: e => setUserRoleFilter(e.target.value), children: [_jsx("option", { value: "ALL", children: "Todos los roles" }), _jsx("option", { value: "ADMIN", children: "Administrador" }), _jsx("option", { value: "EMPLOYEE", children: "Empleado" }), _jsx("option", { value: "MARKETING", children: "Marketing" }), _jsx("option", { value: "CLIENT", children: "Cliente" })] })] }), _jsxs("span", { className: "count", children: [filteredUsers.length, " de ", users.length] })] }), _jsxs("div", { className: "table-wrap", children: [_jsxs("table", { children: [_jsx("thead", { children: _jsxs("tr", { children: [_jsx("th", { children: "Usuario" }), _jsx("th", { children: "Correo" }), _jsx("th", { children: "Rol y v\u00EDnculo" }), _jsx("th", { children: "Creaci\u00F3n" }), _jsx("th", { children: _jsx("span", { className: "sr-only", children: "Acciones" }) })] }) }), _jsx("tbody", { children: filteredUsers.map(u => _jsxs("tr", { children: [_jsx("td", { children: _jsxs("div", { className: "user-cell", children: [_jsx("span", { className: "user-mini-avatar", children: _jsx(CircleUserRound, { size: 18 }) }), _jsxs("div", { children: [_jsx("b", { children: u.name }), _jsx("small", { className: "cell-sub", children: u.id === user.id ? 'Tu cuenta' : 'ID ' + u.id.slice(-7) })] })] }) }), _jsx("td", { children: u.email }), _jsxs("td", { children: [_jsx("span", { className: `tier ${String(u.role).toLowerCase()}`, children: { ADMIN: 'Administrador', EMPLOYEE: 'Empleado', MARKETING: 'Marketing', CLIENT: 'Cliente' }[u.role] || u.role }), u.role === 'CLIENT' && _jsx("small", { className: "cell-sub", children: "Cliente vinculado" })] }), _jsx("td", { children: new Date(u.createdAt).toLocaleDateString('es-PE') }), _jsx("td", { children: _jsxs("div", { className: "row-actions", children: [_jsxs("button", { className: "text-btn", disabled: u.id === user.id, onClick: () => editUser(u), title: u.id === user.id ? 'Edita tu cuenta desde Mi perfil' : 'Editar perfil', children: [_jsx(Pencil, { size: 14 }), " Editar"] }), _jsxs("button", { className: "text-btn danger-text", disabled: u.id === user.id, onClick: () => deleteUser(u), title: u.id === user.id ? 'No puedes eliminar tu propia cuenta' : 'Eliminar cuenta', children: [_jsx(Trash2, { size: 14 }), " Eliminar"] })] }) })] }, u.id)) })] }), filteredUsers.length === 0 && _jsxs("div", { className: "empty", children: [_jsx(Users, {}), _jsx("b", { children: "No se encontraron usuarios" }), _jsx("span", { children: "Ajusta la b\u00FAsqueda o el filtro de rol." })] })] })] })] }), section === 'audit' && _jsxs(_Fragment, { children: [_jsx("div", { className: "section-heading", children: _jsxs("div", { children: [_jsx("h1", { children: "Auditor\u00EDa de acciones" }), _jsx("p", { children: "Registro de eventos cr\u00EDticos y accesos." })] }) }), _jsx("div", { className: "panel table-wrap", children: _jsxs("table", { children: [_jsx("thead", { children: _jsxs("tr", { children: [_jsx("th", { children: "Fecha (UTC)" }), _jsx("th", { children: "Usuario" }), _jsx("th", { children: "Acci\u00F3n" }), _jsx("th", { children: "Recurso" }), _jsx("th", { children: "Resultado" })] }) }), _jsx("tbody", { children: audit.map(a => _jsxs("tr", { children: [_jsx("td", { children: new Date(a.createdAt).toLocaleString('es-PE') }), _jsx("td", { children: a.actor?.email || 'Sistema' }), _jsx("td", { children: a.action }), _jsxs("td", { children: [a.resource, " ", a.resourceId || ''] }), _jsx("td", { children: _jsx("span", { className: "status active", children: a.outcome }) })] }, a.id)) })] }) })] }), section === 'operations' && _jsx(Operations, { role: user.role, api: (path, init = {}) => request(path, token, init) }), section === 'integrations' && _jsxs(_Fragment, { children: [_jsxs("div", { className: "section-heading", children: [_jsxs("div", { children: [_jsx("h1", { children: "Integraciones" }), _jsx("p", { children: "Conectores registrados; la conexi\u00F3n real requiere configuraci\u00F3n espec\u00EDfica." })] }), _jsxs("button", { className: "primary", onClick: () => setModal('integration'), children: [_jsx(Plus, { size: 17 }), " Registrar conector"] })] }), _jsxs("div", { className: "campaign-grid", children: [integrations.map(i => _jsxs("div", { className: "campaign-card", children: [_jsx("div", { className: "campaign-icon", children: _jsx(PlugZap, {}) }), _jsx("span", { className: `status ${i.enabled ? 'active' : 'paused'}`, children: i.lastStatus }), _jsx("h3", { children: i.name }), _jsxs("p", { children: [i.type, " \u00B7 ", i.endpoint || 'Endpoint no configurado'] }), _jsxs("div", { className: "campaign-meta", children: [_jsxs("span", { children: ["Activada: ", i.enabled ? 'Sí' : 'No'] }), _jsxs("span", { children: ["\u00DAltima solicitud: ", i.lastSyncAt ? new Date(i.lastSyncAt).toLocaleString('es-PE') : 'Nunca'] })] }), _jsxs("button", { className: "secondary", onClick: async () => { try {
                                                            const r = await request(`/integrations/${i.id}/sync`, token, { method: 'POST' });
                                                            setNotice(r.message);
                                                            if (user)
                                                                await load(user);
                                                        }
                                                        catch (e) {
                                                            setError(e.message);
                                                        } }, children: [_jsx(RefreshCw, { size: 15 }), " Solicitar sincronizaci\u00F3n"] })] }, i.id)), !integrations.length && _jsxs("div", { className: "empty panel", children: [_jsx(PlugZap, {}), _jsx("b", { children: "No hay conectores registrados" }), _jsx("span", { children: "Registra un conector cuando tengas sus especificaciones." })] })] })] })] }), _jsxs("footer", { children: [_jsx("span", { children: "Atlantic City \u00B7 CRM Integral" }), _jsxs("span", { children: ["Versi\u00F3n de referencia 1.0 \u00B7 ", _jsx("span", { className: "green-dot" }), " API integrada"] })] })] }), modal && _jsx("div", { className: "modal-backdrop", onMouseDown: e => { if (e.target === e.currentTarget)
                    setModal(''); }, children: _jsxs("div", { className: "modal", children: [_jsxs("div", { className: "modal-head", children: [_jsxs("div", { children: [_jsx("p", { className: "eyebrow", children: "CRM INTEGRAL" }), _jsx("h2", { children: { client: editingClientId ? 'Editar cliente' : 'Registrar cliente', ticket: 'Crear ticket', campaign: 'Nueva campaña', benefit: 'Nuevo beneficio', user: editingUserId ? 'Editar perfil de usuario' : 'Crear usuario', integration: 'Registrar integración', clientDetail: 'Ficha del cliente' }[modal] })] }), _jsx("button", { className: "icon-btn", onClick: () => setModal(''), children: _jsx(X, {}) })] }), modal === 'client' && _jsxs("form", { className: "form-grid", onSubmit: createClient, children: [_jsxs("label", { children: ["DNI *", _jsx("input", { required: true, minLength: 5, value: clientForm.dni, onChange: e => setClientForm({ ...clientForm, dni: e.target.value }) })] }), _jsxs("label", { children: ["Nombres *", _jsx("input", { required: true, value: clientForm.firstName, onChange: e => setClientForm({ ...clientForm, firstName: e.target.value }) })] }), _jsxs("label", { children: ["Apellidos *", _jsx("input", { required: true, value: clientForm.lastName, onChange: e => setClientForm({ ...clientForm, lastName: e.target.value }) })] }), _jsxs("label", { children: ["Correo", _jsx("input", { type: "email", value: clientForm.email, onChange: e => setClientForm({ ...clientForm, email: e.target.value }) })] }), _jsxs("label", { children: ["Tel\u00E9fono", _jsx("input", { value: clientForm.phone, onChange: e => setClientForm({ ...clientForm, phone: e.target.value }) })] }), _jsxs("div", { className: "form-actions", children: [_jsx("button", { type: "button", className: "secondary", onClick: () => setModal(''), children: "Cancelar" }), _jsx("button", { className: "primary", children: "Guardar cliente" })] })] }), modal === 'ticket' && _jsxs("form", { className: "form-grid", onSubmit: createTicket, children: [_jsxs("label", { children: ["Asunto *", _jsx("input", { required: true, minLength: 3, value: ticketForm.subject, onChange: e => setTicketForm({ ...ticketForm, subject: e.target.value }) })] }), _jsxs("label", { children: ["Prioridad", _jsxs("select", { value: ticketForm.priority, onChange: e => setTicketForm({ ...ticketForm, priority: e.target.value }), children: [_jsx("option", { value: "LOW", children: "Baja" }), _jsx("option", { value: "MEDIUM", children: "Media" }), _jsx("option", { value: "HIGH", children: "Alta" }), _jsx("option", { value: "URGENT", children: "Urgente" })] })] }), _jsxs("label", { className: "span-2", children: ["Descripci\u00F3n *", _jsx("textarea", { required: true, minLength: 5, rows: 4, value: ticketForm.description, onChange: e => setTicketForm({ ...ticketForm, description: e.target.value }) })] }), user.role !== 'CLIENT' && _jsxs("label", { className: "span-2", children: ["Cliente relacionado", _jsxs("select", { value: ticketForm.clientId || '', onChange: e => setTicketForm({ ...ticketForm, ...{ clientId: e.target.value } }), children: [_jsx("option", { value: "", children: "Sin vincular" }), clients.map(c => _jsxs("option", { value: c.id, children: [c.firstName, " ", c.lastName, " \u2014 ", c.dni] }, c.id))] })] }), _jsxs("div", { className: "form-actions", children: [_jsx("button", { type: "button", className: "secondary", onClick: () => setModal(''), children: "Cancelar" }), _jsx("button", { className: "primary", children: "Registrar ticket" })] })] }), modal === 'campaign' && _jsxs("form", { className: "form-grid", onSubmit: createCampaign, children: [_jsxs("label", { className: "span-2", children: ["Nombre de campa\u00F1a *", _jsx("input", { required: true, minLength: 2, value: campaignForm.name, onChange: e => setCampaignForm({ ...campaignForm, name: e.target.value }) })] }), _jsxs("label", { className: "span-2", children: ["Descripci\u00F3n", _jsx("textarea", { rows: 3, value: campaignForm.description, onChange: e => setCampaignForm({ ...campaignForm, description: e.target.value }) })] }), _jsxs("label", { children: ["Nivel objetivo", _jsxs("select", { value: campaignForm.targetTier, onChange: e => setCampaignForm({ ...campaignForm, targetTier: e.target.value }), children: [_jsx("option", { value: "SILVER", children: "Silver" }), _jsx("option", { value: "GOLD", children: "Gold" }), _jsx("option", { value: "PLATINUM", children: "Platinum" })] })] }), _jsxs("label", { children: ["Canal", _jsxs("select", { value: campaignForm.channel, onChange: e => setCampaignForm({ ...campaignForm, channel: e.target.value }), children: [_jsx("option", { value: "IN_APP", children: "Aplicaci\u00F3n" }), _jsx("option", { value: "EMAIL", children: "Correo" }), _jsx("option", { value: "SMS", children: "SMS" }), _jsx("option", { value: "WEB", children: "Web" })] })] }), _jsxs("div", { className: "form-actions", children: [_jsx("button", { type: "button", className: "secondary", onClick: () => setModal(''), children: "Cancelar" }), _jsx("button", { className: "primary", children: "Guardar borrador" })] })] }), modal === 'benefit' && _jsxs("form", { className: "form-grid", onSubmit: createBenefit, children: [_jsxs("label", { children: ["Nombre *", _jsx("input", { required: true, minLength: 2, value: benefitForm.name, onChange: e => setBenefitForm({ ...benefitForm, name: e.target.value }) })] }), _jsxs("label", { children: ["C\u00F3digo \u00FAnico *", _jsx("input", { required: true, minLength: 3, value: benefitForm.code, onChange: e => setBenefitForm({ ...benefitForm, code: e.target.value.toUpperCase() }) })] }), _jsxs("label", { children: ["Nivel VIP", _jsxs("select", { value: benefitForm.tier, onChange: e => setBenefitForm({ ...benefitForm, tier: e.target.value }), children: [_jsx("option", { value: "SILVER", children: "Silver" }), _jsx("option", { value: "GOLD", children: "Gold" }), _jsx("option", { value: "PLATINUM", children: "Platinum" })] })] }), _jsxs("label", { children: ["L\u00EDmite de canjes", _jsx("input", { type: "number", min: 1, required: true, value: benefitForm.maxRedemptions, onChange: e => setBenefitForm({ ...benefitForm, maxRedemptions: Number(e.target.value) }) })] }), _jsxs("label", { className: "span-2", children: ["Descripci\u00F3n", _jsx("textarea", { rows: 3, value: benefitForm.description, onChange: e => setBenefitForm({ ...benefitForm, description: e.target.value }) })] }), _jsxs("div", { className: "form-actions", children: [_jsx("button", { type: "button", className: "secondary", onClick: () => setModal(''), children: "Cancelar" }), _jsx("button", { className: "primary", children: "Crear beneficio" })] })] }), modal === 'user' && _jsxs("form", { className: "form-grid", onSubmit: saveUser, children: [_jsxs("div", { className: "span-2 form-intro", children: [_jsx(ShieldCheck, { size: 20 }), _jsxs("div", { children: [_jsx("b", { children: editingUserId ? 'Editar cuenta y permisos' : 'Crear nueva cuenta' }), _jsx("small", { children: editingUserId ? 'Actualiza los datos de acceso. Deja la contraseña vacía para conservar la actual.' : 'La contraseña temporal debe tener al menos 12 caracteres.' })] })] }), _jsxs("label", { children: ["Nombre completo *", _jsx("input", { required: true, minLength: 2, maxLength: 100, autoComplete: "name", value: userForm.name, onChange: e => setUserForm({ ...userForm, name: e.target.value }) })] }), _jsxs("label", { children: ["Correo electr\u00F3nico *", _jsx("input", { required: true, type: "email", autoComplete: "email", value: userForm.email, onChange: e => setUserForm({ ...userForm, email: e.target.value }) })] }), _jsxs("label", { className: "span-2", children: [editingUserId ? 'Nueva contraseña (opcional)' : 'Contraseña temporal *', _jsx("input", { required: !editingUserId, minLength: 12, autoComplete: "new-password", type: "password", placeholder: editingUserId ? 'Dejar en blanco para no cambiarla' : 'Mínimo 12 caracteres', value: userForm.password, onChange: e => setUserForm({ ...userForm, password: e.target.value }) })] }), _jsxs("label", { children: ["Rol de acceso *", _jsxs("select", { value: userForm.role, onChange: e => setUserForm({ ...userForm, role: e.target.value, clientId: e.target.value === 'CLIENT' ? userForm.clientId : '' }), children: [_jsx("option", { value: "EMPLOYEE", children: "Empleado" }), _jsx("option", { value: "MARKETING", children: "Marketing" }), _jsx("option", { value: "ADMIN", children: "Administrador" }), _jsx("option", { value: "CLIENT", children: "Cliente" })] })] }), userForm.role === 'CLIENT' && _jsxs("label", { children: ["Cliente vinculado *", _jsxs("select", { required: true, value: userForm.clientId, onChange: e => setUserForm({ ...userForm, clientId: e.target.value }), children: [_jsx("option", { value: "", children: "Selecciona un cliente\u2026" }), availableClientOptions().map(c => _jsxs("option", { value: c.id, children: [c.firstName, " ", c.lastName, " \u2014 DNI ", c.dni] }, c.id))] }), _jsx("small", { children: "Una cuenta de cliente debe estar vinculada a un registro \u00FAnico de Clientes." })] }), _jsxs("div", { className: "span-2 security-note", children: [_jsx(LockKeyhole, { size: 16 }), _jsx("span", { children: "No puedes editar ni eliminar la cuenta con la que tienes la sesi\u00F3n iniciada. El sistema protege al \u00FAltimo administrador." })] }), _jsxs("div", { className: "form-actions", children: [_jsx("button", { type: "button", className: "secondary", onClick: () => { setModal(''); setEditingUserId(null); }, children: "Cancelar" }), _jsx("button", { className: "primary", disabled: userForm.role === 'CLIENT' && !userForm.clientId, children: editingUserId ? 'Guardar cambios' : 'Crear usuario' })] })] }), modal === 'integration' && _jsxs("form", { className: "form-grid", onSubmit: createIntegration, children: [_jsxs("label", { children: ["Nombre *", _jsx("input", { required: true, minLength: 2, value: integrationForm.name, onChange: e => setIntegrationForm({ ...integrationForm, name: e.target.value }) })] }), _jsxs("label", { children: ["Tipo", _jsxs("select", { value: integrationForm.type, onChange: e => setIntegrationForm({ ...integrationForm, type: e.target.value }), children: [_jsx("option", { value: "POS", children: "Caja / POS" }), _jsx("option", { value: "RESTAURANT", children: "Restaurantes" }), _jsx("option", { value: "EVENTS", children: "Eventos" }), _jsx("option", { value: "LOYALTY", children: "Fidelizaci\u00F3n" }), _jsx("option", { value: "OTHER", children: "Otro" })] })] }), _jsxs("label", { className: "span-2", children: ["Endpoint (opcional)", _jsx("input", { type: "url", placeholder: "https://api.proveedor.com", value: integrationForm.endpoint, onChange: e => setIntegrationForm({ ...integrationForm, endpoint: e.target.value }) })] }), _jsxs("div", { className: "form-actions", children: [_jsx("button", { type: "button", className: "secondary", onClick: () => setModal(''), children: "Cancelar" }), _jsx("button", { className: "primary", children: "Registrar integraci\u00F3n" })] })] }), modal === 'clientDetail' && clientDetail && _jsxs("div", { className: "detail-content", children: [_jsxs("div", { className: "detail-person", children: [_jsx("div", { className: "avatar large", children: _jsx(CircleUserRound, {}) }), _jsxs("div", { children: [_jsxs("h3", { children: [clientDetail.firstName, " ", clientDetail.lastName] }), _jsx("span", { className: `tier ${clientDetail.vipTier.toLowerCase()}`, children: clientDetail.vipTier })] })] }), _jsxs("div", { className: "detail-grid", children: [_jsxs("div", { children: [_jsx("small", { children: "DNI" }), _jsx("b", { children: clientDetail.dni })] }), _jsxs("div", { children: [_jsx("small", { children: "Correo" }), _jsx("b", { children: clientDetail.email || '—' })] }), _jsxs("div", { children: [_jsx("small", { children: "Tel\u00E9fono" }), _jsx("b", { children: clientDetail.phone || '—' })] }), _jsxs("div", { children: [_jsx("small", { children: "Marketing consentido" }), _jsx("b", { children: clientDetail.consentMarketing ? 'Sí' : 'No' })] })] }), _jsx("h3", { children: "Tickets recientes" }), clientDetail.tickets?.map((t) => _jsxs("p", { children: [t.ticketNo, " \u00B7 ", t.subject, " \u00B7 ", t.status] }, t.id)), _jsx("h3", { children: "Actividad disponible" }), clientDetail.activity?.map((a) => _jsxs("p", { children: [a.kind, " \u00B7 ", a.source, " \u00B7 ", new Date(a.occurredAt).toLocaleDateString('es-PE')] }, a.id))] })] }) })] });
}
