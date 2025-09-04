import csv
import json
import os
import requests
import zipfile
from io import BytesIO
from datetime import datetime
import unicodedata
import logging
from time import sleep

BASE_URL = "https://opendata.dwd.de/climate_environment/CDC/observations_germany/climate/daily/more_precip/recent/"
OUTPUT_DIR = "data"

# List of Berlin station IDs
STATIONS = {
    400: "Berlin-Buch",
    403: "Berlin-Dahlem (FU)",
    420: "Berlin-Marzahn",
    426: "Berlin-Schmöckwitz",
    433: "Berlin-Tempelhof",
    17444: "Berlin-Zehlendorf-Düppel",
    17445: "Berlin-Schönow",
    17446: "Berlin-Hubertusbrücke",
    17447: "Berlin-Colonie Alsen",
    17448: "Berlin-Lichtenrade (Lockestr.)",
    17449: "Berlin-Wilmersdorf",
    17450: "Berlin-Grunewald",
    17451: "Berlin-Charlottenburg (Mollwitzstr.)",
    17452: "Berlin-Wedding",
    17453: "Berlin-Haselhorst",
    17454: "Berlin-Hakenfelde",
    17455: "Berlin-Gatow",
    17456: "Berlin-Staaken",
    17457: "Berlin-Reinickendorf",
    17458: "Berlin-Frohnau (Bifröstweg)",
    17459: "Berlin-Heiligensee",
    17460: "Berlin-Neukölln",
    17461: "Berlin-Köllnische Heide",
    17462: "Berlin-Britz",
    17463: "Berlin-Rudow (Stubenrauchstr.)",
    17464: "Berlin-Johannisthal (Winckelmannstr.)",
    17465: "Berlin-Grünau",
    17466: "Berlin-Schmöckwitz/Dahme",
    17467: "Berlin-Köpenick/Spree",
    17468: "Berlin-Friedrichshagen-Hirschgarten",
    17469: "Berlin-Köpenick-Müggelheim",
    17470: "Berlin-Rummelsburg",
    17471: "Berlin-Biesdorf",
    17472: "Berlin-Oberschöneweide",
    17473: "Berlin-Friedrichshain/Spree",
    17474: "Berlin-Pankow-Prenzlauer Berg",
    17475: "Berlin-Gesundbrunnen",
    17476: "Berlin-Marzahn-Bürknersfelde",
    17477: "Berlin-Lichtenberg-Malchow",
    17478: "Berlin-Hohenschönhausen",
    17479: "Berlin-Karow",
    17480: "Berlin-Hessenwinkel",
    17481: "Berlin-Marienfelde (Grillostr.)",
    17482: "Berlin/Biesdorfer Baggersee",
    17483: "Berlin-Mitte/Südpanke",
    17484: "Berlin-Borsigwalde",
    17485: "Berlin-Lichterfelde",
    17486: "Berlin-Wilhelmstadt",
    17487: "Berlin-Kreuzberg",
    17488: "Berlin-Waidmannslust",
    17489: "Berlin-Heinersdorf",
    17490: "Berlin-Pankow-Rosenthal",
    17491: "Berlin-Blankenfelde",
    19897: "Berlin-Friedrichshain-Nord",
    19898: "Berlin-Halensee",
}

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
                rain_data.append({
                    'date': date.isoformat(),
                    'precipitation': precipitation
                })
            except ValueError as e:
                print(f"Error processing row {row}: {e}")

    with open(output_filepath, 'w', encoding='utf-8') as jsonfile:
        json.dump(rain_data, jsonfile, ensure_ascii=False, indent=2)

    print(f"Processed data saved to {output_filepath}")

if __name__ == '__main__':
    for station in STATIONS.keys():
        download_file(station)
        process(station)
        print('')



