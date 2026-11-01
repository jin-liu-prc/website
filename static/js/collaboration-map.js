/* Interactive collaboration map. Data and map geometry are served from this repository. */
(() => {
  'use strict';
  const root = document.querySelector('[data-collaboration-map]');
  if (!root) return;
  const status = root.querySelector('.collaboration-status');
  const chart = root.querySelector('.collaboration-chart');
  const svg = root.querySelector('.collaboration-world');
  const markers = root.querySelector('.collaboration-markers');
  const countrySelect = root.querySelector('select');
  const selection = root.querySelector('.collaboration-selection');
  const ns = 'http://www.w3.org/2000/svg';
  let data, selected = '', zoom = 1, center = [480, 240], drag = null;

  function element(tag, text, className) {
    const node = document.createElement(tag);
    if (text !== undefined) node.textContent = text;
    if (className) node.className = className;
    return node;
  }

  function sourceLink(url, label) {
    const link = element('a', label);
    if (/^https?:\/\//.test(url)) link.href = url;
    link.target = '_blank';
    link.rel = 'noopener';
    return link;
  }

  function project(country) {
    return [(country.longitude + 180) * 960 / 360, (90 - country.latitude) * 480 / 180];
  }

  function updateView() {
    const w = 960 / zoom, h = 480 / zoom;
    center[0] = Math.max(w / 2, Math.min(960 - w / 2, center[0]));
    center[1] = Math.max(h / 2, Math.min(480 - h / 2, center[1]));
    svg.setAttribute('viewBox', `${center[0] - w / 2} ${center[1] - h / 2} ${w} ${h}`);
    svg.style.touchAction = zoom > 1 ? 'none' : 'pan-y';
    root.querySelector('[data-map-zoom="out"]').disabled = zoom === 1;
    root.querySelector('[data-map-zoom="in"]').disabled = zoom === 6;
    root.querySelector('.collaboration-map-hint').textContent = zoom > 1
      ? 'Drag to pan · select a marker to explore' : 'Select a marker to explore';
  }

  function selectCountry(code) {
    selected = code;
    countrySelect.value = code;
    markers.querySelectorAll('[data-country]').forEach(marker => {
      marker.classList.toggle('is-selected', marker.dataset.country === code);
      marker.setAttribute('aria-pressed', marker.dataset.country === code ? 'true' : 'false');
    });
    selection.replaceChildren();
    const country = data.countries.find(c => c.code === code);
    if (!country) {
      selection.append(element('p', 'Choose a marker or a country to see its research organisations.'));
      return;
    }
    const organizations = country.organizations || [];
    selection.append(element('h4', `${country.name} · ${organizations.length} ${organizations.length === 1 ? 'research organisation' : 'research organisations'}`));
    const list = element('ul', undefined, 'collaboration-organizations');
    organizations.forEach(organization => {
      const li = element('li');
      const details = element('details');
      const summary = element('summary', organization.name);
      details.append(summary);
      const sources = element('div', undefined, 'collaboration-organization-sources');
      organization.workIds.forEach(id => {
        const work = data.works.find(w => w.id === id);
        if (!work) return;
        const source = element('p');
        source.append(sourceLink(work.url, `${work.title} (${work.year})`));
        sources.append(source);
      });
      details.append(sources);
      li.append(details);
      list.append(li);
    });
    selection.append(list);
  }

  root.querySelectorAll('[data-map-zoom]').forEach(button => {
    button.addEventListener('click', () => {
      const action = button.dataset.mapZoom;
      if (action === 'reset') {
        zoom = 1; center = [480, 240];
      } else {
        if (selected) center = project(data.countries.find(c => c.code === selected));
        zoom = Math.max(1, Math.min(6, zoom * (action === 'in' ? 1.5 : 1 / 1.5)));
      }
      updateView();
    });
  });
  svg.addEventListener('pointerdown', event => {
    if (zoom === 1 || event.target.closest('[data-country]')) return;
    drag = {x: event.clientX, y: event.clientY, center: center.slice()};
    svg.setPointerCapture(event.pointerId);
  });
  svg.addEventListener('pointermove', event => {
    if (!drag) return;
    const rect = svg.getBoundingClientRect();
    center = [drag.center[0] - (event.clientX - drag.x) * 960 / zoom / rect.width,
      drag.center[1] - (event.clientY - drag.y) * 480 / zoom / rect.height];
    updateView();
  });
  ['pointerup', 'pointercancel'].forEach(type => svg.addEventListener(type, () => { drag = null; }));
  countrySelect.addEventListener('change', () => selectCountry(countrySelect.value));

  fetch(root.dataset.source).then(response => {
    if (!response.ok) throw new Error('Map data unavailable');
    return response.json();
  }).then(result => {
    if (!Array.isArray(result.countries) || !result.countries.length) throw new Error('No verified affiliations');
    data = result;
    root.querySelector('.collaboration-period').textContent = `All years · ${data.yearRange.join('–')}`;
    status.textContent = `${data.totals.collaborators} distinct collaborators · ${data.countries.length} countries · updated ${new Intl.DateTimeFormat('en-AU', {day:'numeric', month:'long', year:'numeric', timeZone:'UTC'}).format(new Date(data.updated + 'T00:00:00Z'))}`;
    data.countries.slice().sort((a, b) => a.name.localeCompare(b.name)).forEach(country => {
      const option = element('option', `${country.name} (${country.collaborators.length})`);
      option.value = country.code;
      countrySelect.append(option);
    });
    // Use a single scale factor so the largest radius stays at 16 SVG units and area ratios remain exact.
    const maxCount = Math.max(...data.countries.map(c => c.collaborators.length));
    const radiusScale = Math.min(5, 16 / Math.sqrt(maxCount));
    // Large bubbles first so small European countries remain selectable above them.
    data.countries.slice().sort((a, b) => b.collaborators.length - a.collaborators.length).forEach(country => {
      const [x, y] = project(country);
      const group = document.createElementNS(ns, 'g');
      group.dataset.country = country.code;
      group.classList.add('collaboration-marker');
      group.setAttribute('role', 'button');
      group.setAttribute('tabindex', '0');
      group.setAttribute('aria-pressed', 'false');
      group.setAttribute('aria-label', `${country.name}: ${country.collaborators.length} ${country.collaborators.length === 1 ? 'collaborator' : 'collaborators'}`);
      const title = document.createElementNS(ns, 'title');
      title.textContent = `${country.name}: ${country.collaborators.length}`;
      group.append(title);
      const radius = radiusScale * Math.sqrt(country.collaborators.length);
      const hit = document.createElementNS(ns, 'circle');
      hit.setAttribute('cx', x); hit.setAttribute('cy', y); hit.setAttribute('r', Math.max(10, radius));
      hit.setAttribute('fill', 'transparent'); hit.classList.add('collaboration-marker-hit');
      group.append(hit);
      const circle = document.createElementNS(ns, 'circle');
      circle.setAttribute('cx', x); circle.setAttribute('cy', y); circle.setAttribute('r', radius);
      circle.classList.add('collaboration-marker-dot');
      group.append(circle);
      group.addEventListener('click', () => selectCountry(country.code));
      group.addEventListener('keydown', event => {
        if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); selectCountry(country.code); }
      });
      markers.append(group);
    });
    const coverage = data.coverage;
    root.querySelector('.collaboration-coverage').textContent = `${coverage.inventoryRecords} Scholar records reviewed; ${coverage.verifiedCoauthoredWorks} distinct coauthored records with fully verified affiliations. ${coverage.unresolvedWorks} records have unresolved affiliations. Duplicate versions and the single-author thesis do not add collaborators. Automatic refresh checks preserve the last verified data if new affiliations cannot be resolved.`;
    const sources = root.querySelector('.collaboration-publication-sources ol');
    data.works.forEach(work => {
      const li = element('li');
      li.append(sourceLink(work.url, `${work.title} (${work.year})`));
      if (work.note) li.append(document.createTextNode(` — ${work.note}`));
      sources.append(li);
    });
    chart.hidden = false;
    updateView();
  }).catch(() => {
    status.textContent = 'The map could not load. Please refresh the page or view the publication record on Google Scholar.';
  });
})();
