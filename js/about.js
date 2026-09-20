/* About page — load copy from data/about.json */

function normalizeAboutData(raw) {
  const data = raw && !Array.isArray(raw) ? raw : {};
  const available = Array.isArray(data.available)
    ? data.available.map(item => String(item || '').trim()).filter(Boolean)
    : [];
  return {
    bio: String(data.bio || '').trim(),
    availableHeading: String(data.availableHeading || 'available for:').trim() || 'available for:',
    available,
    location: String(data.location || '').trim(),
    contactIntro: String(data.contactIntro || '').trim(),
    email: String(data.email || '').trim()
  };
}

function fillAboutPage(data) {
  const bio = document.getElementById('about-bio');
  const available = document.getElementById('about-available');
  const location = document.getElementById('about-location');
  const contact = document.getElementById('about-contact');
  if (!bio || !available || !location || !contact) return;

  if (data.bio) bio.textContent = data.bio;

  const lines = [data.availableHeading].concat(
    data.available.map(item => '˚ ' + item)
  );
  available.replaceChildren();
  lines.forEach((line, index) => {
    available.append(line);
    if (index < lines.length - 1) available.appendChild(document.createElement('br'));
  });

  if (data.location) location.textContent = data.location;

  contact.replaceChildren();
  if (data.contactIntro) {
    contact.append(data.contactIntro);
    contact.appendChild(document.createElement('br'));
  }
  if (data.email) {
    const link = document.createElement('a');
    link.href = 'mailto:' + data.email;
    link.textContent = data.email;
    contact.appendChild(link);
  }
}

(async function initAboutPage() {
  if (window.location.protocol === 'file:') return;

  try {
    const res = await fetch('data/about.json');
    if (!res.ok) return;
    fillAboutPage(normalizeAboutData(await res.json()));
  } catch (err) {
    console.error('Could not load about copy', err);
  }
})();
