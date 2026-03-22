// NASA Updater Section
fetch('https://api.nasa.gov/planetary/apod?api_key=BQ61JZz7GQmytZ4GOF67UawdelUefcBIm6DVUUOr')
 .then(response => response.json())
 .then(data => {
    const nasaUpdater = document.getElementById('nasa-updater');
    nasaUpdater.innerHTML = `
      <h2>${data.title}</h2>
      <p>${data.explanation}</p>
      <img src="${data.url}" alt="${data.title}">
    `;
  })
 .catch(error => console.error('Error fetching NASA data:', error));

// Mars Image Tracker Section
fetch('https://mars.nasa.gov/rss/api/?feed=raw_images&category=mars2020')
 .then(response => response.text())
 .then(xml => {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xml, 'text/xml');
    const items = xmlDoc.querySelectorAll('item');
    const marsImageTracker = document.getElementById('mars-image-tracker');
    marsImageTracker.innerHTML = `
      <h2>Mars Image Tracker</h2>
      <ul>
        ${Array.from(items).map(item => `
          <li>
            <img src="${item.querySelector('enclosure').getAttribute('url')}" alt="${item.querySelector('title').textContent}">
            <p>${item.querySelector('title').textContent}</p>
          </li>
        `).join('')}
      </ul>
    `;
  })
 .catch(error => console.error('Error fetching Mars image data:', error));

// Date Filter for Mars Image Tracker
const dateFilter = document.getElementById('date-filter');

dateFilter.addEventListener('change', () => {
  const selectedDate = dateFilter.value;
  const marsImageTracker = document.getElementById('mars-image-tracker');

  fetch(`https://mars.nasa.gov/rss/api/?feed=raw_images&category=mars2020&date=${selectedDate}`)
   .then(response => response.text())
   .then(xml => {
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(xml, 'text/xml');
      const items = xmlDoc.querySelectorAll('item');
      marsImageTracker.innerHTML = `
        <h2>Mars Image Tracker</h2>
        <ul>
          ${Array.from(items).map(item => `
            <li>
              <img src="${item.querySelector('enclosure').getAttribute('url')}" alt="${item.querySelector('title').textContent}">
              <p>${item.querySelector('title').textContent}</p>
            </li>
          `).join('')}
        </ul>
      `;
    })
   .catch(error => console.error('Error fetching Mars image data for date:', error));
});