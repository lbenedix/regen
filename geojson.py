import pandas as pd
import json
import urllib.request
from uuid import uuid4

# URL of the station description file
url = "https://opendata.dwd.de/climate_environment/CDC/observations_germany/climate/daily/more_precip/recent/RR_Tageswerte_Beschreibung_Stationen.txt"

# Download and read the fixed-width file
# The file has space-separated columns; we define approximate widths based on sample data
colspecs = [
    (0, 7),  # Stations_id
    (8, 16),  # von_datum
    (17, 25),  # bis_datum
    (26, 35),  # Stationshoehe
    (36, 44),  # geoBreite
    (45, 54),  # geoLaenge
    (55, 95),  # Stationsname
    (96, 116)  # Bundesland
]

# Read the file into a DataFrame
with urllib.request.urlopen(url) as response:
    # Decode with 'latin1' to handle special characters (e.g., umlauts)
    data = response.read().decode('latin1')
    # Save to a temporary file to use with pandas
    with open('temp.txt', 'w', encoding='latin1') as f:
        f.write(data)

# Parse the fixed-width file
df = pd.read_fwf('temp.txt', colspecs=colspecs, skiprows=2, encoding='latin1')

# Initialize GeoJSON structure
geojson = {
    "type": "FeatureCollection",
    "features": []
}

# Process each row to create a GeoJSON feature
for index, row in df.iterrows():
    try:
        # Ensure coordinates are valid floats
        lon = float(row['geoLaenge'])
        lat = float(row['geoBreite'])

        # Skip invalid coordinates (e.g., NaN or out-of-range)
        if pd.isna(lon) or pd.isna(lat) or not (-180 <= lon <= 180) or not (-90 <= lat <= 90):
            continue

        # Create a feature
        feature = {
            "type": "Feature",
            "geometry": {
                "type": "Point",
                "coordinates": [lon, lat]
            },
            "properties": {
                "station_id": str(row['Stations_id']).zfill(5),  # Ensure ID is 5 digits
                "station_name": row['Stationsname'],
                "elevation": float(row['Stationshoehe']) if not pd.isna(row['Stationshoehe']) else None,
                "start_date": str(row['von_datum']),
                "end_date": str(row['bis_datum']),
                "federal_state": row['Bundesland']
            }
        }
        geojson['features'].append(feature)
    except (ValueError, TypeError):
        # Skip rows with invalid data
        continue

# Save GeoJSON to a file
output_file = 'stations.geojson'
with open(output_file, 'w', encoding='utf-8') as f:
    json.dump(geojson, f, ensure_ascii=False, indent=2)

print(f"GeoJSON file saved as {output_file}")