/* Organizer — edit about page copy */

function defaultAboutData() {
  return {
    bio: '',
    availableHeading: 'available for:',
    available: [],
    location: '',
    contactIntro: 'please email for all booking inquiries',
    email: 'hello@amymyan.com'
  };
}

function readAboutForm() {
  const bio = document.getElementById('about-edit-bio');
  const heading = document.getElementById('about-edit-available-heading');
  const available = document.getElementById('about-edit-available');
  const location = document.getElementById('about-edit-location');
  const contactIntro = document.getElementById('about-edit-contact-intro');
  const email = document.getElementById('about-edit-email');

  return {
    bio: (bio?.value || '').trim(),
    availableHeading: (heading?.value || '').trim() || 'available for:',
    available: (available?.value || '').split('\n').map(line => line.replace(/^[˚*•\-]\s*/, '').trim()).filter(Boolean),
    location: (location?.value || '').trim(),
    contactIntro: (contactIntro?.value || '').trim(),
    email: (email?.value || '').trim()
  };
}

function fillAboutForm(data) {
  const about = Object.assign(defaultAboutData(), normalizeAboutData(data));
  const bio = document.getElementById('about-edit-bio');
  const heading = document.getElementById('about-edit-available-heading');
  const available = document.getElementById('about-edit-available');
  const location = document.getElementById('about-edit-location');
  const contactIntro = document.getElementById('about-edit-contact-intro');
  const email = document.getElementById('about-edit-email');

  if (bio) bio.value = about.bio;
  if (heading) heading.value = about.availableHeading;
  if (available) available.value = about.available.join('\n');
  if (location) location.value = about.location;
  if (contactIntro) contactIntro.value = about.contactIntro;
  if (email) email.value = about.email;
}

async function saveAboutForm() {
  if (!rootHandle) {
    setStatus('connect your project folder first');
    return;
  }
  await writeJSON('data', 'about.json', readAboutForm());
  setStatus('about page saved \u2713');
}

async function loadAboutOrganizer() {
  let raw = [];
  try {
    raw = await readJSON('data', 'about.json');
  } catch (err) {
    console.error(err);
  }
  fillAboutForm(raw);
}

function initAboutOrganizer() {
  const panel = document.getElementById('panel-about');
  if (!panel || panel.dataset.bound) return;
  panel.dataset.bound = '1';

  panel.querySelectorAll('textarea, input').forEach(field => {
    field.addEventListener('change', () => {
      saveAboutForm().catch(err => {
        console.error(err);
        setStatus('couldn\u2019t save about page');
      });
    });
  });
}

initAboutOrganizer();
