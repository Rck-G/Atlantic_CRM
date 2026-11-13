import { useCallback, useEffect, useRef, useState } from 'react';
import { CalendarDays, Utensils, Ticket, RefreshCw, Plus } from 'lucide-react';

const emptyRestaurant = { code: '', name: '', location: '', capacity: 40 };
const emptyEvent = { code: '', name: '', venue: '', startsAt: '', endsAt: '', capacity: 50 };

export default function Operations({ api, role }) {
  const apiRef = useRef(api);
  apiRef.current = api;
  const [restaurants, setRestaurants] = useState([]);
  const [reservations, setReservations] = useState([]);
  const [events, setEvents] = useState([]);
  const [restaurantForm, setRestaurantForm] = useState(emptyRestaurant);
  const [eventForm, setEventForm] = useState(emptyEvent);
  const [reservationForm, setReservationForm] = useState({ restaurantId: '', guestName: '', guestPhone: '', partySize: 2, startsAt: '', endsAt: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const refresh = useCallback(async () => {
    setBusy(true); setError('');
    try {
      const [r, b, e] = await Promise.all([apiRef.current('/restaurants'), apiRef.current('/reservations?limit=100'), apiRef.current('/events')]);
      setRestaurants(r); setReservations(b.data || []); setEvents(e);
      if (!reservationForm.restaurantId && r[0]) setReservationForm(v => ({ ...v, restaurantId: r[0].id }));
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const submit = async (path, payload, success) => {
    setError(''); setNotice('');
    try { await apiRef.current(path, { method: 'POST', body: JSON.stringify(payload) }); setNotice(success); await refresh(); }
    catch (err) { setError(err.message); }
  };
  const iso = value => new Date(value).toISOString();

  return <div className="operations-page">
    <div className="section-heading">
      <div><h1>Operaciones</h1><p>Restaurantes, reservas y eventos en un solo espacio operativo.</p></div>
      <button className="secondary" onClick={refresh} disabled={busy}><RefreshCw size={16}/> Actualizar</button>
    </div>
    {error && <div className="alert error">{error}</div>}
    {notice && <div className="alert success">{notice}</div>}

    <div className="dashboard-grid operations-grid">
      {role === 'ADMIN' && <section className="panel stack">
        <div className="panel-head"><div><h3><Utensils size={18}/> Restaurantes</h3><p>Catálogo de establecimientos y capacidad de referencia.</p></div></div>
        <form className="stack" onSubmit={e => { e.preventDefault(); submit('/restaurants', { ...restaurantForm, capacity: Number(restaurantForm.capacity) }, 'Restaurante registrado.'); setRestaurantForm(emptyRestaurant); }}>
          <label>Código<input required value={restaurantForm.code} onChange={e => setRestaurantForm({...restaurantForm, code:e.target.value})} placeholder="REST-01"/></label>
          <label>Nombre<input required value={restaurantForm.name} onChange={e => setRestaurantForm({...restaurantForm, name:e.target.value})} placeholder="Nombre del restaurante"/></label>
          <label>Ubicación<input value={restaurantForm.location} onChange={e => setRestaurantForm({...restaurantForm, location:e.target.value})} placeholder="Ubicación / salón"/></label>
          <label>Capacidad<input type="number" min="0" value={restaurantForm.capacity} onChange={e => setRestaurantForm({...restaurantForm, capacity:e.target.value})}/></label>
          <button className="primary"><Plus size={16}/> Registrar restaurante</button>
        </form>
        <div className="table-wrap"><table><thead><tr><th>Restaurante</th><th>Código</th><th>Capacidad</th></tr></thead><tbody>
          {restaurants.map(r => <tr key={r.id}><td>{r.name}<small className="cell-sub">{r.location || 'Sin ubicación'}</small></td><td>{r.code}</td><td>{r.capacity || '—'}</td></tr>)}
          {!restaurants.length && <tr><td colSpan="3">Aún no hay restaurantes registrados.</td></tr>}
        </tbody></table></div>
      </section>}

      {(role === 'ADMIN' || role === 'EMPLOYEE') && <section className="panel stack">
        <div className="panel-head"><div><h3><CalendarDays size={18}/> Nueva reserva</h3><p>El sistema valida el aforo disponible en el horario solicitado.</p></div></div>
        <form className="stack" onSubmit={e => { e.preventDefault(); submit('/reservations', { ...reservationForm, partySize:Number(reservationForm.partySize), startsAt:iso(reservationForm.startsAt), endsAt:iso(reservationForm.endsAt) }, 'Reserva creada.'); }}>
          <label>Restaurante<select required value={reservationForm.restaurantId} onChange={e => setReservationForm({...reservationForm, restaurantId:e.target.value})}><option value="">Seleccionar</option>{restaurants.map(r=><option key={r.id} value={r.id}>{r.name}</option>)}</select></label>
          <label>Nombre del titular<input required value={reservationForm.guestName} onChange={e => setReservationForm({...reservationForm, guestName:e.target.value})}/></label>
          <label>Teléfono<input value={reservationForm.guestPhone} onChange={e => setReservationForm({...reservationForm, guestPhone:e.target.value})}/></label>
          <label>Número de personas<input type="number" min="1" max="50" required value={reservationForm.partySize} onChange={e => setReservationForm({...reservationForm, partySize:e.target.value})}/></label>
          <label>Inicio<input type="datetime-local" required value={reservationForm.startsAt} onChange={e => setReservationForm({...reservationForm, startsAt:e.target.value})}/></label>
          <label>Fin<input type="datetime-local" required value={reservationForm.endsAt} onChange={e => setReservationForm({...reservationForm, endsAt:e.target.value})}/></label>
          <button className="primary" disabled={!restaurants.length}><Plus size={16}/> Crear reserva</button>
        </form>
      </section>}

      {(role === 'ADMIN' || role === 'MARKETING') && <section className="panel stack">
        <div className="panel-head"><div><h3><Ticket size={18}/> Eventos</h3><p>Publica actividades y controla el aforo de inscripciones.</p></div></div>
        <form className="stack" onSubmit={e => { e.preventDefault(); submit('/events', { ...eventForm, startsAt:iso(eventForm.startsAt), endsAt:iso(eventForm.endsAt), capacity:Number(eventForm.capacity), status:'PUBLISHED' }, 'Evento publicado.'); setEventForm(emptyEvent); }}>
          <label>Código<input required value={eventForm.code} onChange={e => setEventForm({...eventForm, code:e.target.value})} placeholder="EVT-2026-01"/></label>
          <label>Nombre<input required value={eventForm.name} onChange={e => setEventForm({...eventForm, name:e.target.value})}/></label>
          <label>Local / salón<input value={eventForm.venue} onChange={e => setEventForm({...eventForm, venue:e.target.value})}/></label>
          <label>Inicio<input type="datetime-local" required value={eventForm.startsAt} onChange={e => setEventForm({...eventForm, startsAt:e.target.value})}/></label>
          <label>Fin<input type="datetime-local" required value={eventForm.endsAt} onChange={e => setEventForm({...eventForm, endsAt:e.target.value})}/></label>
          <label>Aforo<input type="number" min="1" required value={eventForm.capacity} onChange={e => setEventForm({...eventForm, capacity:e.target.value})}/></label>
          <button className="primary"><Plus size={16}/> Publicar evento</button>
        </form>
        <div className="table-wrap"><table><thead><tr><th>Evento</th><th>Fecha</th><th>Inscritos</th><th>Estado</th></tr></thead><tbody>
          {events.map(ev=><tr key={ev.id}><td>{ev.name}<small className="cell-sub">{ev.venue || ev.code}</small></td><td>{new Date(ev.startsAt).toLocaleString('es-PE')}</td><td>{ev._count?.registrations ?? 0}{ev.capacity ? ` / ${ev.capacity}` : ''}</td><td>{ev.status}</td></tr>)}
          {!events.length && <tr><td colSpan="4">Aún no hay eventos.</td></tr>}
        </tbody></table></div>
      </section>}
    </div>

    <section className="panel stack">
      <div className="panel-head"><div><h3>Reservas registradas</h3><p>Listado operativo de las reservas más recientes.</p></div></div>
      <div className="table-wrap"><table><thead><tr><th>Cliente</th><th>Restaurante</th><th>Fecha</th><th>Personas</th><th>Estado</th></tr></thead><tbody>
        {reservations.map(r=><tr key={r.id}><td>{r.guestName}</td><td>{r.restaurant?.name || '—'}</td><td>{new Date(r.startsAt).toLocaleString('es-PE')}</td><td>{r.partySize}</td><td>{r.status}</td></tr>)}
        {!reservations.length && <tr><td colSpan="5">No hay reservas para mostrar.</td></tr>}
      </tbody></table></div>
    </section>
  </div>;
}
