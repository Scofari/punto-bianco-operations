import type { Role } from './domain';
export const ro = {
  appName: 'Punto Bianco', appSubtitle: 'Coordonarea vizitelor',
  nav: { overview: 'Privire de ansamblu', patients: 'Pacienți', backoffice: 'Back Office', accommodation: 'Cazări', transfers: 'Transferuri', team: 'Echipă' },
  roles: { admin: 'Administrator', coordinator: 'Coordonator tratament', backoffice: 'Back Office', accommodation: 'Manager cazări', driver: 'Șofer', accountant: 'Contabil', quality: 'Control calitate' } satisfies Record<Role, string>,
  apartment: { studio: 'Studio', one_bed_sofa: '1 dormitor + divan', two_bed: '2 dormitoare', two_bed_living: '2 dormitoare + living' },
  status: { new: 'Nou', in_progress: 'Început', completed: 'Finalizat', unprocessed: 'Neprelucrat', reserved: 'Rezervat' },
  transfer: { none: 'Fără transfer', arrival: 'Doar sosire', departure: 'Doar plecare', round_trip: 'Dus-întors' },
  actions: { newVisit: 'Înregistrează pacient', save: 'Salvează vizita', cancel: 'Anulează', start: 'Început', finish: 'Finalizat', reserve: 'Rezervă cazarea', logout: 'Deconectare' },
  form: { firstName: 'Prenume', lastName: 'Nume', arrival: 'Data și ora sosirii', departure: 'Data și ora plecării', availability: 'Disponibilitate în timpul sejurului', treatment: 'Tratament planificat', coordinator: 'Coordonator responsabil', apartment: 'Tip apartament', accommodationFree: 'Cazare gratuită', freeNights: 'Număr de nopți gratuite', transfer: 'Transfer aeroport', transferFree: 'Transfer gratuit' },
  errors: { generic: 'A apărut o eroare. Încercați din nou.', login: 'Email sau parolă incorectă.', offline: 'Conexiunea a fost întreruptă. Datele salvate rămân în siguranță.', setup: 'Conexiunea la baza de date nu este încă configurată.' },
  empty: { title: 'Totul este la zi', text: 'Nu există înregistrări pentru filtrele selectate.' },
};
