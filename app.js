// Application state
const APP_STATE = {
    STATIONS: {},
    STATION_FEATURES: {},
    DATA_CACHE: {},
    map: null,
    stationMarkers: {}, // Added to store all station markers
    currentMarker: null,
    currentChart: null,
    currentStationData: null,
    mapInitialized: false
};

// Define marker icons
const defaultIcon = L.divIcon({
    className: 'custom-div-icon',
    html: "<div style='background-color: #3388ff; width: 10px; height: 10px; border-radius: 50%; border: 1px solid white;'></div>",
    iconSize: [10, 10],
    iconAnchor: [5, 5]
});

const selectedIcon = L.divIcon({
    className: 'custom-div-icon',
    html: "<div style='background-color: #ff3333; width: 14px; height: 14px; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 5px rgba(0,0,0,0.5);'></div>",
    iconSize: [14, 14],
    iconAnchor: [7, 7]
});

// Initialize app
document.addEventListener('DOMContentLoaded', function () {
    loadTheme();
    initializeApp();
});

// Initialize app components
function initializeApp() {
    moment.locale('de');
    preventPullToRefresh();
    populateYearDropdown();
    populateMonthDropdown();
    loadStations();

    // Set default station after loading
    setTimeout(() => {
        const stationSelect = document.getElementById('stationSelect');
        if (stationSelect.options.length > 1) {
            loadClosestStation();
        }
    }, 500);
}

// Prevent pull-to-refresh on mobile devices
function preventPullToRefresh() {
    let startY = 0;
    let isPreventingPullToRefresh = false;

    document.addEventListener('touchstart', function (e) {
        startY = e.touches[0].pageY;
        isPreventingPullToRefresh = window.pageYOffset === 0;
    }, {passive: false});

    document.addEventListener('touchmove', function (e) {
        const currentY = e.touches[0].pageY;
        const isScrollingDown = currentY > startY;
        if (isPreventingPullToRefresh && isScrollingDown) {
            e.preventDefault();
        }
    }, {passive: false});

    document.body.style.overscrollBehavior = 'contain';
    document.documentElement.style.overscrollBehavior = 'contain';
}

// Theme management
function toggleTheme() {
    const html = document.documentElement;
    const toggleButton = document.querySelector('.theme-toggle');
    const currentTheme = html.getAttribute('data-theme');

    if (currentTheme === 'dark') {
        html.removeAttribute('data-theme');
        toggleButton.textContent = '🌙';
        localStorage.setItem('theme', 'light');
    } else {
        html.setAttribute('data-theme', 'dark');
        toggleButton.textContent = '☀️';
        localStorage.setItem('theme', 'dark');
    }

    // Refresh chart if it exists to update colors
    if (APP_STATE.currentChart) {
        updateChartColors();
    }
}

function loadTheme() {
    const savedTheme = localStorage.getItem('theme');
    const html = document.documentElement;
    const toggleButton = document.querySelector('.theme-toggle');

    if (savedTheme === 'dark') {
        html.setAttribute('data-theme', 'dark');
        toggleButton.textContent = '☀️';
    } else {
        html.removeAttribute('data-theme');
        toggleButton.textContent = '🌙';
    }
}

// Station management
function loadStations() {
    fetch('stations.geojson')
        .then(response => {
            if (!response.ok) throw new Error('Failed to load stations data');
            return response.json();
        })
        .then(geojsonData => {
            // const desiredStationIds = new Set([400, 403, 420, 426, 433, 17444, 17445, 17446, 17447, 17448, 17449, 17450,
            //     17451, 17452, 17453, 17454, 17455, 17456, 17457, 17458, 17459, 17460, 17461,
            //     17462, 17463, 17464, 17465, 17466, 17467, 17468, 17469, 17470, 17471, 17472,
            //     17473, 17474, 17475, 17476, 17477, 17478, 17479, 17480, 17481, 17482, 17483,
            //     17484, 17485, 17486, 17487, 17488, 17489, 17490, 17491, 19897, 19898]);

            geojsonData.features.forEach(feature => {
                const stationId = parseInt(feature.properties.station_id);
                // if (desiredStationIds.has(stationId)) {
                APP_STATE.STATIONS[stationId] = feature.properties.station_name;
                APP_STATE.STATION_FEATURES[stationId] = feature;
                // }
            });

            populateStationDropdown();
            showToast('Stations loaded successfully', 'success');

            // After stations are loaded, initialize the map if it's ready
            if (APP_STATE.mapInitialized) {
                addAllStationMarkers();
            }
        })
        .catch(error => {
            console.error('Error loading stations:', error);
            showToast('Error loading station data', 'error');
        });
}

function populateStationDropdown() {
    const stationSelect = document.getElementById('stationSelect');
    Object.entries(APP_STATE.STATIONS)
        .sort((a, b) => a[1].localeCompare(b[1]))
        .forEach(([id, name]) => {
            const option = document.createElement('option');
            option.value = id;
            option.textContent = name;
            stationSelect.appendChild(option);
        });
}

function populateYearDropdown() {
    const yearSelect = document.getElementById('yearSelect');
    for (let year = 2020; year <= 2025; year++) {
        const option = document.createElement('option');
        option.value = year;
        option.textContent = year;
        yearSelect.appendChild(option);
    }
}

function populateMonthDropdown() {
    const monthSelect = document.getElementById('monthSelect');
    const months = moment.months();
    months.forEach((month, index) => {
        const option = document.createElement('option');
        option.value = index + 1; // 1-12 for January-December
        option.textContent = month;
        monthSelect.appendChild(option);
    });
}

// Map management
function initializeMap() {
    // Only initialize the map once
    if (APP_STATE.mapInitialized) {
        return;
    }

    // Check if the map container is available
    const mapContainer = document.getElementById('map');
    if (!mapContainer) {
        console.error('Map container not found');
        return;
    }

    // Initialize map centered on Germany without zoom controls
    APP_STATE.map = L.map('map', {
        zoomControl: false
    }).setView([51.1657, 10.4515], 6);

    // Add OpenStreetMap tiles
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
    }).addTo(APP_STATE.map);

    APP_STATE.mapInitialized = true;

    // Force a resize after a short delay to ensure proper rendering
    setTimeout(() => {
        if (APP_STATE.map) {
            APP_STATE.map.invalidateSize();
        }
    }, 100);

    // If stations are already loaded, add all markers
    if (Object.keys(APP_STATE.STATION_FEATURES).length > 0) {
        addAllStationMarkers();
    }
}

function addAllStationMarkers() {
    if (!APP_STATE.map || !APP_STATE.mapInitialized) return;

    // Clear existing markers
    Object.values(APP_STATE.stationMarkers).forEach(marker => {
        APP_STATE.map.removeLayer(marker);
    });
    APP_STATE.stationMarkers = {};

    // Add markers for all stations
    Object.entries(APP_STATE.STATION_FEATURES).forEach(([stationId, feature]) => {
        const props = feature.properties;
        const coords = feature.geometry.coordinates;

        const marker = L.marker([coords[1], coords[0]], {
            icon: defaultIcon,
            stationId: stationId // Store station ID in marker options
        })
            .addTo(APP_STATE.map)
            .on('click', function () {
                // When marker is clicked, select the corresponding station
                selectStationFromMap(this.options.stationId);
            });

        // Store marker reference
        APP_STATE.stationMarkers[stationId] = marker;
    });
}

function selectStationFromMap(stationId) {
    // Save current year and month selections
    const currentYear = document.getElementById('yearSelect').value;
    const currentMonth = document.getElementById('monthSelect').value;

    // Update the dropdown selection
    const stationSelect = document.getElementById('stationSelect');
    stationSelect.value = stationId;

    // Update station info without resetting the date
    updateStationInfo(stationId);

    // Restore the year and month selections
    document.getElementById('yearSelect').value = currentYear;
    document.getElementById('monthSelect').value = currentMonth;

    // Load station data with the preserved year and month
    loadStationData(stationId);
}

function updateStationInfo(stationId) {
    const feature = APP_STATE.STATION_FEATURES[stationId];
    if (!feature) return;

    const props = feature.properties;
    const coords = feature.geometry.coordinates;

    // Update station details
    document.getElementById('stationName').textContent = props.station_name;
    document.getElementById('stationId').textContent = props.station_id;
    document.getElementById('stationElevation').textContent = props.elevation || 'N/A';
    document.getElementById('stationState').textContent = props.federal_state || 'N/A';
    document.getElementById('stationCoords').textContent = `${coords[1].toFixed(4)}, ${coords[0].toFixed(4)}`;

    // Initialize map if not already done
    initializeMap();

    // Update map
    if (APP_STATE.map) {
        // Reset all markers to default icon
        Object.values(APP_STATE.stationMarkers).forEach(marker => {
            marker.setIcon(defaultIcon);
        });

        // Remove previous marker if it exists
        if (APP_STATE.currentMarker) {
            APP_STATE.map.removeLayer(APP_STATE.currentMarker);
        }

        // Highlight selected station marker
        if (APP_STATE.stationMarkers[stationId]) {
            const selectedMarker = APP_STATE.stationMarkers[stationId];
            selectedMarker.setIcon(selectedIcon);
        }

        // Add a new marker for the selected station (if not already added)
        APP_STATE.currentMarker = L.marker([coords[1], coords[0]], {
            icon: selectedIcon,
            stationId: stationId // Store station ID in marker options
        })
            .addTo(APP_STATE.map)
            .on('click', function () {
                // When marker is clicked, select the corresponding station
                selectStationFromMap(this.options.stationId);
            });

        // Center map on station
        APP_STATE.map.setView([coords[1], coords[0]], 13);
    }

    // Show station info section
    document.getElementById('stationInfo').classList.add('visible');
}

// Data management
function handleStationChange() {
    const stationId = document.getElementById('stationSelect').value;
    const dateSelectors = document.getElementById('dateSelectors');
    const stationInfo = document.getElementById('stationInfo');

    if (stationId) {
        const now = moment();
        document.getElementById('yearSelect').value = now.year();
        document.getElementById('monthSelect').value = now.month() + 1;
        dateSelectors.style.display = 'flex';
        updateStationInfo(stationId);
        loadStationData(stationId);
    } else {
        dateSelectors.style.display = 'none';
        stationInfo.classList.remove('visible');
        document.getElementById('charts').innerHTML = '';
        document.getElementById('statsContainer').classList.remove('visible');
    }
}

function changeMonth(direction) {
    const year = parseInt(document.getElementById('yearSelect').value);
    const month = parseInt(document.getElementById('monthSelect').value);

    if (!year || !month) return;

    let newDate = moment(`${year}-${month}-01`, 'YYYY-M-DD').add(direction, 'month');
    document.getElementById('yearSelect').value = newDate.year();
    document.getElementById('monthSelect').value = newDate.month() + 1;
    loadStationData(document.getElementById('stationSelect').value);
}

function loadStationData(stationId) {
    if (!stationId) {
        stationId = stationSelect.value;
    };
    const year = document.getElementById('yearSelect').value;
    const month = document.getElementById('monthSelect').value;

    if (!stationId || !year || !month) {
        document.getElementById('charts').innerHTML = '';
        document.getElementById('statsContainer').classList.remove('visible');
        return;
    }

    const fileName = `data/rain_data_${stationId.padStart(5, '0')}.json`;
    const cacheKey = `${stationId}-${year}-${month}`;

    // Check if data is already cached
    if (APP_STATE.DATA_CACHE[cacheKey]) {
        processStationData(APP_STATE.DATA_CACHE[cacheKey], APP_STATE.STATIONS[stationId], year, month);
        return;
    }

    fetch(fileName)
        .then(response => {
            if (!response.ok) {
                throw new Error('File not found or network error');
            }
            return response.json();
        })
        .then(data => {
            // Cache the data
            APP_STATE.DATA_CACHE[cacheKey] = data;
            processStationData(data, APP_STATE.STATIONS[stationId], year, month);
        })
        .catch(error => {
            console.error('Error loading data:', error);
            showToast(`Error loading data: ${error.message}`, 'error');
            document.getElementById('charts').innerHTML = '';
            document.getElementById('statsContainer').classList.remove('visible');
        });
}

function processStationData(data, stationName, year, month) {
    if (!window.Chart) {
        showToast('Chart.js is not available. Cannot render charts.', 'error');
        return;
    }

    // Destroy previous chart instance if it exists
    if (APP_STATE.currentChart) {
        APP_STATE.currentChart.destroy();
        APP_STATE.currentChart = null;
    }

    // Filter data for the selected year and month
    const monthYear = `${year}-${month.padStart(2, '0')}`;
    const monthData = data
        .filter(entry => moment(entry.date, 'YYYY-MM-DD').format('YYYY-MM') === monthYear)
        .map(entry => ({
            date: moment(entry.date, 'YYYY-MM-DD').toDate(),
            precipitation: entry.precipitation
        }))
        .sort((a, b) => a.date - b.date);

    // Store current station data
    APP_STATE.currentStationData = {
        stationName,
        year,
        month,
        data: monthData
    };

    // Clear previous charts
    const chartsContainer = document.getElementById('charts');
    chartsContainer.innerHTML = '';

    if (monthData.length === 0) {
        chartsContainer.innerHTML = '<p>No data available for this month.</p>';
        document.getElementById('statsContainer').classList.remove('visible');
        return;
    }

    // Calculate statistics
    const precipitationValues = monthData.map(d => d.precipitation);
    const totalPrecipitation = precipitationValues.reduce((sum, val) => sum + val, 0);
    const rainyDays = precipitationValues.filter(val => val > 0).length;
    const dailyAverage = totalPrecipitation / precipitationValues.length;

    // Update statistics display
    document.getElementById('totalPrecipitation').textContent = `${totalPrecipitation.toFixed(1)} mm`;
    document.getElementById('rainyDays').textContent = rainyDays;
    document.getElementById('dailyAverage').textContent = `${dailyAverage.toFixed(1)} mm`;

    // Show statistics container
    document.getElementById('statsContainer').classList.add('visible');

    // Create a single bar chart for the selected month
    const container = document.createElement('div');
    container.className = 'chart-container';
    const canvas = document.createElement('canvas');
    container.appendChild(canvas);
    chartsContainer.appendChild(container);

    // Get theme colors
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const textColor = isDark ? '#e0e0e0' : '#333';
    const gridColor = isDark ? '#404040' : '#e0e0e0';

    APP_STATE.currentChart = new Chart(canvas, {
        type: 'bar',
        data: {
            datasets: [{
                label: `Precipitation (${stationName})`,
                data: monthData.map(d => ({
                    x: d.date,
                    y: d.precipitation
                })),
                backgroundColor: 'rgba(0, 123, 255, 0.5)',
                borderColor: '#007bff',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: {
                duration: 0
            },
            scales: {
                x: {
                    type: 'time',
                    time: {
                        unit: 'day',
                        displayFormats: {
                            day: 'ddd MMM D'
                        }
                    },
                    title: {
                        display: false,
                        text: 'Date',
                        color: textColor
                    },
                    min: moment(`${year}-${month}-01`, 'YYYY-MM-DD').toDate(),
                    max: moment(`${year}-${month}-01`, 'YYYY-MM-DD').endOf('month').toDate(),
                    ticks: {
                        maxRotation: 90,
                        minRotation: 90,
                        color: textColor
                    },
                    grid: {
                        color: gridColor
                    }
                },
                y: {
                    title: {
                        display: true,
                        text: 'Precipitation (mm)',
                        color: textColor
                    },
                    beginAtZero: true,
                    min: 0,
                    max: 60,
                    ticks: {
                        color: textColor
                    },
                    grid: {
                        color: gridColor
                    }
                }
            },
            plugins: {
                title: {
                    display: true,
                    text: `Precipitation for ${stationName} - ${moment(monthYear, 'YYYY-MM').format('MMMM YYYY')}`,
                    color: textColor
                },
                legend: {
                    labels: {
                        color: textColor
                    }
                }
            }
        }
    });

    // Force initial resize after a short delay
    setTimeout(() => {
        if (APP_STATE.currentChart) {
            APP_STATE.currentChart.resize();
        }
    }, 100);
}

// Chart management
function updateChartColors() {
    if (!APP_STATE.currentChart) return;

    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const textColor = isDark ? '#e0e0e0' : '#333';
    const gridColor = isDark ? '#404040' : '#e0e0e0';

    APP_STATE.currentChart.options.scales.x.ticks.color = textColor;
    APP_STATE.currentChart.options.scales.x.title.color = textColor;
    APP_STATE.currentChart.options.scales.x.grid.color = gridColor;
    APP_STATE.currentChart.options.scales.y.ticks.color = textColor;
    APP_STATE.currentChart.options.scales.y.title.color = textColor;
    APP_STATE.currentChart.options.scales.y.grid.color = gridColor;
    APP_STATE.currentChart.options.plugins.title.color = textColor;
    APP_STATE.currentChart.options.plugins.legend.labels.color = textColor;

    APP_STATE.currentChart.update('none');
}

// Navigation functionality
function changeStation(direction) {
    const stationSelect = document.getElementById('stationSelect');
    const currentStationId = stationSelect.value;

    if (!currentStationId) return;

    const options = Array.from(stationSelect.options).slice(1);
    const currentIndex = options.findIndex(option => option.value === currentStationId);

    if (currentIndex === -1) return;

    let newIndex = currentIndex + direction;
    if (newIndex < 0) {
        newIndex = options.length - 1;
    } else if (newIndex >= options.length) {
        newIndex = 0;
    }

    const currentYear = document.getElementById('yearSelect').value;
    const currentMonth = document.getElementById('monthSelect').value;

    stationSelect.value = options[newIndex].value;
    updateStationInfo(options[newIndex].value);

    if (currentYear && currentMonth) {
        document.getElementById('yearSelect').value = currentYear;
        document.getElementById('monthSelect').value = currentMonth;
    }

    loadStationData(stationSelect.value);
}

// Keyboard navigation
document.addEventListener('keydown', function (e) {
    const dateSelectors = document.getElementById('dateSelectors');
    if (dateSelectors.style.display !== 'flex') return;

    if (e.key === 'ArrowLeft') {
        changeMonth(-1);
        e.preventDefault();
    } else if (e.key === 'ArrowRight') {
        changeMonth(1);
        e.preventDefault();
    } else if (e.key === 'ArrowUp') {
        changeStation(-1);
        e.preventDefault();
    } else if (e.key === 'ArrowDown') {
        changeStation(1);
        e.preventDefault();
    }
});

// Touch navigation
let touchStartX = null;
let touchStartY = null;

document.addEventListener('touchstart', function (e) {
    if (e.touches.length === 1) {
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
    }
});

document.addEventListener('touchend', function (e) {
    if (touchStartX === null || touchStartY === null) return;

    const touchEndX = e.changedTouches[0].clientX;
    const touchEndY = e.changedTouches[0].clientY;
    const dx = touchEndX - touchStartX;
    const dy = touchEndY - touchStartY;

    const dateSelectors = document.getElementById('dateSelectors');
    if (dateSelectors.style.display !== 'flex') return;

    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) {
        if (dx < 0) {
            changeMonth(1);
        } else {
            changeMonth(-1);
        }
    }

    touchStartX = null;
    touchStartY = null;
});

// Toast notification system
function showToast(message, type = 'success') {
    const toastContainer = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    toast.innerHTML = `
        <span>${message}</span>
        <button class="toast-close" onclick="this.parentElement.remove()">×</button>
    `;

    toastContainer.appendChild(toast);

    // Auto remove after 5 seconds
    setTimeout(() => {
        if (toast.parentElement) {
            toast.remove();
        }
    }, 5000);
}

// Window resize handling
let resizeTimeout = null;

function debounceResize() {
    if (resizeTimeout) {
        clearTimeout(resizeTimeout);
    }

    resizeTimeout = setTimeout(() => {
        if (APP_STATE.currentChart) {
            APP_STATE.currentChart.resize();
        }
        if (APP_STATE.map) {
            APP_STATE.map.invalidateSize();
        }
    }, 150);
}

window.addEventListener('resize', debounceResize);

// Check if Chart.js is loaded
if (typeof Chart === 'undefined') {
    showToast('Chart.js failed to load. Please check your internet connection or the CDN link.', 'error');
}

// Use the Haversine formula to calculate distance between two coordinates
function haversineDistance(coords1, coords2) {
    function toRad(deg) {
        return deg * Math.PI / 180;
    }

    const R = 6371; // Earth's radius in km
    const dLat = toRad(coords2.lat - coords1.lat);
    const dLon = toRad(coords2.lng - coords1.lng);
    const lat1 = toRad(coords1.lat);
    const lat2 = toRad(coords2.lat);
    const a = Math.sin(dLat / 2) ** 2 +
        Math.sin(dLon / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

// Find and load the closest station based on the current position
function loadClosestStation() {
    const stationSelect = document.getElementById('stationSelect');
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            function (position) {
                const userCoords = {
                    lat: position.coords.latitude,
                    lng: position.coords.longitude
                };

                let closestStation = null;
                let minDistance = Infinity;
                // Use the station features for distance calculation
                Object.values(APP_STATE.STATION_FEATURES).forEach(feature => {
                    const props = feature.properties;
                    const coords = feature.geometry.coordinates;
                    const stationCoords = {lat: coords[1], lng: coords[0]};
                    const distance = haversineDistance(userCoords, stationCoords);
                    if (distance < minDistance) {
                        minDistance = distance;
                        closestStation = props.station_id;
                    }
                });

                if (closestStation) {
                    stationSelect.value = closestStation;
                    handleStationChange();
                }
            },
            function (error) {
                console.error('Error getting position', error);
                stationSelect.value = "19897";
                handleStationChange();
            }
        );
    } else {
        console.error('Geolocation is not supported by this browser.');
        stationSelect.value = "19897";
        handleStationChange();
    }
}

// Initialize the initial load flag
APP_STATE.initialLoadComplete = false;