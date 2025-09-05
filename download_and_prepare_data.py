import csv
import json
import os
import requests
import zipfile
from datetime import datetime

# Load stations from GeoJSON file
with open('stations.geojson', 'r', encoding='utf-8') as f:
    geojson_data = json.load(f)

STATIONS = {}
for feature in geojson_data['features']:
    station_id = int(feature['properties']['station_id'])
    if "Berlin" not in feature['properties']['station_name']:
        continue

    if int(datetime.now().strftime('%Y%m')) > int(feature['properties']['end_date'][:6]):
        continue

    STATIONS[station_id] = feature['properties']['station_name']

BASE_URL = "https://opendata.dwd.de/climate_environment/CDC/observations_germany/climate/daily/more_precip/recent/"
OUTPUT_DIR = "data"


def download_file(station_id):
    # Create output directory
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    station_id_str = str(station_id).zfill(5)
    zip_filename = f"tageswerte_RR_{station_id_str}_akt.zip"
    zip_filepath = os.path.join(OUTPUT_DIR, zip_filename)

    # Download the ZIP file
    print(f'--> {STATIONS[station_id]}')
    print(f"Downloading - {zip_filename}...")
    response = requests.get(BASE_URL + zip_filename)
    if response.status_code == 200:
        with open(zip_filepath, 'wb') as f:
            f.write(response.content)
        print(f"Saved to {zip_filepath}")

        # Extract the ZIP file
        print(f"Extracting {zip_filename}...")
        with zipfile.ZipFile(zip_filepath, 'r') as zip_ref:
            for member in zip_ref.namelist():
                if member.startswith("produkt_nieder_tag_") and member.endswith(f"_{station_id_str}.txt"):
                    zip_ref.extract(member, OUTPUT_DIR)
        print(f"Extracted relevant files to {OUTPUT_DIR}")
        os.remove(zip_filepath)
    else:
        print(f"Failed to download {zip_filename}: Status code {response.status_code}")


def process(station_id):
    station_id_str = str(station_id).zfill(5)

    input_filename = None
    for fname in os.listdir(OUTPUT_DIR):
        if fname.startswith("produkt_nieder_tag_") and fname.endswith(f"_{station_id_str}.txt"):
            input_filename = fname
            break

    if input_filename is None:
        print(f"No input file found for station {station_id_str}.")
        return

    input_filepath = os.path.join(OUTPUT_DIR, input_filename) if input_filename else None

    output_filename = f"rain_data_{station_id_str}.json"
    output_filepath = os.path.join(OUTPUT_DIR, output_filename)

    if not os.path.exists(input_filepath):
        print(f"Input file {input_filepath} does not exist. Please download it first.")
        return

    rain_data = []
    with open(input_filepath, 'r', encoding='utf-8') as csvfile:
        reader = csv.DictReader(csvfile, delimiter=';')
        for row in reader:
            # Normalize and strip whitespace from keys and values
            row = {k.strip(): v.strip() for k, v in row.items()}
            try:
                date = datetime.strptime(row['MESS_DATUM'], '%Y%m%d').date()
                precipitation = float(row['RS'].strip())
                if precipitation == -999.0:
                    precipitation = 0
                rain_data.append({
                    'date': date.isoformat(),
                    'precipitation': precipitation
                })
            except ValueError as e:
                print(f"Error processing row {row}: {e}")

    os.remove(input_filepath)

    with open(output_filepath, 'w', encoding='utf-8') as jsonfile:
        json.dump(rain_data, jsonfile, ensure_ascii=False, indent=2)

    print(f"Processed data saved to {output_filepath}")


if __name__ == '__main__':
    for station in STATIONS.keys():
        download_file(station)
        process(station)
        print('')
