(function initHomeCredits() {
  const textPath = document.getElementById('home-credits-textpath');
  if (!textPath) return;

  const artists = [
    'josh conway',
    'djo',
    'kristiane',
    'claire rosinkranz',
    'landon contrath',
    'abby holliday',
    'artemas',
    'ella boh',
    'henry morris',
    'riff wood',
    'the cherry bombs',
    'mr. fantasy',
    'gianna yaccino',
    'naomi sato',
    'maddie park',
    'alexandra davis'
  ];

  const separator = ' ✮ ';
  const run = artists.join(separator) + separator;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  textPath.textContent = run + run;

  if (!reducedMotion) {
    const animate = document.createElementNS('http://www.w3.org/2000/svg', 'animate');
    animate.setAttribute('attributeName', 'startOffset');
    animate.setAttribute('from', '0%');
    animate.setAttribute('to', '-50%');
    animate.setAttribute('dur', '60s');
    animate.setAttribute('repeatCount', 'indefinite');
    textPath.appendChild(animate);
  }
})();
