import json
import urllib.request
from datetime import datetime

# URL of the station description file
url = "https://opendata.dwd.de/climate_environment/CDC/observations_germany/climate/daily/more_precip/recent/RR_Tageswerte_Beschreibung_Stationen.txt"

# Download and read the file
with urllib.request.urlopen(url) as response:
    data = response.read().decode('latin1').splitlines()

stations = []
for line in data[2:]:  # Skip header rows
    if not line.strip():  # Skip empty lines
        continue

    # Split by whitespace and rejoin the station name and state if they contain spaces
    parts = line.split()
    if len(parts) < 8:  # Skip invalid lines
        continue

    station = {
        'Stations_id': parts[0],
        'von_datum': parts[1],
        'bis_datum': parts[2],
        'Stationshoehe': parts[3],
        'geoBreite': parts[4],
        'geoLaenge': parts[5]
    }

    # Find Bundesland (always at the end before Frei/Nein)
    if parts[-1] in ('Frei', 'Nein'):
        station['Bundesland'] = ' '.join(parts[-2:-1])
        station['Stationsname'] = ' '.join(parts[6:-2])
    else:
        station['Bundesland'] = ' '.join(parts[-1:])
        station['Stationsname'] = ' '.join(parts[6:-1])

    if int(datetime.now().strftime('%Y%m')) > int(station['bis_datum'][:6]):
        print(f"Skipping inactive station: {station['Stations_id']} - {station['Stationsname']}")
        continue

    stations.append(station)

# Initialize GeoJSON structure
geojson = {
    "type": "FeatureCollection",
    "features": []
}

# Process each station to create a GeoJSON feature
for station in stations:
    try:
        # Convert coordinates to floats
        try:
            lon = float(station.get('geoLaenge', ''))
            lat = float(station.get('geoBreite', ''))
        except ValueError:
            print(f"Skipping station with invalid coordinates: {station}")
            continue

        # Skip invalid coordinates
        if not lon or not lat or not (-180 <= lon <= 180) or not (-90 <= lat <= 90):
            continue

        # Try to convert elevation to float
        try:
            elevation = float(station.get('Stationshoehe', ''))
        except ValueError:
            elevation = None

        # Create a feature
        feature = {
            "type": "Feature",
            "geometry": {
                "type": "Point",
                "coordinates": [lon, lat]
            },
            "properties": {
                "station_id": str(station.get('Stations_id', '')).zfill(5),
                "station_name": station.get('Stationsname', ''),
                "elevation": elevation,
                "start_date": station.get('von_datum', ''),
                "end_date": station.get('bis_datum', ''),
                "federal_state": station.get('Bundesland', '')
            }
        }
        geojson['features'].append(feature)
    except Exception:
        # Skip stations with invalid data
        print(f"Skipping station due to error: {station}")
        continue

# Save GeoJSON to a file
output_file = 'stations.geojson'
with open(output_file, 'w', encoding='utf-8') as f:
    json.dump(geojson, f, ensure_ascii=False, indent=2)

print(f"GeoJSON file saved as {output_file}")
